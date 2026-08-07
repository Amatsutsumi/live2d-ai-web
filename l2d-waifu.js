/* ============================================================================
 *  Live2D 看板娘插件  v1.3.0
 *  ---------------------------------------------------------------------------
 *  基于 l2d（https://github.com/hacxy/l2d）的看板娘插件，
 *  支持：大模型对话、TTS 语音、情绪/表情/动作、口型同步、拖拽与互动、
 *  本地/远程模型加载、配置化定制、Hexo 及任意网页集成。
 *
 *  引入顺序：
 *    <script src="https://unpkg.com/l2d/dist/index.min.js"></script>
 *    <script src="config.js"></script>
 *    <script src="l2d-waifu.js"></script>
 * ========================================================================== */
(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  var CFG = window.L2D_WAIFU_CONFIG || {};
  if (!window.L2D) {
    console.error('[L2D-Waifu] 未检测到 l2d 库，请先引入 https://unpkg.com/l2d/dist/index.min.js');
    return;
  }

  var ROOT_ID = 'l2d-waifu-root';
  var rootEl = null;
  var l2d = null;
  var canvasEl = null;
  var ui = {};
  var audioEl = null;
  var analyserFn = null;
  var mouthParam = CFG.mouth && CFG.mouth.param === 'auto' ? null : (CFG.mouth && CFG.mouth.param) || null;

  /* 插件所在目录（用于把 config 中的相对路径解析到插件目录，而不是页面目录） */
  var pluginBase = (function () {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || '';
      if (/l2d-waifu\.js/i.test(src)) {
        return src.replace(/[^/]*$/, '');
      }
    }
    return '';
  })();

  function resolvePath(p) {
    if (!p) return p;
    if (/^(https?:)?\/\//i.test(p) || /^data:/i.test(p) || /^blob:/i.test(p)) return p;
    if (p.charAt(0) === '/') return p;
    return pluginBase + p;   // 相对路径相对插件目录解析
  }

  /* ---------------- 运行状态 ---------------- */
  var state = {
    ready: false,        // 模型是否就绪
    busy: false,         // 是否正在"文字大模型 + TTS"流程中（思考中/说话中）
    speaking: false,     // 是否正在播放 TTS 语音
    modelVoice: false,   // 是否正在播放模型自带语音（交互动作）
    chatLocked: false,   // 聊天框是否被锁定（模型语音期间）
    drag: null,          // 拖拽状态
    // 点击/拖拽误触防护：记录本次 pointerdown 是否发生在画布上。
    // null=未知（拖拽未启用等），此时放行正常点击；
    // true=按下在画布；false=按在菜单/聊天框等非画布区域（阻止互动）。
    pointerOnCanvas: null,
    menuRef: null,       // 左侧小菜单 DOM，用于阻止点击穿透到画布
    _modelVoiceMuted: false,  // 对话输出期间是否已临时静音模型自带语音
    _canvasWasHidden: false,  // 记录画布是否经历隐藏（用于显示后重算投影）
    vol: 0,              // 当前音量（0=静音）
    history: [],         // 对话历史
    bindingId: null,     // 当前模型绑定 id（用于后端级联切换 TTS/文字模型/人设/知识库）
    lastMotionGroup: null,
    motionEndTimer: null,
    soundGroups: {}      // 播放时会带自带语音的动作组集合
  };

  /* ---------------- 工具函数 ---------------- */
  function $(sel, parent) { return (parent || document).querySelector(sel); }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function log() {
    var level = (CFG.model && CFG.model.logLevel) || 'warn';
    if (level === 'error') return;
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[L2D-Waifu]');
    (console.debug || console.log).apply(console, args);
  }

  /* 是否手机端（用于 enableOnMobile 配置） */
  function isMobileDevice() {
    try {
      var ua = navigator.userAgent || '';
      var mobileUA = /Android|iPhone|iPad|iPod|Windows Phone|Mobile/i.test(ua);
      var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      var smallScreen = window.innerWidth <= 768;
      // 移动端 UA，或「触屏 + 小屏」都视为手机端
      return mobileUA || (touch && smallScreen);
    } catch (e) {
      return false;
    }
  }

  /* 把模型缩放同步到 CSS 变量，菜单/气泡/聊天框与模型的间距会随之动态变化 */
  function applyScaleVar() {
    if (!rootEl) return;
    var scale = (CFG.model && CFG.model.scale) || 1;
    rootEl.style.setProperty('--l2d-scale', scale);
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    // 手机端开关：enableOnMobile === false 时，手机端不初始化看板娘
    if (CFG.enableOnMobile === false && isMobileDevice()) {
      log('已按配置在手机端关闭看板娘（enableOnMobile: false）');
      return;
    }
    buildDom();
    bindMenu();
    bindDrag();

    l2d = L2D.init(canvasEl);
    bindModelEvents();

    var opt = {
      path: resolvePath((CFG.model && CFG.model.path) || ''),
      scale: (CFG.model && CFG.model.scale) || 1,
      position: (CFG.model && CFG.model.position) || [0, 0],
      volume: (CFG.model && CFG.model.volume) || 0,
      logLevel: (CFG.model && CFG.model.logLevel) || 'warn'
    };
    if (opt.path) {
      l2d.load(opt).catch(function (e) {
        console.error('[L2D-Waifu] 模型加载失败：', e);
        setStatus('模型加载失败：' + e.message, 'error');
      });
    }
  }

  /* ---------------- DOM 构建 ---------------- */
  function buildDom() {
    rootEl = document.createElement('div');
    rootEl.id = ROOT_ID;
    // 把模型缩放绑定到 CSS 变量（--l2d-scale），供 UI 间距动态联动
    applyScaleVar();

    var canvasCfg = CFG.canvas || {};
    var uiCfg = CFG.ui || {};

    // 画布容器
    var box = el('div', 'l2d-waifu__box');
    canvasEl = document.createElement('canvas');
    canvasEl.className = 'l2d-waifu__canvas';
    canvasEl.width = canvasCfg.width || 300;
    canvasEl.height = canvasCfg.height || 420;
    box.appendChild(canvasEl);

    // 状态标签
    var status = el('div', 'l2d-waifu__status', '···');
    box.appendChild(status);
    ui.status = status;

    // 统一气泡（合并后的"模型回复气泡"）：
    // 思考中提示（"让我想想…"）、模型回复文字、各类状态提示都显示在这里。
    // 不再使用头顶白色气泡，减少叠框、体验更沉浸。
    var bubble = el('div', 'l2d-waifu__bubble');
    box.appendChild(bubble);
    ui.bubble = bubble;

    // 聊天面板（默认隐藏，召唤后悬浮在模型上方）
    ui.panel = buildChatPanel(uiCfg);
    // 挂在画布容器内，绝对定位在模型头顶，绝不遮挡模型
    box.appendChild(ui.panel);

    // 简要发送小框（沉浸式快速对话，默认隐藏）
    ui.quickbar = buildQuickBar();
    box.appendChild(ui.quickbar);

    // 主容器（左侧小菜单 + 看板娘）
    var wrap = el('div', 'l2d-waifu__wrap');
    // 模型左侧的小菜单（聊天/隐藏等入口）
    if (uiCfg.showMenu !== false) {
      wrap.appendChild(buildSideMenu());
    }
    wrap.appendChild(box);
    rootEl.appendChild(wrap);
    ui.wrap = wrap;
    ui.box = box;

    // 隐藏模型后的常驻召唤按钮（最右侧小圆钮，避免隐藏后无法召回）
    ui.summon = el('button', 'l2d-waifu__summon', '🙈');
    ui.summon.title = '点击召回看板娘';
    ui.summon.addEventListener('click', show);
    rootEl.appendChild(ui.summon);

    // 音效元素（用于 TTS）
    audioEl = document.createElement('audio');
    audioEl.preload = 'auto';
    rootEl.appendChild(audioEl);

    document.body.appendChild(rootEl);

    // 位置控制
    applyPosition();

    // 展开状态（默认隐藏，通过左侧菜单的「聊天」召唤）
    if (uiCfg.chatOpen === true) openChat();
  }

  /* 模型左侧的小菜单 */
  function buildSideMenu() {
    var m = el('div', 'l2d-waifu__side-menu');
    var quickBtn = '<button data-act="quickSend" title="简要发送（沉浸式小框）">📝</button>';
    // 允许通过配置关闭「简要发送」按钮
    if ((CFG.ui && CFG.ui.showQuickSend) === false) quickBtn = '';
    m.innerHTML =
      '<button data-act="chat" title="聊天框（记录历史的大框）">💬</button>' +
      quickBtn +
      '<button data-act="switchModel" title="切换模型（绑定 TTS/人设/知识库）">🔀</button>' +
      '<button data-act="toggleVoice" title="开启/关闭语音">🔊</button>' +
      '<button data-act="expression" title="随机表情">😊</button>' +
      '<button data-act="motion" title="随机动作">🎬</button>' +
      '<button data-act="home" title="返回待机">🏠</button>' +
      '<button data-act="hide" title="隐藏看板娘">🙈</button>';
    ui.sideMenu = m;
    state.menuRef = m;
    // 阻止菜单上的点击/按下事件穿透到画布（避免点击菜单时误触发模型互动）
    ['pointerdown', 'mousedown', 'click', 'touchstart'].forEach(function (evt) {
      m.addEventListener(evt, function (e) { e.stopPropagation(); });
    });
    m.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (btn) handleMenuAction(btn.dataset.act);
    });
    return m;
  }

  function buildChatPanel(uiCfg) {
    var panel = el('div', 'l2d-waifu__chat');
    // 应用配置的聊天框宽度
    if (uiCfg.chatWidth) panel.style.width = uiCfg.chatWidth + 'px';

    // 头部
    var head = el('div', 'l2d-waifu__head');
    head.innerHTML =
      '<span class="l2d-waifu__avatar">' + esc(uiCfg.avatar || '🐰') + '</span>' +
      '<span class="l2d-waifu__title">' + esc(uiCfg.title || '小理') + '</span>' +
      '<button class="l2d-waifu__toggle" title="收起/展开">▾</button>';
    panel.appendChild(head);

    // 消息区
    var msgs = el('div', 'l2d-waifu__msgs');
    panel.appendChild(msgs);
    ui.msgs = msgs;

    // 快捷提问
    var quick = el('div', 'l2d-waifu__quick');
    (CFG.chat && CFG.chat.quickReplies || []).forEach(function (t) {
      var b = el('button', 'l2d-waifu__quick-btn', esc(t));
      b.addEventListener('click', function () { send(t); });
      quick.appendChild(b);
    });
    if (quick.children.length) {
      panel.appendChild(quick);
      ui.quick = quick;
    }

    // 输入区
    var form = el('div', 'l2d-waifu__inputbar');
    form.innerHTML =
      '<input class="l2d-waifu__input" type="text" maxlength="300" ' +
      'placeholder="和 ' + esc(uiCfg.title || '小理') + ' 说点什么…" autocomplete="off" />' +
      '<button class="l2d-waifu__send">发送</button>';
    panel.appendChild(form);
    ui.input = $('.l2d-waifu__input', form);
    ui.sendBtn = $('.l2d-waifu__send', form);

    // 事件
    ui.toggle = $('.l2d-waifu__toggle', head);
    ui.toggle.addEventListener('click', toggleChat);

    // 阻止聊天面板上的按下/点击事件穿透到画布（避免点击聊天框误触发模型互动/拖拽）
    ['pointerdown', 'mousedown', 'touchstart'].forEach(function (evt) {
      panel.addEventListener(evt, function (e) { e.stopPropagation(); });
    });
    panel.addEventListener('click', function (e) { e.stopPropagation(); });

    ui.sendBtn.addEventListener('click', function () { send(); });
    ui.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') send();
    });

    return panel;
  }

  /* 简要发送小框：沉浸式快速对话（只保留一个输入框 + 发送按钮）。
     通过左侧菜单的「📝 简要发送」召唤，用完自动隐藏。 */
  function buildQuickBar() {
    var bar = el('div', 'l2d-waifu__quickbar');
    bar.innerHTML =
      '<input class="l2d-waifu__quickbar-input" type="text" maxlength="300" ' +
      'placeholder="说点什么…" autocomplete="off" />' +
      '<button class="l2d-waifu__quickbar-send" title="发送">➤</button>';
    ui.quickbarInput = $('.l2d-waifu__quickbar-input', bar);
    ui.quickbarSend = $('.l2d-waifu__quickbar-send', bar);

    // 阻止按下/点击事件穿透到画布（避免误触发模型互动/拖拽）
    ['pointerdown', 'mousedown', 'touchstart'].forEach(function (evt) {
      bar.addEventListener(evt, function (e) { e.stopPropagation(); });
    });
    bar.addEventListener('click', function (e) { e.stopPropagation(); });

    ui.quickbarSend.addEventListener('click', function () { sendQuick(); });
    ui.quickbarInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendQuick();
      if (e.key === 'Escape') hideQuickBar();
    });

    return bar;
  }

  function sendQuick() {
    if (!state.ready) return showTip('模型还没准备好，稍等一下~', 1500);
    if (state.busy || state.speaking) return showTip('正在回复中，请稍候~', 1500);
    if (state.chatLocked) return showTip('模型正在说话，稍等片刻~', 1500);

    var text = (ui.quickbarInput.value || '').trim();
    if (!text) return;
    ui.quickbarInput.value = '';
    hideQuickBar();
    send(text);
  }

  function openQuickBar() {
    // 与完整聊天框互斥，避免叠框
    if (ui.panel.classList.contains('open')) closeChat();
    ui.quickbar.classList.add('open');
    if (ui.box) ui.box.classList.add('quickbar-open');
    hideTip();
    ui.quickbarInput.focus();
  }
  function hideQuickBar() {
    ui.quickbar.classList.remove('open');
    if (ui.box) ui.box.classList.remove('quickbar-open');
  }
  function toggleQuickBar() {
    if (ui.quickbar.classList.contains('open')) hideQuickBar(); else openQuickBar();
  }

  /* ---------------- 布局 ---------------- */
  function applyPosition() {
    var c = CFG.canvas || {};
    var pos = c.position || 'bottom-right';
    var elStyle = rootEl.style;
    elStyle.zIndex = c.zIndex || 99999;
    var offX = c.offsetX || 20;
    var offY = c.offsetY || 20;

    if (pos === 'bottom-left') {
      elStyle.left = offX + 'px';
      elStyle.right = 'auto';
    } else {
      elStyle.right = offX + 'px';
      elStyle.left = 'auto';
    }
    elStyle.bottom = offY + 'px';
    elStyle.top = 'auto';
  }

  /* ---------------- 拖拽 ---------------- */
  // 获取当前画布节点（l2d 内部可能替换过 canvas，动态查询更可靠）
  function currentCanvas() {
    if (ui.box) {
      var c = ui.box.querySelector('canvas.l2d-waifu__canvas');
      if (c) return c;
    }
    return canvasEl;
  }

  function isPointerOverCanvas(e) {
    // 只有按下落在画布上才算"点模型"；菜单/聊天面板虽也在 box 内，
    // 但它们已 stopPropagation，且 target 不在 canvas 内，不会误判为点模型。
    var c = currentCanvas();
    if (e && e.target && c && (e.target === c || c.contains(e.target))) return true;
    return false;
  }

  function bindDrag() {
    if (!CFG.draggable) return;
    var box = ui.box;
    box.classList.add('l2d-waifu__draggable');

    function onPointerDown(e) {
      var onCanvas = isPointerOverCanvas(e);
      // 记录本次按下是否发生在画布上；若否，则后续 pointermove/pointerup 都不会触发拖拽与互动
      state.pointerOnCanvas = onCanvas;
      if (!onCanvas) return;
      state.drag = {
        startX: e.clientX,
        startY: e.clientY,
        origX: parseFloat(rootEl.style.left) || 0,
        origY: parseFloat(rootEl.style.bottom) || 0,
        moved: false,
        pointerId: e.pointerId
      };
      box.setPointerCapture && box.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
      if (!state.drag || !state.pointerOnCanvas) return;
      var dx = e.clientX - state.drag.startX;
      var dy = e.clientY - state.drag.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) state.drag.moved = true;

      rootEl.style.left = (state.drag.origX + dx) + 'px';
      rootEl.style.bottom = (state.drag.origY - dy) + 'px';
    }

    function onPointerUp() {
      if (state.drag && state.pointerOnCanvas) {
        var moved = state.drag.moved;
        state.drag = null;
        // 拖拽结束后随机一个拖拽动作（若有）
        if (moved && l2d && state.ready) {
          var g = firstMatchingGroup(['touch_drag', 'drag']);
          if (g) l2d.playMotion(g, undefined, 2);
        }
      }
      state.drag = null;
      // 注意：不在此处重置 pointerOnCanvas。
      // Cubism2 模型的 tap 走 click 事件（在 pointerup 之后），
      // 需要保留本次按下的画布标记供 tap 判断；下一次 pointerdown 会覆盖它。
    }
    function onPointerCancel() {
      state.drag = null;
    }

    box.addEventListener('pointerdown', onPointerDown);
    box.addEventListener('pointermove', onPointerMove);
    box.addEventListener('pointerup', onPointerUp);
    box.addEventListener('pointercancel', onPointerCancel);

    // 监听器统一挂在 box 上（事件委托），l2d 库内部替换 canvas 节点时不受影响
  }

  /* ---------------- 模型事件 ---------------- */
  function bindModelEvents() {
    l2d.on('loadstart', function (total) {
      setStatus('加载模型 (0/' + total + ')');
    });
    l2d.on('loadprogress', function (loaded, total) {
      setStatus('加载模型 (' + loaded + '/' + total + ')');
    });
    l2d.on('loaded', function () {
      state.ready = true;
      initVolume();
      autoDetectMouthParam();
      loadSoundGroups();
      setStatus(idleStatusText());
      welcome();
      playIdle();
      if (typeof CFG.onReady === 'function') CFG.onReady(l2d);
    });

    l2d.on('tap', function (areaName) {
      onTapArea(areaName);
    });

    l2d.on('motionstart', function (group) {
      log('动作开始:', group);
      // 若该动作组内的动作带模型语音，则播放期间锁定聊天框。
      // 对话输出期间（state.busy）由对话流程统一管理，不在此加锁，
      // 避免情绪动作触发"解锁过早"或与 TTS 状态互相覆盖。
      var hasSound = motionHasSound(group);
      if (hasSound && !state.busy) {
        state.modelVoice = true;
        lockChat(true, '🔊 模型语音中');
      }
    });

    l2d.on('motionend', function (group) {
      log('动作结束:', group);
      if (state.modelVoice && !state.busy) {
        state.modelVoice = false;
        // 回到待机后解锁
        lockChat(false);
        playIdle(true);
      }
    });
  }

  function initVolume() {
    var v = (CFG.model && CFG.model.volume) || 0;
    // 浏览器自动播放策略：首次用户交互后再真正开启音量
    var unlock = function () {
      if (state.vol > 0) return;
      state.vol = v;
      if (l2d) l2d.setVolume(v);
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
  }

  /* ---------------- 状态与统一气泡 ---------------- */
  function setStatus(text, kind) {
    if (!ui.status) return;
    ui.status.textContent = text || '';
    ui.status.className = 'l2d-waifu__status' + (kind ? ' l2d-waifu__status--' + kind : '');
  }

  /* 统一气泡（合并后的"模型回复气泡"）：
     思考中提示（"让我想想…"）、模型回复文字、各类状态提示都显示在这里。
     不再使用头顶白色气泡，减少叠框、更沉浸。 */
  function showTip(text, ms) {
    var tip = ui.bubble;
    if (!tip) return;
    // 大聊天框/简要发送框展开时，统一气泡让位不显示，避免叠框
    if (ui.panel.classList.contains('open') || ui.quickbar.classList.contains('open')) return;
    tip.textContent = text || '';
    tip.classList.add('show');
    clearTimeout(showTip._t);
    if (ms) showTip._t = setTimeout(function () { hideTip(); }, ms);
  }
  function hideTip() {
    if (ui.bubble) ui.bubble.classList.remove('show');
  }

  /* ---------------- 聊天 UI ---------------- */
  function addMsg(role, text) {
    var row = el('div', 'l2d-waifu__msg l2d-waifu__msg--' + role);
    var bubble = el('div', 'l2d-waifu__msg-bubble');
    bubble.textContent = text;
    row.appendChild(bubble);
    ui.msgs.appendChild(row);
    ui.msgs.scrollTop = ui.msgs.scrollHeight;
    return bubble;
  }

  function typeText(bubbleEl, text, speed, done) {
    var i = 0;
    bubbleEl.textContent = '';
    var timer = setInterval(function () {
      i++;
      bubbleEl.textContent = text.slice(0, i);
      ui.msgs.scrollTop = ui.msgs.scrollHeight;
      if (i >= text.length) {
        clearInterval(timer);
        if (done) done();
      }
    }, speed || 30);
  }

  function addThinking() {
    var row = el('div', 'l2d-waifu__msg l2d-waifu__msg--ai');
    row.innerHTML = '<div class="l2d-waifu__msg-bubble l2d-waifu__thinking"><span></span><span></span><span></span></div>';
    ui.msgs.appendChild(row);
    ui.msgs.scrollTop = ui.msgs.scrollHeight;
    return row;
  }

  function openChat() {
    // 与简要发送小框互斥，避免叠框
    if (ui.quickbar.classList.contains('open')) hideQuickBar();
    // 聊天面板悬浮在模型上方，避免超出视口顶部
    var panel = ui.panel;
    panel.classList.add('open');
    // 标记聊天框已展开：隐藏统一气泡，避免叠框
    if (ui.box) ui.box.classList.add('chat-open');
    hideTip();
    ui.toggle.textContent = '▾';
    // 若面板会超出视口顶部，则自动改为悬浮在模型下方（bottom:auto + top）
    var maxH = Math.max(120, Math.min(400, window.innerHeight - 200));
    panel.style.maxHeight = maxH + 'px';
    var msgs = ui.msgs;
    if (msgs) msgs.style.maxHeight = (maxH - 130) + 'px';
    setTimeout(function () {
      // 测量面板位置：顶部越界则翻转到模型下方
      var r = panel.getBoundingClientRect();
      if (r.top < 8) {
        panel.classList.add('below');
      } else {
        panel.classList.remove('below');
      }
      ui.msgs.scrollTop = ui.msgs.scrollHeight;
      if (ui.input) ui.input.focus();
    }, 60);
  }
  function closeChat() {
    ui.panel.classList.remove('open');
    if (ui.box) ui.box.classList.remove('chat-open');
    ui.toggle.textContent = '▴';
  }
  function toggleChat() {
    if (ui.panel.classList.contains('open')) closeChat(); else openChat();
  }

  /* ---------------- 聊天锁定（模型语音期间） ---------------- */
  function setChatEnabled(flag, reason) {
    ui.input.disabled = !flag;
    ui.sendBtn.disabled = !flag;
    if (!flag) {
      ui.input.placeholder = reason || '暂时无法输入…';
    } else {
      ui.input.placeholder = '和 ' + esc((CFG.ui && CFG.ui.title) || '小理') + ' 说点什么…';
    }
  }

  function lockChat(lock, reason) {
    state.chatLocked = lock;
    setChatEnabled(!lock, reason);
    if (lock) {
      setStatus('🔊 模型语音中');
      showTip(reason || '🔊 模型语音中', 0);
    } else {
      setStatus(idleStatusText());
      hideTip();
    }
  }

  /* ---------------- 菜单动作（左侧小菜单 + 兼容外部调用） ---------------- */
  function bindMenu() {
    // 兼容旧版：聊天面板内若仍有菜单，也统一走 handleMenuAction
    if (ui.menu) {
      ui.menu.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act]');
        if (btn) handleMenuAction(btn.dataset.act);
      });
    }
  }

  function handleMenuAction(act) {
    switch (act) {
      case 'chat':
        // 点击「聊天」→ 召唤完整聊天框（记录历史的大框）
        if (ui.panel.classList.contains('open')) closeChat(); else openChat();
        break;
      case 'quickSend':
        // 点击「简要发送」→ 召唤沉浸式小框（只发消息，不占大框）
        toggleQuickBar();
        break;
      case 'toggleVoice':
        if (state.vol > 0) { state.vol = 0; l2d.setVolume(0); showTip('🔇 语音已关闭', 1500); }
        else {
          state.vol = (CFG.model && CFG.model.volume) || 0.9;
          l2d.setVolume(state.vol);
          showTip('🔊 语音已开启', 1500);
        }
        break;
      case 'switchModel':
        // 弹出模型切换面板（绑定提供方/音色/人设/知识库）
        showModelSwitcher();
        break;
      case 'expression':
        if (!state.ready) return;
        setRandomExpression();
        break;
      case 'motion':
        if (!state.ready) return;
        playRandomMotion();
        break;
      case 'home':
        if (!state.ready) return;
        stopEverything();
        break;
      case 'hide':
        hide();
        break;
    }
  }

  function stopEverything() {
    if (state.busy) return showTip('正在说话中，稍等片刻~', 1200);
    stopTts();
    restoreModelVoice();
    hideTip();
    ui.msgs.innerHTML = '';
    playIdle();
    showTip('已回到待机～ 🏠', 1200);
  }

  /* ---------------- 隐藏 / 显示 ---------------- */
  // 记录当前画布的固有尺寸（l2d 内部替换 canvas 后仍有效）
  var canvasW = (CFG.canvas && CFG.canvas.width) || 300;
  var canvasH = (CFG.canvas && CFG.canvas.height) || 420;

  function hide() {
    // 隐藏看板娘本体（画布+左侧菜单）。
    // 注意：这里用 visibility:hidden 而不是 display:none——
    // display:none 会让 canvas 的 clientWidth/Height 变为 0，
    // 触发 l2d 的 ResizeObserver 把画布尺寸重置为 0，破坏 WebGL 绘制缓冲，
    // 重新显示后模型就会"上半身缺失、只剩腿"。
    // visibility:hidden 不影响布局尺寸，可彻底避免该问题，且同样不可点击。
    ui.wrap.style.visibility = 'hidden';
    state._canvasWasHidden = true;
    // 聊天面板与简要发送框随之隐藏
    closeChat();
    hideQuickBar();
    hideTip();
    // 常驻召唤按钮保留在右下角，随时可召回
    ui.summon.classList.add('show');
    showTip('看板娘已隐藏，点击右下角 🙈 召唤回来', 2000);
  }

  function show() {
    ui.wrap.style.visibility = 'visible';
    ui.summon.classList.remove('show');

    // 双保险：若隐藏期间画布尺寸被意外清为 0，恢复后强制重置并重算投影，
    // 确保模型完整显示。
    try {
      var cvs = currentCanvas();
      if (cvs) {
        var needReset = false;
        if (!cvs.width || !cvs.height || cvs.clientWidth === 0 || cvs.clientHeight === 0) {
          cvs.width = canvasW;
          cvs.height = canvasH;
          needReset = true;
        }
        if (needReset || state._canvasWasHidden) {
          requestAnimationFrame(function () {
            try {
              var cc = currentCanvas();
              if (cc && (!cc.width || !cc.height)) {
                cc.width = canvasW;
                cc.height = canvasH;
              }
              if (typeof l2d.resize === 'function') l2d.resize();
            } catch (e) { log('显示时重算模型投影失败：', e && e.message); }
          });
          requestAnimationFrame(function () {
            try {
              var cc = currentCanvas();
              if (cc && (cc.clientWidth === 0 || cc.clientHeight === 0)) {
                cc.width = canvasW;
                cc.height = canvasH;
              }
              if (typeof l2d.resize === 'function') l2d.resize();
            } catch (e) { log('显示时重算模型投影失败(2)：', e && e.message); }
          });
        }
        state._canvasWasHidden = false;
      }
    } catch (e) {
      log('显示看板娘时出错：', e && e.message);
    }
  }

  /* ---------------- 情绪识别 ---------------- */
  var EMOTION_TAGS = ['happy', 'sad', 'angry', 'surprise', 'shy', 'neutral'];
  var KEYWORD_RULES = [
    { tag: 'angry',   words: ['生气', '愤怒', '气死', '讨厌', '滚', '怒', '😡', '💢', '妈的', '烦死', '恨'] },
    { tag: 'sad',     words: ['难过', '伤心', '哭了', '想哭', '委屈', '失落', '孤独', '呜呜', '😭', '😢', '沮丧', 'emo'] },
    { tag: 'surprise', words: ['哇', '居然', '真的吗', '震惊', '天哪', '卧槽', '不会吧', '吓', '😱', '🤯', '没想到'] },
    { tag: 'shy',     words: ['害羞', '脸红', '喜欢你', '爱你', '么么', '亲亲', '🤭', '😳', '心动', '约会'] },
    { tag: 'happy',   words: ['开心', '高兴', '哈哈', '嘿嘿', '嘻嘻', '好玩', '棒', '太棒', '🎉', '😄', '😆', '快乐', '哈哈哈哈哈'] }
  ];

  function detectEmotionByKeyword(text) {
    for (var i = 0; i < KEYWORD_RULES.length; i++) {
      var rule = KEYWORD_RULES[i];
      for (var j = 0; j < rule.words.length; j++) {
        if (text.indexOf(rule.words[j]) !== -1) return rule.tag;
      }
    }
    return 'neutral';
  }

  function extractEmotion(reply) {
    // 兼容多种格式：
    //   #EMOTION#happy\n回复...   （提示词协议）
    //   #happy\n回复...           （模型自由发挥）
    //   #EMOTION# happy           （标签后带空格）
    //   #EMOTION#: happy          （带冒号）
    var m = reply.match(/^\s*#\s*(?:EMOTION\s*#?\s*:?\s*)?([a-z]+)\s*[\n\r]/i);
    if (m && EMOTION_TAGS.indexOf(m[1].toLowerCase()) !== -1) {
      return { tag: m[1].toLowerCase(), text: reply.replace(/^\s*#\s*(?:EMOTION\s*#?\s*:?\s*)?[a-z]+\s*[\n\r]+/i, '').trim() };
    }
    // 行内形式：#EMOTION#happy 回复...  /  #EMOTION# happy 回复...  /  #happy 回复...
    var m2 = reply.match(/#\s*(?:EMOTION\s*#?\s*:?\s*)?([a-z]+)\b/i);
    if (m2 && EMOTION_TAGS.indexOf(m2[1].toLowerCase()) !== -1) {
      var tag = m2[1].toLowerCase();
      var t2 = reply.replace(/#\s*(?:EMOTION\s*#?\s*:?\s*)?[a-z]+\b/i, '').replace(/^[\s:：]+/, '').trim();
      return { tag: tag, text: t2 };
    }
    // 中文情绪词兜底（部分大模型会返回中文心情词）
    var zh = {
      '开心': 'happy', '高兴': 'happy', '兴奋': 'happy', '愉快': 'happy', '哈哈': 'happy', '快乐': 'happy',
      '难过': 'sad', '伤心': 'sad', '悲伤': 'sad', '委屈': 'sad', '失落': 'sad', '沮丧': 'sad',
      '生气': 'angry', '愤怒': 'angry', '恼怒': 'angry', '不爽': 'angry',
      '惊讶': 'surprise', '震惊': 'surprise', '意外': 'surprise', '惊喜': 'surprise',
      '害羞': 'shy', '羞涩': 'shy', '脸红': 'shy', '心动': 'shy'
    };
    for (var k in zh) {
      if (reply.indexOf(k) !== -1) {
        var tagZh = zh[k];
        var tZh = reply.replace(new RegExp('#\\s*(?:EMOTION\\s*#?\\s*:?\\s*)?[^#\n]*', 'i'), '').replace(/^[\s:：]+/, '').trim();
        return { tag: tagZh, text: tZh || reply };
      }
    }
    return null;
  }

  function applyEmotion(tag, tip, silent) {
    if (!CFG.emotion || CFG.emotion.enable === false) tag = 'neutral';
    // 优先使用当前绑定模型自己的情绪映射表；未配置则回退全局 watcher.emotion.map
    var curMap = null;
    var b = currentBinding();
    if (b && b.emotionMap) curMap = b.emotionMap;
    var map = (CFG.emotion && CFG.emotion.map) || {};
    if (curMap) map = curMap;
    var conf = map[tag] || map.neutral || {};
    var motionGroup = conf.motion;
    var t = conf.tip || tip;

    // 匹配动作组
    var group = null;
    if (motionGroup) {
      group = firstMatchingGroup(String(motionGroup).split(' '));
    }
    if (!group) group = pickEmotionGroupByTag(tag);
    if (!group) group = 'Idle';

    // 对话流程（silent=true）中：
    // 优先选择不带自带语音的动作组；若情绪动作组都带语音，
    // 则临时静音模型自带语音，让动作照常播放、但绝不会与 TTS 一起输出语音。
    if (silent && (CFG.interact && CFG.interact.silentEmotionDuringChat) !== false) {
      var chosen = pickEmotionGroupByTag(tag, true);
      if (chosen) group = chosen;
      if (motionHasSound(group)) {
        log('情绪 →', tag, '：目标动作带自带语音，对话中临时静音模型语音避免与 TTS 冲突');
        muteModelVoice();
      }
    }

    if (state.ready && l2d) l2d.playMotion(group, undefined, 4);

    // 气泡
    if (t) showTip(t, 2500);
    log('情绪 →', tag, '动作 →', group);
  }

  /* 临时静音模型自带语音（对话输出期间防止与 TTS 一起响） */
  function muteModelVoice() {
    if (state._modelVoiceMuted) return;
    if (!l2d) return;
    l2d.setVolume(0);
    state._modelVoiceMuted = true;
  }
  function restoreModelVoice() {
    if (!state._modelVoiceMuted) return;
    if (l2d) l2d.setVolume(state.vol);
    state._modelVoiceMuted = false;
  }

  function pickEmotionGroupByTag(tag, skipSound) {
    // 依据模型动作组名智能匹配情绪关键词
    if (!state.ready) return null;
    var groups = Object.keys(l2d.getMotions() || {});
    var aliases = {
      happy: ['idle', 'tap', 'special', 'menu'],
      sad: ['special', 'select', 'tap'],
      angry: ['head', 'special', 'tap'],
      surprise: ['select', 'special', 'tap'],
      shy: ['blush', 'menu', 'special'],
      neutral: ['idle']
    };
    var words = aliases[tag] || aliases.neutral;
    for (var i = 0; i < words.length; i++) {
      for (var j = 0; j < groups.length; j++) {
        if (groups[j].toLowerCase().indexOf(words[i]) !== -1) {
          if (skipSound && motionHasSound(groups[j])) continue;
          return groups[j];
        }
      }
    }
    return null;
  }

  function firstMatchingGroup(candidates) {
    if (!state.ready || !l2d) return null;
    var groups = Object.keys(l2d.getMotions() || {});
    if (!groups.length) return null;
    if (!candidates || !candidates.length) return groups[0];
    for (var i = 0; i < candidates.length; i++) {
      for (var j = 0; j < groups.length; j++) {
        if (groups[j].toLowerCase() === String(candidates[i]).toLowerCase()) return groups[j];
      }
    }
    // 模糊匹配
    for (var k = 0; k < candidates.length; k++) {
      for (var m = 0; m < groups.length; m++) {
        if (groups[m].toLowerCase().indexOf(String(candidates[k]).toLowerCase()) !== -1) return groups[m];
      }
    }
    return null;
  }

  /* ---------------- 动作 / 表情 ---------------- */
  function idleStatusText() {
    if (state.modelVoice) return '🔊 模型语音中';
    if (state.speaking) return (CFG.ui && CFG.ui.statusText && CFG.ui.statusText.speaking) || '语音播放中…';
    return (CFG.ui && CFG.ui.statusText && CFG.ui.statusText.idle) || '待机中';
  }

  function playIdle(force) {
    if (!state.ready || state.busy || state.speaking || state.modelVoice) {
      if (state.modelVoice) return;
      return;
    }
    var group = firstMatchingGroup(['idle']);
    if (!group) group = pickRandomGroup();
    if (group && group !== state.lastMotionGroup) {
      state.lastMotionGroup = group;
      l2d.playMotion(group, undefined, 1);
    }
  }

  function playRandomMotion() {
    if (!state.ready) return;
    var g = pickRandomGroup();
    if (g) l2d.playMotion(g, undefined, 3);
    showTip('随机动作：' + g, 1200);
  }

  function pickRandomGroup() {
    var groups = Object.keys(l2d.getMotions() || {});
    var safe = groups.filter(function (g) {
      var s = g.toLowerCase();
      return s.indexOf('idle') === -1;
    });
    var pool = safe.length ? safe : groups;
    return pool.length ? pick(pool) : null;
  }

  function setRandomExpression() {
    var exps = l2d.getExpressions() || [];
    if (!exps.length) { showTip('该模型没有表情 😅', 1200); return; }
    var e = pick(exps);
    l2d.setExpression(e);
    showTip('表情：' + e, 1500);
  }

  /*
   * 加载模型 JSON，找出"播放时会带自带语音"的动作组（用于锁定聊天框防冲突）。
   * 兼容 Cubism 2（motions[].sound）与 Cubism 6（Motions[].Sound）。
   */
  function loadSoundGroups() {
    var path = resolvePath((CFG.model && CFG.model.path) || '');
    if (!path) return;
    var url = path;
    try { url = new URL(path, location.href).href; } catch (e) {}

    fetch(url, { method: 'GET' })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data) return;
        var groups = {};
        var motions = data.FileReferences && data.FileReferences.Motions;
        if (motions) {
          // Cubism 6
          Object.keys(motions).forEach(function (g) {
            var has = (motions[g] || []).some(function (m) { return m && m.Sound; });
            if (has) groups[g.toLowerCase()] = true;
          });
        } else if (data.motions) {
          // Cubism 2
          Object.keys(data.motions).forEach(function (g) {
            var has = (data.motions[g] || []).some(function (m) { return m && m.sound; });
            if (has) groups[g.toLowerCase()] = true;
          });
        }
        state.soundGroups = groups;
        log('带自带语音的动作组：', Object.keys(groups).join(', ') || '无');
      })
      .catch(function (e) { log('读取模型 JSON 失败（不影响主功能）：', e.message); });
  }

  function motionHasSound(group) {
    if (!group) return false;
    if (state.soundGroups[String(group).toLowerCase()]) return true;
    return false;
  }

  /* ---------------- 点击互动 ---------------- */
  function onTapArea(areaName) {
    log('点击区域:', areaName);
    if (!state.ready) return;
    if (state.busy || state.speaking || state.modelVoice) {
      showTip('正忙着呢，等我一下下~ 🙏', 1200);
      return;
    }

    // 误触防护：本次按下若明确不在画布上（点击菜单/聊天框等穿透），不触发模型互动。
    // 拖拽未启用时 pointerOnCanvas 为 null，此时放行正常点击。
    if (state.pointerOnCanvas === false) {
      log('点击区域:', areaName, '（非画布按下，已忽略，防止误触发互动）');
      return;
    }

    var hitMap = (CFG.interact && CFG.interact.hitAreaMotions) || {};
    var group = null;
    if (areaName && hitMap[areaName]) group = hitMap[areaName];

    if (!group && areaName) {
      // 按名称模糊匹配
      var groups = Object.keys(l2d.getMotions() || {});
      for (var i = 0; i < groups.length; i++) {
        if (groups[i].toLowerCase().indexOf(areaName.toLowerCase()) !== -1) {
          group = groups[i];
          break;
        }
      }
    }
    if (!group) {
      // 点击无命中区域 / 空白 → 随机动作（模仿 Live2D Viewer EX）
      if (CFG.clickRandomAction !== false) {
        playRandomMotion();
        setRandomExpression();
      }
      return;
    }
    var matched = firstMatchingGroup([group]);
    if (matched) {
      l2d.playMotion(matched, undefined, 3);
      showTip('摸到了~ 😆', 1600);
    }
  }

  /* ---------------- 模型切换（绑定） ---------------- */
  // 模型切换面板 DOM
  var modelSwitcherEl = null;
  var modelSwitcherMask = null;

  function currentBinding() {
    var list = CFG.bindings || [];
    if (!state.bindingId) return null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === state.bindingId) return list[i];
    }
    return null;
  }

  /* 构建当前生效的 chat/tts 配置（考虑绑定级联） */
  function effectiveChatCfg() {
    var b = currentBinding();
    if (b && b.chat) return b.chat;
    return CFG.chat || {};
  }
  function effectiveTtsCfg() {
    var b = currentBinding();
    if (b && b.tts) return b.tts;
    return CFG.tts || {};
  }
  function effectiveSystemPrompt() {
    var b = currentBinding();
    if (b && b.systemPrompt) return b.systemPrompt;
    return (CFG.chat && CFG.chat.systemPrompt) || '';
  }

  function showModelSwitcher() {
    if (modelSwitcherEl) hideModelSwitcher();
    var list = CFG.modelList || CFG.bindings || [];
    if (!list.length) {
      return showTip('后台未配置可切换的模型绑定', 2000);
    }

    modelSwitcherMask = el('div', 'l2d-waifu__model-mask');
    var panel = el('div', 'l2d-waifu__model-switcher');
    panel.innerHTML =
      '<div class="l2d-waifu__model-title">🎭 切换模型</div>' +
      '<div class="l2d-waifu__model-list">' +
      list.map(function (b) {
        var on = b.id === state.bindingId;
        return '<button class="l2d-waifu__model-item' + (on ? ' active' : '') + '" data-id="' + esc(b.id) + '">' +
          esc(b.name || b.modelPath) + (on ? ' ✓' : '') +
          '</button>';
      }).join('') +
      '</div>' +
      '<button class="l2d-waifu__model-close">✕ 关闭</button>';
    modelSwitcherMask.appendChild(panel);
    document.body.appendChild(modelSwitcherMask);

    var items = panel.querySelectorAll('.l2d-waifu__model-item');
    Array.prototype.forEach.call(items, function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        switchModel(id);
        hideModelSwitcher();
      });
    });
    panel.querySelector('.l2d-waifu__model-close').addEventListener('click', hideModelSwitcher);
    modelSwitcherMask.addEventListener('click', function (e) {
      if (e.target === modelSwitcherMask) hideModelSwitcher();
    });
  }

  function hideModelSwitcher() {
    if (modelSwitcherMask && modelSwitcherMask.parentNode) {
      modelSwitcherMask.parentNode.removeChild(modelSwitcherMask);
    }
    modelSwitcherMask = null;
    modelSwitcherEl = null;
  }

  /* 切换模型：加载新模型 + 切换绑定（TTS/文字/音色/人设/知识库） */
  function switchModel(bindingId) {
    if (state.busy || state.speaking) return showTip('正在说话中，稍等一下~', 1200);
    var list = CFG.bindings || [];
    var b = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === bindingId) { b = list[i]; break; }
    }
    if (!b || !b.modelPath) return showTip('该绑定缺少模型路径', 2000);

    stopTts();
    closeChat();
    hideQuickBar();
    hideTip();
    state.bindingId = bindingId;
    state.history = [];
    state.ready = false;
    setStatus('加载模型中…');

    // 更新 chat/tts 为绑定指定的提供方（后续请求直接带 bindingId）
    if (b.chat) CFG.chat = b.chat;
    if (b.tts) CFG.tts = b.tts;

    // 更新 UI 名字/头像
    if (b.personality && b.personality.name) {
      if (CFG.ui) { CFG.ui.title = b.personality.name; CFG.ui.avatar = b.personality.avatar || CFG.ui.avatar; }
    }

    // 重新加载 Live2D 模型
    var opt = {
      path: resolvePath(b.modelPath),
      scale: (CFG.model && CFG.model.scale) || 1,
      position: (CFG.model && CFG.model.position) || [0, 0],
      volume: (CFG.model && CFG.model.volume) || 0,
      logLevel: (CFG.model && CFG.model.logLevel) || 'warn'
    };
    if (typeof l2d.load === 'function') {
      l2d.load(opt).catch(function (e) {
        console.error('[L2D-Waifu] 切换模型失败：', e);
        setStatus('模型加载失败：' + (e && e.message), 'error');
        state.ready = true;
      });
    } else {
      setStatus('当前 l2d 库不支持热切换模型', 'error');
    }
    showTip('已切换为「' + esc(b.name || b.modelPath) + '」', 2000);
  }

  /* ---------------- 对话流程 ---------------- */
  function send(text) {
    if (!state.ready) return showTip('模型还没准备好，稍等一下~', 1500);
    if (state.busy || state.speaking) return showTip('正在回复中，请稍候~', 1500);
    if (state.chatLocked) return showTip('模型正在说话，稍等片刻~', 1500);

    var input = ui.input.value.trim();
    text = (text || input || '').trim();
    if (!text) return;

    ui.input.value = '';
    addMsg('user', text);

    var thinkingRow = addThinking();
    state.busy = true;
    setChatEnabled(false, '思考中…');
    setStatus((CFG.ui && CFG.ui.statusText && CFG.ui.statusText.thinking) || '思考中…');

    // 思考中动作
    thinkingMotion();

    callChat(text)
      .then(function (rawReply) {
        // 解析情绪
        var emotion = extractEmotion(rawReply);
        var replyText = emotion ? emotion.text : rawReply;
        if (!replyText) replyText = rawReply;

        var detection = (CFG.emotion && CFG.emotion.detection) || 'prompt';
        var tag = 'neutral';
        if (emotion) tag = emotion.tag;
        else if (detection === 'keyword') tag = detectEmotionByKeyword(text + ' ' + replyText);
        else {
          // prompt 模式下大模型偶尔漏打 #EMOTION# 标签：
          // 结合用户输入 + 回复内容做关键词兜底，避免"判断不出情绪/不做动作"。
          tag = detectEmotionByKeyword(text + ' ' + replyText) || 'neutral';
        }

        // 先记入对话历史（即使语音失败也不丢上下文）
        pushHistory(text, replyText);

        // 语音生成完毕（含失败降级）后，文字与语音再同时输出
        var voiceReady = Promise.resolve(null);
        if (ttsEnabled()) {
          voiceReady = callTts(replyText).catch(function (err) {
            console.error('[L2D-Waifu] TTS 失败：', err);
            return null;
          });
        }

        return voiceReady.then(function (audioUrl) {
          // 语音已就绪：此刻才展示文字 + 播放语音（同时输出）
          thinkingRow.remove();
          var bubble = addMsg('ai', '');
          typeText(bubble, replyText, 28, function () {
            log('文字输出完成');
          });

          // 情绪动作（silent=true：对话中绝不播放带自带语音的动作，避免与 TTS 一起输出）
          if (CFG.emotion && CFG.emotion.enable !== false) {
            applyEmotion(tag, null, true);
          }

          // 语音与文字同步开始
          if (audioUrl) {
            return playTts(audioUrl, replyText, tag).then(function () {
              return finish();
            });
          }
          return finish();
        });
      })
      .catch(function (err) {
        console.error('[L2D-Waifu] Chat 失败：', err);
        thinkingRow.remove();
        addMsg('ai', '啊呀，我这边好像开小差了…（' + esc(err.message) + '）');
        return finish();
      });

    function finish() {
      state.busy = false;
      restoreModelVoice();
      setChatEnabled(!state.chatLocked);
      setStatus(idleStatusText());
      playIdle(true);
      return null;
    }
  }

  function pushHistory(user, assistant) {
    var h = state.history;
    h.push({ role: 'user', content: user });
    h.push({ role: 'assistant', content: assistant });
    var size = (CFG.chat && CFG.chat.historySize) || 8;
    while (h.length > size * 2) h.shift();
  }

  function thinkingMotion() {
    if (!state.ready) return;
    var thinking = (CFG.emotion && CFG.emotion.thinking) || {};
    var m = thinking.motion;
    var group = null;
    if (m) group = firstMatchingGroup(String(m).split(' '));
    if (!group) group = firstMatchingGroup(['thinking', 'think']);
    if (!group) group = firstMatchingGroup(['idle']);
    if (group) l2d.playMotion(group, undefined, 3);
    if (thinking.tip) showTip(thinking.tip, 0);
  }

  function ttsEnabled() {
    var cfg = effectiveTtsCfg() || CFG.tts || {};
    return !!(cfg && cfg.enabled && cfg.api);
  }

  /* ---------------- API 调用 ---------------- */
  function callChat(userText) {
    var cfg = effectiveChatCfg() || CFG.chat || {};
    var sys = cfg.systemPrompt || effectiveSystemPrompt() ||
      '你是可爱的 Live2D 看板娘，回答简洁生动，使用中文，控制在 2 句话内。';

    var messages = [{ role: 'system', content: sys }];
    for (var i = 0; i < state.history.length; i++) messages.push(state.history[i]);
    messages.push({ role: 'user', content: userText });

    var body = {
      messages: messages,
      temperature: cfg.temperature != null ? cfg.temperature : 0.7
    };
    if (cfg.model) body.model = cfg.model;
    if (state.bindingId) body.bindingId = state.bindingId;

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, cfg.timeout || 60000);

    return fetch(cfg.api, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, cfg.headers || {}),
      body: JSON.stringify(body),
      signal: ctrl.signal
    })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('Chat HTTP ' + res.status);
        return res.json().catch(function () { return {}; });
      })
      .then(function (data) {
        log('Chat 返回：', data);
        return extractReply(data);
      });
  }

  function extractReply(data) {
    if (!data) return '';
    return data.reply
      || data.answer
      || data.content
      || data.text
      || (data.data && (data.data.reply || data.data.answer || data.data.content || data.data.text))
      || (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
      || (data.choices && data.choices[0] && data.choices[0].text)
      || (data.output && data.output.text)
      || JSON.stringify(data);
  }

  function callTts(text) {
    var cfg = effectiveTtsCfg() || CFG.tts || {};
    // 清洗文本：去掉标签行/特殊前缀，压缩换行（部分 TTS 接口对 # 与换行敏感）
    var clean = String(text || '')
      .replace(/^\s*#[^\n]*[\n\r]+/g, '')   // 去掉 #xxx 标签行
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    if (!clean) clean = '嗯嗯，我在听~';

    var params = Object.assign({ text: clean }, cfg.extraParams || {});
    if (cfg.voice) params.voice = cfg.voice;
    if (state.bindingId) params.bindingId = state.bindingId;
    var url = cfg.api + '?' + Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 30000);

    return fetch(url, { signal: ctrl.signal, method: 'GET' })
      .then(function (res) {
        clearTimeout(timer);
        if (!res.ok) throw new Error('TTS HTTP ' + res.status);
        var ct = res.headers.get('content-type') || '';
        if (ct.indexOf('audio') !== -1 || ct.indexOf('octet-stream') !== -1 || ct.indexOf('wav') !== -1 || ct.indexOf('mpeg') !== -1) {
          return res.blob().then(function (blob) {
            return URL.createObjectURL(blob);
          });
        }
        // JSON 返回
        return res.json().catch(function () { return {}; }).then(function (data) {
          log('TTS 返回：', data);
          var d = data && data.data ? data.data : (data || {});
          if (d.audio_data_url) return d.audio_data_url;
          if (d.audio_url) return d.audio_url;
          if (d.url) return d.url;
          if (d.audio) {
            if (/^data:/i.test(d.audio)) return d.audio;
            if (/^https?:/i.test(d.audio)) return d.audio;
            return 'data:audio/mpeg;base64,' + d.audio;
          }
          throw new Error('TTS 返回中未找到音频字段');
        });
      });
  }

  /* ---------------- 口型同步 ---------------- */
  function autoDetectMouthParam() {
    if (mouthParam) return;
    try {
      var params = l2d.getParams() || [];
      var candidates = ['ParamMouthOpenY', 'PARAM_MOUTH_OPEN_Y', 'ParamMouthOpen', 'MouthOpen', 'PARAM_MOUTH_OPEN', 'ParamA', 'PARAM_A'];
      for (var i = 0; i < candidates.length; i++) {
        for (var j = 0; j < params.length; j++) {
          if (String(params[j].id).toLowerCase() === candidates[i].toLowerCase()) {
            mouthParam = params[j].id;
            log('检测到嘴型参数：', mouthParam);
            return;
          }
        }
      }
      // 模糊匹配
      for (var k = 0; k < params.length; k++) {
        var id = String(params[k].id || '');
        if (/mouth.*open|open.*mouth|mouthopen/i.test(id)) {
          mouthParam = params[k].id;
          log('检测到嘴型参数(模糊)：', mouthParam);
          return;
        }
      }
      log('未找到嘴型参数，口型同步将跳过');
    } catch (e) {
      log('口型参数检测失败：', e);
    }
  }

  function playTts(audioUrl, text, tag) {
    stopTts();
    state.speaking = true;
    setStatus((CFG.ui && CFG.ui.statusText && CFG.ui.statusText.speaking) || '语音播放中…');

    // TTS 播放期间把模型自带语音静音，避免冲突（结束后恢复）
    if (l2d) l2d.setVolume(0);
    state._prevVol = state.vol;

    audioEl.src = audioUrl;
    audioEl.volume = state.vol > 0 ? 1 : 0;

    // Web Audio 分析器
    setupAnalyser();

    var raf = null;
    var analyserActive = false;   // 分析器是否曾检测到有效音量
    // 每帧用音量/时间驱动嘴部参数（setParams 需要对象字面量，用变量展开）
    var tick = function () {
      if (!mouthParam) { raf = requestAnimationFrame(tick); return; }
      var obj = {};
      var v = 0;
      if (analyserFn) {
        var vol = analyserFn();
        if (vol > 0.03) analyserActive = true;
        if (analyserActive) {
          v = vol * ((CFG.mouth && CFG.mouth.openScale) || 1);
        } else {
          // 分析器一直无信号（静音/部分环境），用时间近似保证口型在动
          v = 0.25 + 0.5 * Math.abs(Math.sin(audioEl.currentTime * 6));
        }
      } else {
        v = 0.25 + 0.5 * Math.abs(Math.sin(audioEl.currentTime * 6));
      }
      obj[mouthParam] = v;
      if (l2d) l2d.setParams(obj);
      raf = requestAnimationFrame(tick);
    };

    var resolveDone = null;
    var donePromise = new Promise(function (resolve) { resolveDone = resolve; });
    var settled = false;
    function settle() {
      if (settled) return;
      settled = true;
      resolveDone();
    }

    var onEnd = function () {
      cleanup();
      finishSpeaking();
      settle();
    };

    function cleanup() {
      cancelAnimationFrame(raf);
      audioEl.onended = null;
      audioEl.onerror = null;
      audioEl.onpause = null;
      if (mouthParam && l2d) {
        var o = {}; o[mouthParam] = 0; l2d.setParams(o);
      }
    }

    function finishSpeaking() {
      state.speaking = false;
      hideTip();
      if (l2d && state._prevVol != null) {
        l2d.setVolume(state._prevVol);
        state._prevVol = null;
      }
      setStatus(idleStatusText());
      playIdle(true);
    }

    audioEl.onended = onEnd;
    audioEl.onerror = function (e) {
      console.error('[L2D-Waifu] 音频播放失败：', e);
      cleanup();
      finishSpeaking();
      settle();
    };

    var playResult = audioEl.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(function (err) {
        console.warn('[L2D-Waifu] 自动播放被拦截，静音预载后由用户交互解锁：', err && err.message);
        audioEl.muted = true;
        var retry = audioEl.play();
        if (retry && typeof retry.then === 'function') {
          retry.then(function () {
            audioEl.muted = false;
          }).catch(function () {
            cleanup();
            finishSpeaking();
            settle();
          });
        }
      });
    }

    // 显示统一气泡（模型回复文字；若大聊天框/简要发送框已展开则不再重复显示）
    if (!ui.panel.classList.contains('open') && !ui.quickbar.classList.contains('open')) {
      showTip(text, 0);
    }

    tick();

    return donePromise;
  }

  function setupAnalyser() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (analyserFn) return;
      var ctx = new AC();
      var src = ctx.createMediaElementSource(audioEl);
      var an = ctx.createAnalyser();
      an.fftSize = 256;
      src.connect(an);
      an.connect(ctx.destination);
      var buf = new Uint8Array(an.frequencyBinCount);
      analyserFn = function () {
        an.getByteFrequencyData(buf);
        var sum = 0;
        for (var i = 0; i < buf.length; i++) sum += buf[i];
        var avg = sum / buf.length / 255;
        return Math.min(1, avg * 2.2);
      };
    } catch (e) {
      console.warn('[L2D-Waifu] Web Audio 初始化失败，回退到时间近似口型', e);
    }
  }

  function stopTts() {
    if (audioEl) {
      audioEl.pause();
      audioEl.removeAttribute('src');
      audioEl.load();
    }
    if (mouthParam && l2d) {
      var o = {}; o[mouthParam] = 0; l2d.setParams(o);
    }
    state.speaking = false;
  }

  /* ---------------- 欢迎语 ---------------- */
  function welcome() {
    var list = (CFG.interact && CFG.interact.welcomeMessages) || [];
    if (!list.length) return;
    var msg = pick(list);
    setTimeout(function () {
      if (state.busy || state.speaking) return;
      // 与对话流程一致：语音生成完毕后文字与语音同时输出
      var output = function (audioUrl) {
        var bubble = addMsg('ai', '');
        typeText(bubble, msg, 30);
        if (audioUrl) playTts(audioUrl, msg, 'neutral');
      };
      if (ttsEnabled()) {
        callTts(msg).then(function (url) {
          output(url || null);
        }).catch(function () {
          output(null);
        });
      } else {
        output(null);
      }
    }, 600);
  }

  /* ---------------- 对外 API ---------------- */
  window.L2DWaifu = {
    instance: function () { return l2d; },
    getState: function () { return state; },
    send: send,
    toggleChat: toggleChat,
    openChat: openChat,
    closeChat: closeChat,
    // 简要发送小框
    openQuickBar: openQuickBar,
    hideQuickBar: hideQuickBar,
    toggleQuickBar: toggleQuickBar,
    hide: hide,
    show: show,
    // 动态调整模型缩放，并同步菜单/气泡/聊天框与模型的间距（随缩放联动）
    setScale: function (scale) {
      var s = Number(scale);
      if (!(s > 0)) return;
      if (l2d && typeof l2d.setScale === 'function') l2d.setScale(s);
      if (CFG.model) CFG.model.scale = s;
      if (rootEl) rootEl.style.setProperty('--l2d-scale', s);
    },
    playMotion: function (group, index, priority) {
      if (l2d && state.ready) l2d.playMotion(group, index, priority);
    },
    setExpression: function (id) {
      if (l2d && state.ready) l2d.setExpression(id);
    },
    speak: function (text) {
      // send() 内部已负责添加用户消息，这里不重复添加
      send(text);
    }
  };

  /* ---------------- 启动 ---------------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
