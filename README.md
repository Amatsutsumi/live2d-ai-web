# 🎀 Live2D 看板娘插件

一个基于 [l2d](https://github.com/hacxy/l2d) 的智能 Live2D 看板娘插件，内置 **大模型对话 + TTS 语音 + 情绪动作系统 + 口型实时同步 + 可互动玩法**，开箱即用，支持 **Hexo 网站** 及 **任意网页**。

> 🎥 在线演示：见仓库 `live2d-plugin/demo/index.html`（把 `live2d-plugin` 整个文件夹部署到任意静态服务器即可预览）。

---

## ✨ 功能特性

| 功能 | 说明 |
| --- | --- |
| 💬 大模型对话 | 接入文字大模型（智谱/OpenAI 兼容格式），打字机逐字输出 |
| 📝 简要发送 | 菜单新增“简要发送”沉浸式小框，只弹一个输入框快速给 AI 发消息，更有真人对话感 |
| 🔊 TTS 语音 | 文字生成后自动调用语音大模型，**语音生成完毕后文字 + 语音同时输出** |
| 😊 情绪/表情系统 | 大模型返回心情标签，驱动对应动作组 + 统一气泡提示文案 |
| 🤔 思考中动作 | 请求大模型 / 生成语音期间，播放“思考”动作，提示语显示在统一气泡 |
| 👄 口型实时同步 | Web Audio 分析语音音量驱动嘴部参数，无需模型特殊配置（兼容 Cubism 2/6） |
| 🫧 统一气泡 | **头顶白色气泡与模型回复气泡已合并**：思考中（“让我想想…”）、模型回复、状态提示都显示在同一个气泡里，不再叠框 |
| 🖱 可互动系统 | 点击头部/身体触发互动动作（含模型自带语音），模仿 Live2D Viewer EX |
| 🧲 拖拽 | 看板娘可随意拖拽到屏幕任意位置 |
| 🎛 配置化 | 单文件 `config.js` 自定义模型、接口、尺寸、位置、情绪动作映射等 |
| 🔀 一键切换模型 | 侧边菜单新增 🔀 按钮，切换 Live2D 模型的同时自动级联切换 TTS/文字模型/音色/人设/知识库（配合 `live2d-ai-backend` 使用） |
| 📦 本地/远程模型 | 模型文件可随插件本地部署，也可直接引用 CDN 链接 |
| 🛡 语音防冲突 | 模型自带语音播放期间自动锁定聊天框，待机后恢复，避免与 TTS 混淆 |
| 🌐 任意网站 | 只需 3 行标签引入，即可在任意 HTML 页面 / Hexo 博客 / Vue / React 页面使用 |

---

## 🚀 快速开始

### 1. 部署文件

把 `live2d-plugin/` 整个文件夹拷贝到你的网站目录（Hexo 主题目录 / 任意静态目录均可）：

```
live2d-plugin/
├── config.js            ← 配置文件（改这里！）
├── l2d-waifu.js         ← 插件主逻辑
├── l2d-waifu.css        ← 样式（聊天框美化）
├── demo/
│   └── index.html       ← 在线演示页
└── assets/models/
    └── hailunna/        ← 内置示例模型（海伦娜，可本地加载）
```

### 2. 在页面中引入

在任意 HTML 页面中按顺序加入以下 3 个标签（**顺序不能乱**）：

```html
<!-- 1. l2d 官方库（也可用 jsDelivr: https://cdn.jsdelivr.net/npm/l2d/dist/index.min.js） -->
<script src="https://unpkg.com/l2d/dist/index.min.js"></script>

<!-- 2. 插件配置文件 -->
<script src="config.js"></script>

<!-- 3. 插件主文件 -->
<script src="l2d-waifu.js"></script>
```

无需任何其他代码，页面右下角就会出现看板娘 🎀（聊天框默认隐藏，点击模型左侧 💬 召唤）

### 3. 打开演示页

浏览器打开 `live2d-plugin/demo/index.html`，即可体验全部功能：
- 聊天框**默认隐藏**，点击模型左侧 💬 召唤完整聊天框（悬浮在模型头顶，不遮挡模型）
- 点击 📝 **“简要发送”**，弹出沉浸式小输入框快速给 AI 发消息（更有真人对话感）
- 头顶白色气泡已移除，**合并为统一气泡**：思考中（“让我想想…”）、模型回复、状态提示都在同一个气泡里
- 输入文字 → 语音生成完毕后，文字（打字机）+ 情绪动作 + TTS 语音 + 口型同步一起输出
- 点击看板娘身体/头部 → 互动动作 + 模型自带语音（聊天框自动暂停）
- 拖拽看板娘可任意移动
- 左侧小菜单：💬 聊天 / 📝 简要发送 / 🔊 语音开关 / 😊 随机表情 / 🎬 随机动作 / 🏠 回待机 / 🙈 隐藏
- 隐藏看板娘后，**右下角保留 🙈 召唤按钮**，点击即可召回

---

## 🎨 配置说明

所有配置都在 `config.js` 的 `window.L2D_WAIFU_CONFIG` 对象中，修改后刷新页面即生效。

### 模型配置

```js
model: {
  path: 'assets/models/hailunna/model0.json',  // 本地模型
  // path: 'https://fastly.jsdelivr.net/gh/Amatsutsumi/live2d-model@1.1/hailunna/model0.json', // 远程 CDN 模型
  scale: 1.0,          // 缩放比例（0.5 ~ 2.5）
  position: [0, -0.15], // 位置偏移 [x, y]
  volume: 0.9,          // 模型自带语音音量 0~1
  logLevel: 'warn'      // 日志级别
}
```

> 支持任何 `.model.json`（Cubism 2）或 `.model3.json`（Cubism 3+）模型入口文件，本地路径或 http(s) 链接均可。

### 画布与位置

```js
canvas: {
  width: 300, height: 420,   // 画布尺寸（px）
  position: 'bottom-right',  // bottom-left | bottom-right
  offsetX: 20, offsetY: 20,  // 距边缘间距
  zIndex: 99999
},
draggable: true             // 是否可拖拽
```

### 全局开关

```js
// 是否在手机端开启看板娘：
//   true  - 手机端正常显示（默认）
//   false - 手机端（移动端 UA 或触屏小屏）不加载看板娘，仅 PC 端显示。
//           适用于不想在手机上展示的网站。
enableOnMobile: true,
```

> 💡 **动态缩放联动**：`model.scale` 改变后，左侧菜单、统一气泡、状态标签、简要发送框、聊天框与模型的距离会自动跟随缩放——模型放大则距离拉远、模型缩小则距离收近，不会“卡进模型里”或“离模型太远”。也可在控制台调用 `L2DWaifu.setScale(0.8)` 动态调整（会同步更新所有 UI 间距）。

### 文字大模型（Chat）

```js
chat: {
  api: 'https://api.yinghu.asia/api/chat',  // 接口地址
  model: 'glm-4-flash',      // 模型名（智谱清言）
  temperature: 0.7,
  historySize: 8,            // 上下文轮数
  headers: {},               // 额外请求头，如鉴权 { Authorization: 'Bearer xxx' }
  systemPrompt: '...',       // 人设 + 情绪标注协议（可自定义）
  quickReplies: [...]        // 快捷提问按钮
}
```

接口采用 OpenAI 兼容的 `messages` 格式（当前示例接口即智谱清言 GLM-4-Flash），插件会自动解析多种常见返回结构。

### 语音大模型（TTS）

```js
tts: {
  enabled: true,
  api: 'https://api.yinghu.asia/api/tts',  // GET ?text=xxx 返回音频
  voice: '',                // 可选音色参数
  extraParams: {}           // 可选额外参数，如 { speed: '1.0' }
}
```

### 情绪/心情系统

```js
emotion: {
  enable: true,
  detection: 'prompt',       // prompt=大模型返回情绪标签；keyword=本地关键词判断
  default: 'neutral',
  thinking: { motion: 'Idle', tip: '让我想想… 🤔' },  // 思考中动作
  map: {                     // 每种情绪对应的动作组 + 气泡文案
    happy:    { motion: 'Idle#1', tip: '开心转圈圈～ ✨' },
    sad:      { motion: 'special', tip: '唔…有点难过' },
    angry:    { motion: 'head',    tip: '哼！我生气啦' },
    surprise: { motion: 'select',  tip: '哇！真的吗？！' },
    shy:      { motion: 'blush#2', tip: '人家害羞了啦' },
    neutral:  { motion: 'Idle',    tip: '嗯嗯，我在听～' }
  }
}
```

> 动作组名以具体模型的 `getMotions()` 为准。如果配置的动作组不存在，插件会自动**模糊匹配**或回退到 `Idle`，不会报错。
> `emotion.detection = 'prompt'` 时，插件会在 `systemPrompt` 中要求大模型在回复首行输出 `#EMOTION#happy` 之类的标签（也可手动改成 `keyword` 走本地关键词识别，不消耗额外 token）。

### 互动系统

```js
interact: {
  hitAreaMotions: {         // 点击模型区域 → 播放的动作组
    'TouchHead': 'head',
    'TouchBody': 'body',
    'TouchSpecial': 'special',
    'TouchDrag1': 'touch_drag',
    'Background': 'Tap'
  },
  lockChatDuringModelVoice: true,   // 模型自带语音期间锁定聊天框（防冲突）
  welcomeMessages: [...]            // 加载完成后的欢迎语
}
```

### 口型同步

```js
mouth: {
  param: 'auto',   // 'auto' 自动检测嘴部参数；也可手动指定如 'ParamA'
  openScale: 1.0   // 张口幅度倍率
}
```

### UI 配置

```js
ui: {
  title: '小理',           // 看板娘名字
  avatar: '🐰',            // 聊天头像
  chatWidth: 300,          // 完整聊天框宽度（px）
  chatOpen: false,         // 打开页面时是否展开完整聊天框（默认隐藏）
  showMenu: true,          // 是否显示左侧小菜单
  showQuickSend: true,     // 是否启用「📝 简要发送」沉浸式小框（false 时左侧菜单不显示该按钮）
  statusText: { ... }      // 状态文案
}
```

> 💬 **两种对话方式**：
> - **完整聊天框（💬）**：记录聊天历史的大框，悬浮在模型头顶，适合需要看上下文对话记录的场景。
> - **简要发送（📝）**：只弹一个小输入框快速给 AI 发消息，更有真人对话的沉浸感，发送后自动收起；与完整聊天框互斥，不会叠框。
>
> 🫧 **统一气泡**：已移除头顶白色气泡，将「思考中（“让我想想…”）」「模型回复文字」「状态提示」合并为模型头顶的同一个灰色气泡，界面更干净不叠框。

---

## 📦 Hexo 集成指南

### 方式一：主题内引入（推荐）

1. 将 `live2d-plugin/` 文件夹拷贝到你的 Hexo 主题目录，例如：

   ```
   themes/<你的主题>/source/live2d-plugin/
   ```

2. 在主题的 `layout/_partial/footer.ejs`（或 `layout.ejs`）中，`</body>` 前加入：

   ```html
   <link rel="stylesheet" href="<%- url_for('live2d-plugin/l2d-waifu.css') %>">
   <script src="https://unpkg.com/l2d/dist/index.min.js"></script>
   <script src="<%- url_for('live2d-plugin/config.js') %>"></script>
   <script src="<%- url_for('live2d-plugin/l2d-waifu.js') %>"></script>
   ```

3. `hexo clean && hexo g && hexo s` 即可预览。

### 方式二：文章页使用（单个页面）

在需要展示看板娘的文章 Front Matter 中加入 `live2d: true`，然后在文章模板中按需引入，或直接使用下面的自定义布局。

### 方式三：通用代码块

如果主题不方便改，也可以使用 Hexo 的「自定义 HTML」方式，在 `_config.yml` 里配置 `skip_render` 跳过 `live2d-plugin` 目录的渲染：

```yaml
skip_render:
  - 'live2d-plugin/**'
```

然后在主题 footer 里加入上面的 3 个标签即可。

---

## 🌐 任意网站集成

只要网站是纯 HTML / 静态站，都可直接使用：

```html
<!-- 页面任意位置（建议 body 末尾） -->
<link rel="stylesheet" href="/live2d-plugin/l2d-waifu.css">
<script src="https://unpkg.com/l2d/dist/index.min.js"></script>
<script src="/live2d-plugin/config.js"></script>
<script src="/live2d-plugin/l2d-waifu.js"></script>
```

如果项目使用 Vue / React 等框架，只需把这三行放到 `index.html` 的 `<body>` 中即可（插件使用 `position:fixed` 全屏定位，不依赖框架）。

---

## 🔌 与 live2d-ai-backend 完美对接（推荐）

> 🎯 本插件与 [live2d-ai-backend](https://cnb.cool/live2d-AI/live2d-AImodel-RD/-/tree/main/live2d-ai-backend) **可以完美对接**：后端动态生成 `window.L2D_WAIFU_CONFIG`，插件无需改任何代码即可直接使用，还能获得**网页管理后台**（配置文字/语音大模型、人设、知识库）+ **🔀 一键切换模型**能力。

### 对接原理

- 后端启动后提供一个 `/watcher/config.js` 动态配置接口，内容就是本插件读取的 `window.L2D_WAIFU_CONFIG`，其中：
  - `chat.api` / `tts.api` 自动指向后端代理（`/api/chat`、`/api/tts`），**API Key 绝不暴露给前端**；
  - 额外注入 `chatProviders` / `ttsProviders`（可切换提供方列表）、`bindings` / `modelList`（模型绑定列表）、`__backend` 标记。
- 插件的 🔀 **切换模型**按钮会读取 `bindings` / `modelList`，切换模型时自动：
  1. 重新加载新的 Live2D 模型；
  2. 把后续 Chat / TTS 请求带上 `bindingId`，由后端**级联切换**该模型绑定的文字大模型、TTS 服务、音色、人设与知识库；
  3. 同步更新看板娘名字/头像（绑定的人设）。

### 步骤一：部署并配置后端

按 [live2d-ai-backend README](https://cnb.cool/live2d-AI/live2d-AImodel-RD/-/tree/main/live2d-ai-backend) 部署（本地 `npm start` 或 Docker），然后在**管理后台**（默认 `http://localhost:3000/admin.html`，账号 `admin / 123456`）：

1. 配置**文字大模型**（支持 DeepSeek / OpenAI / 智谱 GLM / 通义千问 / SiliconFlow / Kimi / Ollama 等）；
2. 配置**语音大模型**（OpenAI 兼容 / 枫雨API 这类 GET 接口均可）；
3. 设置 **AI 人设** 与 **知识库**（可选）；
4. 在 **🎭 模型绑定** 里为每个 Live2D 模型添加绑定，绑定各自的文字模型、TTS 音色、人设与知识库；
   - 绑定里勾选「为此模型自定义情绪映射」可为该模型**单独配置 6 种情绪的「动作组 + 气泡文案」**（`emotionMap`），不同模型的动作组命名可以不同（如 `happy` 可映射到该模型的真实动作组「高兴」）；不勾选则使用全局情绪表。
5. 点「💾 保存配置」，后端即自动生成 `/watcher/config.js`。

### 步骤二：在你的页面引入（无需本插件的 config.js）

后端已经内置 **CORS 中间件**，任何网站都可以直接跨域引用：

```html
<!-- 1. l2d 官方库 -->
<script src="https://unpkg.com/l2d/dist/index.min.js"></script>

<!-- 2. 动态配置（由 live2d-ai-backend 生成，代替本插件的 config.js） -->
<script src="http://你的后端域名/watcher/config.js"></script>

<!-- 3. 插件主文件（本仓库 live2d-plugin/l2d-waifu.js，或后端 /watcher/l2d-waifu.js 同一份） -->
<script src="/live2d-plugin/l2d-waifu.js"></script>
<link rel="stylesheet" href="/live2d-plugin/l2d-waifu.css" />
```

> ✅ 说明：后端 `/watcher/l2d-waifu.js` 与 `l2d-waifu.css` 就是本插件同源版本（含 🔀 切换模型逻辑）。你可以二选一：
> - **用本仓库的** `live2d-plugin/l2d-waifu.js` + 后端 `/watcher/config.js`（推荐，方便随本仓库更新）；
> - 或全部用后端的 `/watcher/` 静态文件。

### 步骤三：使用 🔀 切换模型

刷新页面后，看板娘左侧小菜单会多出一个 **🔀** 按钮：

- 点击弹出「🎭 切换模型」面板，列出你在后台配置的全部模型绑定；
- 选择一个模型即**热切换**：重新加载 Live2D 模型 + 级联切换 TTS/文字模型/音色/人设/知识库 + **该模型绑定的情绪映射表 `emotionMap`**，并清空对话历史；
- 切到某个绑定后，情绪动作**优先使用该模型的 `emotionMap`**（动作组 + 气泡文案），未配置的情绪自动回退全局 `watcher.emotion.map`；
- 对话与语音请求会自动携带 `bindingId`，由后端完成级联路由。

### 不使用后端时的兼容行为

- 若配置中没有 `bindings` / `modelList`（纯前端 `config.js` 使用），🔀 按钮点击会提示「后台未配置可切换的模型绑定」，不影响其它功能；
- Chat / TTS 仍走 `config.js` 里配置的 `chat.api` / `tts.api`，行为与旧版完全一致。

---

## 🛠 换用你自己的模型

插件支持两种加载方式，改 `config.js` 里 `model.path` 即可：

```js
// 方式一：本地加载（把模型文件夹放到 assets/models/ 下）
model: { path: 'assets/models/你的模型/xxx.model3.json' }

// 方式二：远程加载（直接引用 CDN 或任意 http(s) 地址）
model: { path: 'https://example.com/models/xxx.model3.json' }
```

> ⚠️ 建议把模型放在**同源**或支持 **CORS** 的地址，否则浏览器会拦截贴图加载。

---

## 🧩 插件 API（可选）

引入插件后，页面可通过 `window.L2DWaifu` 调用：

```js
window.L2DWaifu.speak('你好呀');        // 以用户身份发送消息
window.L2DWaifu.instance();            // 获取 l2d 实例（可用全部 l2d 方法）
window.L2DWaifu.getState();            // 获取运行状态
window.L2DWaifu.playMotion('Idle');    // 播放动作
window.L2DWaifu.setExpression('f01');  // 切换表情
window.L2DWaifu.openChat() / closeChat() / toggleChat();  // 开关完整聊天框（大框）
window.L2DWaifu.openQuickBar() / hideQuickBar() / toggleQuickBar();  // 开关“简要发送”小框
window.L2DWaifu.hide() / show();       // 隐藏/显示看板娘
```

---

## 🧠 工作原理

```
用户输入 ──▶ 文字大模型(chat) ──▶ 情绪标签解析
                                        │
                                        ▼
                             语音大模型(TTS) 生成语音（思考中动作）
                                        │
                              ┌─────────┴─────────┐
                              ▼                   ▼
                       文字打字机输出        播放语音 + 口型同步
                    （与语音同时开始，同屏输出）
```

- **语音与文字同步输出**：先完成 Chat 与 TTS 两段请求，**语音生成完毕后**才同时开始文字打字机输出与语音播放，避免“文字先出、语音后到”
- **情绪动作**：大模型在回复首行返回 `#EMOTION#happy` 等标签 → 插件映射到模型动作组 + 统一气泡
- **思考中**：请求 Chat / TTS 期间播放 `thinking.motion` 配置的动作
- **口型同步**：`<audio>` 通过 `createMediaElementSource` 接入 Web Audio `AnalyserNode`，每帧读取音量驱动嘴部参数（`ParamMouthOpenY` / `PARAM_MOUTH_OPEN_Y` 等自动检测）
- **语音防冲突**：模型动作自带语音时（如点击身体），`motionstart` → 锁定聊天框；`motionend` 回到待机 → 解锁。同时 TTS 播放期间会暂时把模型音量设为 0，结束后恢复

---

## ❓ 常见问题

**Q：点击左侧菜单/聊天框时，会不会误触发模型互动？**
A：不会。菜单和聊天面板上的按下/点击事件已被拦截（stopPropagation），且插件会记录每次按下是否落在画布上，非画布区域的按下不会触发任何互动/拖拽动作。即使模型被缩放、聊天框与模型位置重叠也不会误触发。

**Q：隐藏看板娘再显示后，模型上半身缺失、只剩腿？**
A：已修复。旧版隐藏用 `display:none`，会让 canvas 的 `clientWidth/Height` 变成 0，触发 l2d 的 ResizeObserver 把画布尺寸重置为 0，破坏 WebGL 绘制缓冲。现改为 `visibility:hidden`（不影响布局尺寸），并在显示时强制重算投影，模型始终完整显示。

**Q：文字大模型偶尔判断不出情绪、不做动作？**
A：已增强。① 情绪标签解析兼容更多格式（`#EMOTION#happy`、`#happy`、带空格/冒号、行内等）；② 大模型漏打标签时，自动用"用户输入 + 回复内容"做中文/emoji 关键词兜底，不会再"呆住不做动作"。

**Q：模型回复触发 motion 时，自带语音和 TTS 一起响？**
A：已修复。对话回复期间的情绪动作会优先选择"无自带语音"的动作组；若该情绪动作组都带自带语音，插件会临时把模型音量设为 0（动作照常播放、自带语音静音），回复结束后自动恢复，杜绝与 TTS 双语音叠加。可通过 `interact.silentEmotionDuringChat: false` 关闭（不推荐）。

**Q：聊天框输入时提示"模型还没准备好"？**
A：模型资源较多，需等加载完成（右下角状态显示"待机中"）后再发送。

**Q：左侧菜单的 🔀 切换模型按钮点了没反应？**
A：🔀 按钮需要配合 `live2d-ai-backend` 使用。若页面配置（`config.js` 或后端 `/watcher/config.js`）中没有 `bindings` / `modelList`（即未在后端「🎭 模型绑定」里配置任何绑定），点击会提示「后台未配置可切换的模型绑定」。请先在后端管理后台添加模型绑定，或用带 `bindings` 的配置。

**Q：TTS 没有声音？**
A：① 浏览器自动播放策略要求用户先与页面交互（点击一次即可，插件会自动解锁）；② 确认 `tts.enabled: true`；③ 确认接口可用（F12 控制台看是否有报错）。

**Q：模型表情切换没反应？**
A：部分模型没有内置 Expressions 定义，`getExpressions()` 返回空。这是模型本身限制，可改用"随机动作"或情绪动作体验。

**Q：口型不动？**
A：插件会自动检测 `ParamMouthOpenY` / `PARAM_MOUTH_OPEN_Y` 等常见嘴部参数。若你的模型参数名特殊，请在 `config.js` 的 `mouth.param` 手动指定（可在 F12 控制台 `L2DWaifu.instance().getParams()` 查看参数名）。

**Q：点击看板娘没反应？**
A：点击需命中模型的 HitArea（不同模型命名不同）。`interact.hitAreaMotions` 里可按你模型的 HitArea 名称修改。也可以点击画布空白处触发"随机动作 + 随机表情"。

**Q：隐藏看板娘后如何召回？**
A：隐藏后看板娘本体（画布 + 左侧菜单）会消失，但**右下角会保留一个 🙈 圆形召唤按钮**，点击即可重新显示看板娘。

**Q：聊天框在哪里？**
A：有两种对话方式，都在模型左侧小菜单里：
- **💬 完整聊天框**：记录聊天历史的大框，点击 💬 召唤，悬浮在模型头顶（不遮挡模型）；若顶部空间不足会自动翻转到模型下方。
- **📝 简要发送**：沉浸式小框，只弹一个输入框快速给 AI 发消息，发送后自动收起，更有真人对话感；与完整聊天框互斥不会叠框。

**Q：头顶的白色气泡和模型回复的灰色框怎么合并了？**
A：本次已把“头顶白色气泡”移除，将「思考中（“让我想想…”）」「模型回复文字」「状态提示」全部合并到模型头顶的同一个灰色气泡里，不再叠框、界面更干净。

**Q：不想要“简要发送”按钮？**
A：把 `config.js` 的 `ui.showQuickSend` 设为 `false` 即可，左侧菜单将不再显示 📝 按钮。

**Q：展开大聊天框时，统一气泡被挡住了？**
A：已处理。完整聊天框 / 简要发送框展开期间，统一气泡会自动隐藏，不再被遮挡；收起后自动恢复显示。

**Q：缩放模型后，菜单/统一气泡/聊天框与模型的距离不合适？**
A：已支持动态联动。`config.js` 中修改 `model.scale` 后，左侧菜单、统一气泡、状态标签、简要发送框、聊天框与模型的距离会**按比例自动调整**（模型大则距离远、模型小则距离近）。也可调用 `L2DWaifu.setScale(数值)` 动态缩放，UI 间距会同步更新。

**Q：网站不想在手机端显示看板娘？**
A：把 `config.js` 中的 `enableOnMobile` 设为 `false` 即可。手机端（移动端 UA 或触屏小屏）不会加载看板娘，PC 端不受影响。

**Q：模型自带语音和 TTS 冲突？**
A：插件已处理：模型动作自带语音期间，聊天框自动锁定并暂停 TTS；TTS 播放期间模型音量自动静音。若你的模型交互动作不带语音，可把 `interact.lockChatDuringModelVoice` 设为 `false` 关闭锁定。

---

## 📄 文件结构

```
live2d-plugin/
├── config.js            # 配置文件（模型/接口/尺寸/位置/情绪/互动等）
├── l2d-waifu.js         # 插件主逻辑（无构建，纯浏览器 JS）
├── l2d-waifu.css        # 样式（看板娘 + 美化聊天框）
├── demo/
│   └── index.html       # 在线演示页
└── assets/models/
    └── hailunna/        # 内置示例模型（海伦娜 Live2D）
```

---

## 🙏 致谢

- [l2d](https://github.com/hacxy/l2d) — Live2D 渲染引擎
- [Amatsutsumi/live2d-model](https://github.com/Amatsutsumi/live2d-model) — 示例模型（海伦娜）
- 智谱清言（GLM-4-Flash）文字大模型 + 语音合成接口
