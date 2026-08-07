/* ============================================================================
 *  Live2D 看板娘插件 · 配置文件
 *  ---------------------------------------------------------------------------
 *  修改本文件后刷新页面即可生效，无需重新构建。
 *  所有配置项均有默认值，你只需要修改想自定义的部分。
 *
 *  使用方式：在页面中按顺序引入
 *    1. l2d 官方库   <script src="https://unpkg.com/l2d/dist/index.min.js"></script>
 *    2. 本配置文件   <script src="config.js"></script>
 *    3. 样式文件     <link rel="stylesheet" href="l2d-waifu.css" />
 *    4. 插件主文件   <script src="l2d-waifu.js"></script>
 * ========================================================================== */
window.L2D_WAIFU_CONFIG = {
  /* ------------------------- 全局开关 ------------------------- */
  // 是否在手机端开启看板娘。
  // true  - 手机端正常显示（默认）
  // false - 手机端（移动端 UA 或触屏小屏）不加载看板娘，仅 PC 端显示。
  //         适用于不想在手机上展示的网站。
  enableOnMobile: true,

  /* ----------------------------- 模型配置 ----------------------------- */
  model: {
    // 本地加载（推荐，资源随插件一起部署）
    path: 'assets/models/hailunna/model0.json',
    // 远程加载（CDN / 任意 http(s) 地址均可，示例模型）
    // path: 'https://fastly.jsdelivr.net/gh/Amatsutsumi/live2d-model@1.1/hailunna/model0.json',

    scale: 1.0,          // 模型缩放比例，1 为原始大小，常用 0.5 ~ 2.5。
                          // 菜单/统一气泡/简要发送框/聊天框/状态标签与模型的间距会自动跟随该值联动缩放，
                          // 模型大则距离远、模型小则距离近，不会卡进模型或离得太远。
    position: [0, -0.15], // 模型在画布中的偏移 [x, y]，x 正值右移，y 正值上移
    volume: 0.9,          // 模型自带语音音量 0 ~ 1（部分模型动作自带 Sound）
    logLevel: 'warn'      // 日志级别：error | warn | info | trace
  },

  /* ----------------------------- 画布配置 ----------------------------- */
  canvas: {
    width: 300,          // 画布宽度（px）
    height: 420,         // 画布高度（px）
    position: 'bottom-right', // 画布位置：bottom-left | bottom-right
    offsetX: 20,         // 距视口边缘的水平间距（px）
    offsetY: 20,         // 距视口边缘的垂直间距（px）
    zIndex: 99999        // 层级
  },

  /* --------------------------- 交互配置 --------------------------- */
  draggable: true,       // 看板娘是否可拖拽
  clickRandomAction: true,  // 点击画布空白处触发随机动作（模仿 Live2D Viewer EX）

  /* ----------------------------- 文字大模型 ----------------------------- */
  chat: {
    api: 'https://api.yinghu.asia/api/chat',   // 文字大模型接口（智谱/OpenAI 兼容格式）
    model: 'glm-4-flash',                       // 模型名称（智谱清言）
    temperature: 0.7,
    timeout: 60000,                             // 请求超时（ms）
    historySize: 8,                             // 携带的上下文轮数
    headers: {},                                // 额外请求头（如鉴权 { "Authorization": "Bearer xxx" }）

    // 系统提示词：用来设定看板娘人设 + 情绪标注协议
    systemPrompt:
      '你是陪伴在用户身边的可爱 Live2D 看板娘，名字叫「小理」，' +
      '性格温柔俏皮，喜欢用颜文字和 emoji。回答要简洁、生动、口语化，控制在 1~3 句话。\n' +
      '请根据用户话语自然表达情绪，并在回复的【第一行】用 #EMOTION# 标签标注心情，' +
      '可选值：happy / sad / angry / surprise / shy / neutral，然后换行输出正式回复。\n' +
      '示例：\n#EMOTION#happy\n嘿嘿，见到你真开心呀～ (´▽｀)ノ♪',

    // 快捷提问（点击即发送）
    quickReplies: ['你好呀', '讲个笑话', '你最喜欢什么', '摸摸头', '夸夸我', '今天心情如何']
  },

  /* ----------------------------- 语音大模型 ----------------------------- */
  tts: {
    enabled: true,                              // 是否开启 TTS 语音
    api: 'https://api.yinghu.asia/api/tts',     // 语音大模型接口（GET，?text=xxx 返回音频）
    voice: '',                                  // 可选：音色参数（如 "alloy"），留空不传
    extraParams: {}                             // 可选：额外查询参数 { "speed": "1.0" }
  },

  /* --------------------------- 情绪与心情系统 --------------------------- */
  emotion: {
    enable: true,
    // 情绪识别方式：
    //   'prompt'  - 通过系统提示词让大模型返回 #EMOTION# 标签（一次请求，推荐）
    //   'keyword' - 本地关键词启发式判断（不额外消耗 API）
    //   'off'     - 关闭识别，始终使用默认情绪
    detection: 'prompt',
    default: 'neutral',                          // 默认情绪

    // 思考中的动作（等待大模型/TTS 返回期间播放）
    thinking: {
      motion: 'Idle',        // 动作组名；设为 null 自动挑选
      tip: '让我想想… 🤔'      // 思考中提示（显示在统一气泡）
    },

    // 各情绪对应的动作组。motion 为 null 时插件会智能匹配；
    // 若动作组不存在，插件会自动回退到 Idle 或随机动作。
    map: {
      happy:    { motion: 'Idle#1', tip: '开心转圈圈～ ✨' },
      sad:      { motion: 'special', tip: '唔…有点难过 (｡•́︿•̀｡)' },
      angry:    { motion: 'head',    tip: '哼！我生气啦 (╯▔皿▔)╯' },
      surprise: { motion: 'select',  tip: '哇！真的吗？！Σ(°△°|||)' },
      shy:      { motion: 'blush#2', tip: '诶诶…人家害羞了啦 (⁄ ⁄•⁄ω⁄•⁄ ⁄)' },
      neutral:  { motion: 'Idle',    tip: '嗯嗯，我在听～' }
    }
  },

  /* --------------------------- 可互动系统 --------------------------- */
  interact: {
    // 点击模型不同部位 → 播放的动作组（模型自带 HitArea 名称）
    // 留空或未匹配时自动按名称模糊匹配
    hitAreaMotions: {
      'TouchHead': 'head',
      'TouchBody': 'body',
      'TouchSpecial': 'special',
      'TouchDrag1': 'touch_drag',
      'TouchDrag2': 'touch_drag',
      'TouchDrag3': 'touch_drag',
      'Hana_2': 'menu#2',
      'Background': 'Tap'
    },

    // 播放交互动作（模型自带语音）时，聊天框会暂时禁用，
    // 等动作/语音结束、恢复待机后重新启用，避免与 TTS 语音冲突。
    // 如果模型交互动作不带语音，可改为 false 不锁定聊天框。
    lockChatDuringModelVoice: true,

    // 对话回复期间（大模型回复 + TTS 播放）是否让情绪动作保持"静音"：
    // true  - 情绪动作若自带模型语音，会临时把模型音量设为 0（动作照播，但绝不会
    //         与 TTS 一起响），回复结束后恢复。
    // false - 情绪动作照常播放自带语音（可能与 TTS 语音叠加，不推荐）。
    silentEmotionDuringChat: true,

    welcomeMessages: [         // 加载完成后随机说一句
      '你好呀，我是小理，欢迎来找我玩～ (｡･ω･｡)',
      '今天也要开心哦！想聊什么都可以~',
      '戳戳我可以触发互动动作哦，双击还能随机表演！'
    ]
  },

  /* ----------------------------- UI 配置 ----------------------------- */
  ui: {
    title: '小理',             // 看板娘名字
    avatar: '🐰',              // 聊天头像
    chatWidth: 300,           // 聊天框宽度（px）
    chatOpen: false,          // 打开页面时是否展开聊天框（默认隐藏，点击左侧💬召唤）
    showMenu: true,           // 是否显示模型左侧的小菜单（聊天/简要发送/语音/表情/动作/待机/隐藏）
    showQuickSend: true,      // 是否启用「📝 简要发送」沉浸式小框（false 时左侧菜单不显示该按钮）
    statusText: {             // 状态文案
      idle: '待机中',
      thinking: '思考中…',
      speaking: '语音播放中…',
      interacting: '互动中…',
      loading: '模型加载中…',
      modelVoice: '🔊 模型语音中，已暂停对话'
    }
  },

  /* ----------------------------- 口型同步 ----------------------------- */
  mouth: {
    // 嘴部参数名：'auto' 自动检测（ParamMouthOpenY / PARAM_MOUTH_OPEN_Y / MouthOpen 等），
    // 也可手动指定，如 'ParamA'
    param: 'auto',
    openScale: 1.0            // 张口幅度倍率，越大嘴张得越开
  },

  // 模型加载完成后回调
  onReady: null
};
