/**
 * MC Skin — Minecraft 风格的 DeepSeek Harness 客户端主题
 *
 * 源码形态。`__ASSETS__` 是构建时占位符，由 build.mjs 替换为内联的 data URL 表。
 * 产物写到 lib/client.js，也就是 package.json 里 exports["./client"] 指向的文件。
 *
 * 这个包只做五件事：
 *   1. 覆盖主题颜色 token（走 theme.overrideTokens，可逆）
 *   2. 注入一份样式表（document.head，带 data-plugin-css 标记，随插件卸载移除）
 *   3. 往三个槽位注册像素标志图（侧边栏标志 / 品牌名 / 首屏标志）
 *   4. 往插件详情页（plugins.detail.section）加一块设置区：
 *      「MC 主题」与「MC 字体」两个开关
 *   5. 按开关把界面字体换成 Minecraft Seven + Noto Sans SC —— @font-face
 *      指向 Host 半边（src/index.js）注册的路由，9 MB 的字体文件不进
 *      本文件，只在开关打开时才由浏览器去下载。
 *
 * PNG 素材是内联的；字体不是。两边各司其职的原因见 src/index.js 开头。
 */

window.__ModuleLoader__.load({
  id: 'dsh-client-ui-mc-skin',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports

    var React = require('react')

    // ── 构建时注入：文件名 -> data URL ────────────────────────────────
    var ASSETS = __ASSETS__

    var PLUGIN_ID = 'dsh-client-ui-mc-skin'
    var CSS_TAG = PLUGIN_ID + '/theme.css'

    // 持久化命名空间与字段名。两边必须一致：
    //   Host 半边（src/index.js）用 SETTINGS_NAMESPACE 注册 schema；
    //   客户端半边用同一个名字 bind，字段名必须与 schema 的键对齐。
    // 改一处必须改另一处。
    var SETTINGS_NAMESPACE = 'ui-mc-skin'
    var SETTINGS_FIELD_THEME = 'themeEnabled'
    var SETTINGS_FIELD_FONT = 'pixelFontEnabled'

    // 设置行末尾那句持久化说明。只有真的连上 Host 设置文档时才这么说，
    // 否则等于对用户撒谎（memory 模式下重启就丢）。
    var SETTINGS_HINT = ''

    // 字体路由由 Host 半边（src/index.js）注册，两边必须是同一个路径。
    var FONT_ROUTE = '/dsh-mc-skin/font.ttf'
    // 标志专用字体路由。侧边栏那个 "MINECRAFT" 用老字体
    // （MinecraftAE-Pixel，纯字母像素味更冲），和正文的新字体分开。
    var LOGO_FONT_ROUTE = '/dsh-mc-skin/font-logo.ttf'
    // 用来匹配 @font-face 的族名。这里就是字体 name 表里的 family，
    // 不是文件名 —— 虽然 @font-face 允许随便起名，用真名能让 DevTools
    // 里一眼看懂。
    // 当前字体（assets/MinecraftSeven-NotoSansSC.ttf）的 familyName 是
    // "MC Seven + Noto SC"（由 fontkit 读 name 表确认，不是猜的）。
    var FONT_FAMILY = 'MC Seven + Noto SC'
    // 老字体的族名（assets/MinecraftAE-Pixel.ttf），只给标志用。
    var LOGO_FONT_FAMILY = 'Minecraft AE'
    var MONO_STACK = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'

    // ── 调色板（来自 user 提供的模板图）────────────────────────────
    var L_FILL = '#313233'   // background_template_left  填充
    var L_EDGE = '#030303'   // background_template_left  外框
    var L_TOP = '#2A2B2B'    // background_template_left  顶边（更暗）
    var L_BOTTOM = '#3B3B3C' // background_template_left  底边（更亮）

    var R_FILL = '#6B6B6B'   // background_template_right 填充
    var R_EDGE = '#030303'
    var R_TOP = '#3B3B3C'
    var R_BOTTOM = '#8D8E8E'

    // 槽位候选：按顺序取第一个存在的
    var SIDEBAR_FILES = ['minecraft24x.png']
    var HERO_FILES = ['minecraft34x.png']

    // 默认文字颜色。原来是「MC 十六色可调」，用户明确说用不到已删除，
    // 改为固定的一套层次色 —— 只保留一个主色，其余层级由它按亮度递降推导。
    //
    // 选 #F2F2F2 而不是纯白：纯白压在 #6B6B6B 的对话区底上会过曝，
    // 长文阅读发涩；#F2F2F2 既保住像素字体的锐利边缘，又不刺眼。
    var TEXT_PRIMARY = '#F2F2F2'


    var TOKENS = {
      '--dsw-alias-bg-base':        { light: R_FILL, dark: R_FILL },
      '--dsw-alias-bg-layer-1':     { light: '#3A3B3C', dark: '#3A3B3C' },
      '--dsw-alias-bg-layer-2':     { light: '#2A2B2C', dark: '#2A2B2C' },
      '--dsw-alias-bg-layer-3':     { light: '#333435', dark: '#333435' },
      // --dsw-alias-bg-layer-4 曾经在这里，但 design-platform.css 里没有这个
      // token（只有 layer-1..3），覆盖它等于写了个没人读的变量，已删除。
      '--dsw-alias-bg-overlay':     { light: '#3E3F40', dark: '#3E3F40' },
      // 设置页卡片底/描边。DSH 的 base.css 里这两个 token 分别指向
      // bg-layer-2 和 border-l4；本主题把 layer-2 压得很深，导致设置页
      // 卡片（充值余额、模型供应商行等）比旁边的 _card 卡片暗一截。
      // 这里直接钉成与卡片一致的亮灰，两边就统一了。
      // 详细原因见 buildCss 里同一对 token 的注释。
      '--dsw-alias-settings-card-fill':   { light: '#3E3F40', dark: '#3E3F40' },
      '--dsw-alias-settings-card-stroke': { light: '#030303', dark: '#030303' },

      // 代码块 / Diff / 终端 / Read 面板的底色。这三个面板（ui-primitives 的
      // CodeBlock、DiffBlock、ReadBlock/TerminalBlock）**只**从这一对 token
      // 取底色，所以钉死它们等于一次修好全部面板，不需要再猜类名。
      // 浅色模式下 markdown-code-block = bluish-50 = rgb(249,250,251)，近白，
      // 而标签文字已被本主题染成浅色 —— 就是用户截图里那块白底白字的 diff 面板。
      '--dsw-alias-markdown-code-block':        { light: L_FILL, dark: L_FILL },
      '--dsw-alias-markdown-code-block-banner': { light: '#2A2B2C', dark: '#2A2B2C' },

      // 下面这批属于「浅色模式下近白、深色模式下才深」的面板 token。
      // overrideTokens 是按当前模式取一个值写进 body 行内样式的，所以不钉死
      // 它们的话，浅色模式下就会从缝里漏出白底，而文字早被染成浅色 ——
      // 表现为白底白字。设置 → 模型 →「编辑」展开的面板踩的就是 bg-module-platform。
      // 取值统一回本主题自己的调色板，而不是照抄 DSH 的深色值。
      //
      // ⚠ 范围纪律：这里只收「用户明确报过」的面。一批 token 在浅色模式下
      // 近白 ≠ 就该改 —— 没被要求的面板一律不动，否则一次改掉菜单、气泡、
      // 侧边栏选中态，等于擅自重刷用户没提的颜色。
      //
      // 曾经有一次越界：把 29 个「浅色近白」的面板 token 一起钉死，结果重刷了
      // 菜单 / 用户气泡 / 侧边栏选中态等一堆没被要求的颜色，已全部撤回。
      // 判定要不要改，得看这个面有没有承载文字、以及用户是否要求改它，
      // 不能只看 token 的浅色/深色值差异。（对应的核查脚本 token-leak-truth.mjs
      // 属于开发时的临时工具，未随包发布。）

      // 任务面板（TodoPanel 的 .root）用的是 --dsw-specific-tip：
      // 浅色模式 #f5f6f7（近白，配上被染白的 label-primary 就是白底白字，
      // 用户截图报过），深色模式 #353638 —— 正好等于本主题的 bg-layer-3。
      // 所以这不是自己配色，是把这个面钉回设计系统里它本该有的深色。
      // 用户明确要求保留这个修复。
      '--dsw-specific-tip':         { light: '#353638', dark: '#353638' },
      '--dsw-alias-bg-module-platform':         { light: '#1B1C1D', dark: '#1B1C1D' },
      '--dsw-alias-bg-multi-select':            { light: '#2A2B2C', dark: '#2A2B2C' },
      '--dsw-alias-bg-mask-drop':               { light: '#000000B3', dark: '#000000B3' },
      '--dsw-alias-button-elevated-fill':       { light: '#3A3B3C', dark: '#3A3B3C' },
      '--dsw-alias-button-floating-fill':       { light: '#3A3B3C', dark: '#3A3B3C' },
      '--dsw-alias-button-ghost-active-fill':   { light: '#3A3B3C', dark: '#3A3B3C' },
      '--dsw-alias-interactive-bg-hover-solid': { light: '#3A3B3C', dark: '#3A3B3C' },
      '--dsw-alias-scrollbar-bg-l1':            { light: '#313233', dark: '#313233' },
      '--dsw-alias-scrollbar-bg-l2':            { light: '#474848', dark: '#474848' },

      // 这里曾经有一批「浅色模式漏底封口」的 token，一次钉了 29 个
      // （--dsw-specific-menu / -bubble / -sidebar-nav-item-* 、markdown-* 、
      // state-*-tertiary 等）。已全部撤回，原因见上面的「范围纪律」。
      '--dsw-alias-border-l1':      { light: '#030303', dark: '#030303' },
      '--dsw-alias-border-l2':      { light: '#5A5C5E', dark: '#5A5C5E' },
      '--dsw-alias-border-l3':      { light: '#030303', dark: '#030303' },
      '--dsw-alias-brand-primary':  { light: '#6ABF4D', dark: '#6ABF4D' },
      // 文件改动的增删配色：删除=红石红、添加=绿，取 MC 官方色板
      // §c 红 #FF5555 / §a 绿 #55FF55。DiffBlock 的 .del/.add 就走这两个 token。
      // 与 buildCss 里那份保持一致（两处都写，谁赢都同一个值）。
      '--dsw-alias-state-error-primary':   { light: '#FF5555', dark: '#FF5555' },
      '--dsw-alias-state-success-primary': { light: '#55FF55', dark: '#55FF55' },
      '--dsw-alias-state-warn-primary':    { light: '#D9A441', dark: '#D9A441' },
      '--dsw-specific-sidebar-fill': { light: L_FILL, dark: L_FILL },
    }

    // ── 工具 ────────────────────────────────────────────────────────
    function hexToRgb(hex) {
      var n = parseInt(hex.slice(1), 16)
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    function withAlpha(hex, a) {
      var c = hexToRgb(hex)
      return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'
    }
    function panelStyle(fill, top, bottom) {
      return {
        backgroundColor: fill,
        backgroundImage: 'linear-gradient(' + top + ',' + top + '),linear-gradient(' + bottom + ',' + bottom + ')',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center top,center bottom',
        backgroundSize: '100% 1px,100% 1px',
      }
    }
    function pickFile(candidates) {
      for (var i = 0; i < candidates.length; i++) {
        if (ASSETS[candidates[i]] !== undefined) return candidates[i]
      }
      return null
    }

    // ── 缺图时的洋红/黑棋盘格 ──────────────────────────────────────
    var MISSING = { a: '#ff00ff', b: '#000000' }
    function checker(cells) {
      var block = Math.max(1, Math.round(cells / 2))
      var grid = []
      for (var y = 0; y < cells; y++) {
        var row = ''
        for (var x = 0; x < cells; x++) {
          row += ((Math.floor(x / block) + Math.floor(y / block)) % 2 === 0) ? 'a' : 'b'
        }
        grid.push(row)
      }
      return grid
    }
    var CHECKER = checker(16)
    function Checker(props) {
      var rects = []
      for (var y = 0; y < 16; y++) {
        for (var x = 0; x < 16; x++) {
          rects.push(React.createElement('rect', {
            key: x + ':' + y, x: x, y: y, width: 1, height: 1,
            fill: CHECKER[y].charAt(x) === 'a' ? MISSING.a : MISSING.b,
          }))
        }
      }
      return React.createElement('svg', {
        className: props.className, width: props.size, height: props.size,
        viewBox: '0 0 16 16', shapeRendering: 'crispEdges',
        focusable: 'false', 'aria-hidden': 'true',
        style: { display: 'block', imageRendering: 'pixelated' },
      }, rects)
    }

    // ── 样式表：自己插 <style>，随 fiber 卸载移除 ──────────────────
    var styleEl = null
    function insertCss(css) {
      if (typeof document === 'undefined') return
      if (styleEl === null) {
        styleEl = document.createElement('style')
        styleEl.dataset.plugin = PLUGIN_ID
        styleEl.dataset.pluginCss = CSS_TAG
        document.head.appendChild(styleEl)
      }
      styleEl.textContent = css
    }
    function removeCss() {
      if (styleEl !== null && styleEl.parentNode !== null) styleEl.parentNode.removeChild(styleEl)
      styleEl = null
    }

    // ── 状态 ────────────────────────────────────────────────────────
    // 一个值 + 一组订阅者。开关、色号、字体加载状态都是这个形状，组件里用
    // .use() 订阅（内部就是 useState + useEffect 那套）。
    function createStore(initial) {
      var listeners = new Set()
      var value = initial
      return {
        get: function () { return value },
        set: function (next) {
          if (value === next) return
          value = next
          listeners.forEach(function (fn) { fn(next) })
        },
        use: function () {
          var pair = React.useState(value)
          var setLocal = pair[1]
          React.useEffect(function () {
            var fn = function (next) { setLocal(next) }
            listeners.add(fn)
            // 订阅建立之前如果值已经变过（首次渲染到 effect 执行之间有一帧），
            // 组件会停在旧的初值上，直到下一次变更才追上。这里先对齐一次。
            if (value !== pair[0]) setLocal(value)
            return function () { listeners.delete(fn) }
          }, [])
          return pair[0]
        },
      }
    }

    var themeStore = createStore(true)            // 主题总开关
    var fontStore = createStore(true)             // MC 像素字体开关
    // idle → 关着；loading → @font-face 已插入、正在下载字体；
    // ready → 已经生效；error → 拿不到字体（多半是 Host 路由还没上线）
    var fontStatusStore = createStore('idle')

    var themeService = null
    var slotsService = null
    var tokenDispose = null
    var slotHandles = []
    // 设置里那两行的槽位句柄单独放：它们跟随插件生命周期，不跟随主题开关。
    // 之前直接丢弃 inject() 的返回值，卸载时这两行会残留在设置页里。
    var controlHandles = []

    // 主题、字体、槽位三者互相独立：
    //   主题开关 → token 覆盖 + 主题样式表
    //   字体开关 → @font-face + 全局 font-family（主题关着也照样生效）
    //   槽位     → 跟随主题开关
    // 控制面本身（设置里那三行）永远挂载，否则关掉之后没法重新打开。
    function applySkin() {
      if (tokenDispose !== null) { tokenDispose(); tokenDispose = null }
      var themeOn = themeStore.get()
      var fontOn = fontStore.get()
      if (themeOn && themeService !== null) {
        tokenDispose = themeService.overrideTokens(PLUGIN_ID, TOKENS)
      }
      if (!themeOn && !fontOn) { removeCss(); return }
      // 字体样式表接在主题后面：两条同为 !important 时后写的赢，正好盖掉
      // 主题里那句等宽 font-family。
      insertCss(
        (themeOn ? buildCss() : '') +
        (fontOn ? buildFontCss() : '')
      )
    }

    function applySlots() {
      while (slotHandles.length > 0) {
        var dispose = slotHandles.pop()
        try { dispose() } catch (e) { /* 已卸载 */ }
      }
      if (!themeStore.get() || slotsService === null) return
      // 这三个都是 single 槽位，官方品牌插件已经占在 priority 0 上。
      // single 槽位禁止同优先级重复注册（会直接抛错），必须用更低的优先级遮蔽；
      // 规则是"最低者渲染"（lowest renders），所以用 -1。
      slotHandles.push(slotsService.inject('sidebar.brand.mark', function () {
        return slotsService.register({ name: 'sidebar.brand.mark', priority: -1 }, SidebarMark)
      }))
      slotHandles.push(slotsService.inject('sidebar.brand.name', function () {
        return slotsService.register({ name: 'sidebar.brand.name', priority: -1 }, BrandName)
      }))
      slotHandles.push(slotsService.inject('conversation.hero.brand.mark', function () {
        return slotsService.register({ name: 'conversation.hero.brand.mark', priority: -1 }, HeroMark)
      }))
    }

    // ── 开关的读写与持久化 ──────────────────────────────────────────
    //
    // 两个开关默认都开。持久化走 DSH 的 Host settings 服务：客户端半边拿到的是
    // ctx.settingsScope（ui-settings 提供），bind 出本插件自己的命名空间后
    // set(field, value) 就会写进 Host 的用户设置文档，重启后由 Host 回灌。
    //
    // 拿不到 settingsScope 时（比如连接处于 memory 模式、或 ui-settings 没装）
    // 自动退化成纯内存行为 —— 开关仍然能用，只是不跨会话保留。这比报错好：
    // 用户没要求持久化能力本身是必需的，界面不该因为这个变砖。
    var scope = null            // SettingsScope | null
    var scopeStatus = 'idle'    // idle | loading | ready | unavailable

    function setTheme(next) {
      themeStore.set(next)
      applySkin()
      applySlots()
      persist(SETTINGS_FIELD_THEME, next)
    }
    function setFont(next) {
      fontStore.set(next)
      applySkin()
      if (next) probeFont()
      else { fontProbe = null; fontStatusStore.set('idle') }
      persist(SETTINGS_FIELD_FONT, next)
    }

    /**
     * 把一个开关值写回 Host 设置文档。
     *
     * 刻意不 await、也不把错误抛给调用方：写失败（只读文档、断连、revision 冲突）
     * 不该让界面卡住或回滚用户刚点的那一下。失败只记一条日志，本次会话内开关
     * 仍然按用户点的样子生效，下次启动回到上一次成功落盘的值。
     */
    function persist(field, value) {
      if (scope === null) return
      var result = scope.set(field, value)
      if (result !== undefined && typeof result.catch === 'function') {
        result.catch(function (error) { console.error('[mc-skin] 设置写入失败:', error) })
      }
    }

    /**
     * 从 Host 设置文档回灌开关状态。
     *
     * 只在 status 变成 ready 时采纳一次；之后 Host 侧的变化（另一个标签页改了
     * 开关）也跟随，因为 scope 是响应式的。采纳时不回写，否则会自己触发一次
     * 无意义的写入 —— 这也是 ui-theme 里 adopt() 的做法。
     */
    function adoptSettings() {
      if (scope === null) return
      var snap = scope.getSnapshot()
      scopeStatus = snap.status
      if (snap.status !== 'ready' || snap.value === undefined) return
      var remoteTheme = snap.value[SETTINGS_FIELD_THEME]
      var remoteFont = snap.value[SETTINGS_FIELD_FONT]
      if (typeof remoteTheme === 'boolean' && remoteTheme !== themeStore.get()) {
        themeStore.set(remoteTheme)
        applySkin()
        applySlots()
      }
      if (typeof remoteFont === 'boolean' && remoteFont !== fontStore.get()) {
        fontStore.set(remoteFont)
        applySkin()
        if (remoteFont) probeFont()
        else { fontProbe = null; fontStatusStore.set('idle') }
      }
    }

    // ── 字体可用性探测 ──────────────────────────────────────────────
    // 插入 @font-face 之后用 FontFaceSet 探一次；这一步同时就是"开始下载"，
    // 所以不用另发一次请求。成功 → ready，404/网络失败 → error。
    var fontProbe = null
    function probeFont() {
      if (typeof document === 'undefined' || document.fonts === undefined
        || typeof document.fonts.load !== 'function') {
        // 没有 FontFaceSet 就没法探测，当作可用，交给 CSS 自己决定。
        fontStatusStore.set('ready')
        return
      }
      if (fontProbe !== null) return
      fontStatusStore.set('loading')
      // 两个字体一起探：正文字体决定开关状态，标志字体顺带预热
      // （它只有 3 个字母，很小，但第一次渲染前就下好可以避免标志闪一下）。
      // 用 Promise.all，任一失败都算 error —— 正文字体是主，标志字体缺了
      // 标志会掉回后备字体，同样值得报错。
      fontProbe = Promise.all([
        document.fonts.load('16px "' + FONT_FAMILY + '"'),
        document.fonts.load('700 15px "' + LOGO_FONT_FAMILY + '"'),
      ]).then(function (results) {
        var faces = results[0]
        fontStatusStore.set(faces.length > 0 ? 'ready' : 'error')
        // 两条路径都要复位：否则探测成功后 fontProbe 永远非空，
        // Host 路由中途失效（重启、换 profile）时不会再探一次，
        // 状态会一直停在"已生效"而实际已经掉回系统字体。
        fontProbe = null
      }, function () {
        fontStatusStore.set('error')
        fontProbe = null   // 允许再试一次（比如 Host 刚重启上线）
      })
    }

    // ── 槽位组件 ────────────────────────────────────────────────────
    // 按源图的最大整数倍渲染，避开非整数缩放的锯齿。
    // 例：32 的图放进 34 的框 → k=1 → 按 32 画（1:1），居中留 1px。
    function Sprite(props) {
      var natPair = React.useState(0)
      var nat = natPair[0], setNat = natPair[1]
      var file = pickFile(props.files)
      if (file === null) return React.createElement(Checker, { size: props.size, className: props.className })
      var render = props.size
      if (nat > 0) {
        var k = Math.floor(props.size / nat)
        if (k >= 1 && nat * k >= props.size * 0.8) render = nat * k
      }
      return React.createElement('img', {
        src: ASSETS[file],
        alt: '', draggable: false,
        width: render, height: render, className: props.className,
        onLoad: function (e) {
          var w = e.currentTarget.naturalWidth
          if (w > 0 && w !== nat) setNat(w)
        },
        style: { display: 'block', width: render + 'px', height: render + 'px', imageRendering: 'pixelated' },
      })
    }
    function SidebarMark(props) {
      return React.createElement(Sprite, { files: SIDEBAR_FILES, size: props.size || 24, className: props.className })
    }
    function HeroMark(props) {
      return React.createElement(Sprite, { files: HERO_FILES, size: props.size || 34, className: props.className })
    }
    function BrandName() {
      // 这个 span 自带行内 font-family，所以必须自己看一眼字体开关。
      // 样式表里那条 !important 规则够不着它：规则的主体是 `html body`，
      // span 只是"继承"了 body 的值，而继承永远输给元素自己的声明——
      // 换成 !important 也没用，因为压根不是同一条声明在竞争。
      //
      // 标志用**老字体**（MinecraftAE-Pixel / "Minecraft AE"），
      // 不是正文那套 Minecraft Seven + Noto SC —— 前者纯字母、像素味更冲，
      // 适合 "MINECRAFT" 这种短标志；后者要照顾中文，字形偏规范。
      // 老字体由 Host 半边的 /dsh-mc-skin/font-logo.ttf 单独发货。
      fontStore.use()
      return React.createElement('span', {
        style: {
          fontFamily: fontStore.get()
            ? '"' + LOGO_FONT_FAMILY + '",' + MONO_STACK
            : '"Courier New", ui-monospace, monospace',
          fontWeight: 700, fontSize: 15, letterSpacing: '0.1em',
          textTransform: 'uppercase',
        },
      }, 'Minecraft')
    }

    // ── 控制面 ──────────────────────────────────────────────────────
    // 开关本体：on.png / off.png；图缺失时退化成文字按钮（仍带 data-mc-swatch，
    // 所以不会被主题的 MC 按钮皮肤盖成方块）。
    function Switch(props) {
      // 两种形态都补齐 role/tabIndex/键盘/aria：原来只有一个 onClick 的 <img>，
      // 键盘和读屏都够不着，等于把开关做成了纯鼠标控件。
      // 无障碍名取自 props.label（由调用方给），不能写死成某一个开关的名字 ——
      // 这个组件同时服务主题和字体两个开关。
      var toggleFromKey = function (e) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Spacebar') {
          e.preventDefault()
          props.onToggle()
        }
      }
      var name = props.label || '开关'
      var a11y = {
        role: 'switch',
        tabIndex: 0,
        'aria-checked': props.on ? 'true' : 'false',
        'aria-label': name + (props.on ? '：已启用' : '：已关闭'),
        onKeyDown: toggleFromKey,
      }
      var src = ASSETS[props.on ? 'on.png' : 'off.png']
      if (src === undefined) {
        return React.createElement('button', Object.assign({
          type: 'button', 'data-mc-swatch': '1', onClick: props.onToggle,
          style: { padding: '4px 12px', fontSize: 12, cursor: 'pointer' },
        }, a11y), props.on ? '关闭' : '启用')
      }
      return React.createElement('img', Object.assign({
        src: src, width: 30, height: 16,
        alt: '', onClick: props.onToggle, draggable: false,
        style: { display: 'block', cursor: 'pointer', imageRendering: 'pixelated' },
      }, a11y))
    }

    function SwitchRow(props) {
      // hideCaption：状态文字已经由外层卡片统一渲染时，这里只画开关本身，
      // 避免「已启用」出现两次。
      return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
        React.createElement(Switch, { on: props.on, onToggle: props.onToggle, label: props.label }),
        props.hideCaption === true ? null
          : React.createElement('span', { style: { fontSize: 12 } }, props.caption))
    }

    var FONT_STATUS_TEXT = {
      idle: '已关闭',
      loading: '已启用 · 正在下载字体…',
      ready: '已启用 · 字体已生效',
      error: '已启用 · 字体加载失败（Host 路由还没上线？重启 dsh web 后刷新页面）',
    }

    function ThemeToggle(props) {
      var on = themeStore.use()
      return React.createElement(SwitchRow, {
        on: on,
        label: 'MC 主题',
        hideCaption: props !== undefined && props.hideCaption === true,
        onToggle: function () { setTheme(!themeStore.get()) },
        caption: on ? '已启用' : '已关闭',
      })
    }

    function FontToggle(props) {
      var on = fontStore.use()
      var status = fontStatusStore.use()
      return React.createElement(SwitchRow, {
        on: on,
        label: 'MC 字体',
        hideCaption: props !== undefined && props.hideCaption === true,
        onToggle: function () { setFont(!fontStore.get()) },
        caption: on ? (FONT_STATUS_TEXT[status] || FONT_STATUS_TEXT.ready) : FONT_STATUS_TEXT.idle,
      })
    }

    // MC 字体颜色（十六色调色板）已按用户要求移除：用不到，且它把「文字层次」
    // 这件事交给了用户去调，而默认值本身才是该做好的地方。现在文字色固定为
    // TEXT_PRIMARY 一套推导出的层次（见 buildCss）。

    // ── 插件详情页里的两个独立设置项 ────────────────────────────────
    //
    // 挂载点是 plugins.detail.section（插件面板 → 点进本插件 → 详情页底部）。
    //
    // 1. 槽位是**全插件共用**的 list，别人的详情页也会调我们的组件，
    //    所以必须先判断 subject 是不是自己，不是就 return null。
    //
    //    ⚠ subject 的形状是分层的，不是扁平的：
    //        bundle（已安装包）：{ kind: 'bundle', pkg: { name, version, … } }
    //        item  （内置插件）：{ kind: 'item',  id }
    //    包名在 **subject.pkg.name**，不在 subject.name！
    //    之前判断 subject.name 导致永远不匹配、整块设置区不渲染 —— 就是这个坑。
    //
    // 2. 两个开关各注册一条 entry，各自是一个独立的小节（标题 + 说明 + 开关），
    //    不再合成一个大区块。
    var PLUGIN_PACKAGE_NAME = 'dsh-client-ui-mc-skin'

    function isOwnSubject(subject) {
      if (subject === null || typeof subject !== 'object') return false
      // 已安装包：包名在 pkg.name
      if (subject.pkg !== undefined && subject.pkg !== null
        && subject.pkg.name === PLUGIN_PACKAGE_NAME) return true
      // 内置插件形态（万一将来本插件被内置）：id 里带 mc-skin
      if (subject.id !== undefined && String(subject.id).indexOf('mc-skin') !== -1) return true
      // 兜底：扁平形态（旧版协议）
      if (subject.name === PLUGIN_PACKAGE_NAME) return true
      return false
    }

    /**
     * 一个设置卡片，外观对齐「包含的组件」那一块（.V7pFBG_row）：
     *   [图标框] 标题 / 描述 ............ [开关]
     * 带独立底色、1px 黑框、上亮下暗的 MC 立体边，与插件页其它卡片同款。
     *
     * 为什么要自己画卡片而不是直接复用 .V7pFBG_row：
     * 那是 ui-plugin-manager 的 CSS Module 局部类，名字带 hash，跨包不可依赖。
     * 这里用等价的内联样式复刻，保证观感一致且不受对方改名影响。
     */
    function SettingsCard(props) {
      return React.createElement('section',
        {
          'data-mc-settings': props.field,
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '12px 14px',
            marginTop: 8,
            border: '1px solid #030303',
            backgroundColor: '#3E3F40',
            backgroundImage:
              'linear-gradient(#4A4B4C,#4A4B4C),linear-gradient(#2A2B2B,#2A2B2B)',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center top,center bottom',
            backgroundSize: '100% 1px,100% 1px',
            borderRadius: 0,
          },
        },
        // 图标框：和 .rowIcon 同尺寸（40×40，细边框）
        React.createElement('span',
          {
            'aria-hidden': 'true',
            style: {
              flex: 'none',
              width: 40,
              height: 40,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '.5px solid #030303',
              borderRadius: 0,
              backgroundColor: '#313233',
              color: '#C6C6C6',
              fontSize: 18,
              lineHeight: 1,
            },
          }, props.glyph),
        // 中间：标题 + 描述
        React.createElement('div',
          { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 } },
          React.createElement('div',
            { style: { fontSize: 13.5, fontWeight: 500, lineHeight: '20px' } }, props.title),
          React.createElement('div',
            {
              style: {
                fontSize: 11.5,
                lineHeight: '16px',
                color: 'var(--dsw-alias-label-tertiary)',
              },
            }, props.description + SETTINGS_HINT)),
        // 右侧：状态文字 + 开关
        React.createElement('div',
          {
            style: {
              flex: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12.5,
              lineHeight: '18px',
              color: 'var(--dsw-alias-label-secondary)',
            },
          }, props.status, props.control))
    }

    function ThemeSettingsSection(props) {
      if (!isOwnSubject(props.subject)) return null
      var on = themeStore.use()
      return React.createElement(SettingsCard, {
        field: 'theme',
        glyph: '🎨',
        title: 'MC 主题',
        description: '控制配色、标志图与按钮皮肤。关闭即恢复原生外观。',
        status: on ? '已启用' : '已关闭',
        control: React.createElement(ThemeToggle, { hideCaption: true }),
      })
    }

    function FontSettingsSection(props) {
      if (!isOwnSubject(props.subject)) return null
      var on = fontStore.use()
      var status = fontStatusStore.use()
      return React.createElement(SettingsCard, {
        field: 'font',
        glyph: '字',
        title: 'MC 字体',
        description: '把界面文字换成 Minecraft Seven + Noto Sans SC 字体（中英文全覆盖）。'
          + '字体约 9 MB，由 Host 半边按需发货，只在首次打开开关时下载一次。',
        status: on ? (FONT_STATUS_TEXT[status] || FONT_STATUS_TEXT.ready).replace('已启用 · ', '') : '已关闭',
        control: React.createElement(FontToggle, { hideCaption: true }),
      })
    }

    // ── 样式表内容 ──────────────────────────────────────────────────
    // 变量必须写在 html body 上：主题把变量定义在 body，写在 :root 的即使带
    // !important 也赢不了——自定义属性是继承的，而继承不看重要性。
    var BTN_SEL = 'button:not([data-mc-swatch]):not([class*="_tab"]):not([class*="_crumb"])'
      + ':not([class*="_brand"]):not([class*="_card"]):not([class*="_row"])'
      + ':not([class*="_bubble"]):not([class*="_mark"]):not([class*="_close"])'
      // 开关（Switch）必须排除：它也是个 <button>，会被按钮皮肤刷成
      // #C6C6C6 立体面板 + 五层渐变背景，把 on.png/off.png 盖掉。
      // 而且 :not() 越多 specificity 越高，按钮那条会赢过后面给开关写的
      // 规则 —— 所以必须在源头排除，不能靠后面覆盖。
      + ':not([class*="_switch"])';
    // ── 卡片容器选择器 ──────────────────────────────────────────────
    //
    // [class*="_card"] 是子串匹配，会命中卡片内部的所有 _cardXxx 元素：
    //   cardMain / cardHead / cardDesc / cardTitle / cardIcon / cardEnd /
    //   cardOpen / cardArrow / cardLink / cardActive …
    // 给它们统一加边框，就会出现「黑框套黑框」。
    //
    // 这里排除掉这些已知的内部类，只留下容器本身。
    //
    // ⚠ 两个容易搞错的点（都踩过）：
    //
    // 1. **不能排除 _cardLink**。ItemCard（"内置插件配置""实验性插件"两组
    //    用的就是它）把 li 的类名写成 `card cardLink` —— cardLink 是
    //    容器自己的修饰类（表示整行可点），不是内层元素。排除它会导致
    //    这两组卡片彻底失去外框，只剩图标那个原生细框，看起来像
    //    "边框画到图标上去了"。
    //
    // 2. **要排除 _cards**（复数）。它是 <ul> 列表容器，不该有卡片皮肤。
    //    注意 [class*="_card"] 会命中 _cards，所以这条必须留着。
    var CARD_SEL = '[class*="_card"]'
      + ':not([class*="_cardMain"]):not([class*="_cardHead"]):not([class*="_cardDesc"])'
      + ':not([class*="_cardTitle"]):not([class*="_cardIcon"]):not([class*="_cardEnd"])'
      + ':not([class*="_cardOpen"]):not([class*="_cardArrow"])'
      + ':not([class*="_cardActive"]):not([class*="_cardBody"]):not([class*="_cardRow"])'
      + ':not([class*="_cards"])';
    var SB_SEL = 'html body [class*="_sidebarCol"]';
    var CONV_SEL = 'html body [data-phase][class*="_root"]';
    // 关闭按钮。真实类名是 ui-primitives/Modal.module.css 的 .close（全小写），
    // 编译成 `_close_<hash>`。原来那条 `[class*="Close"]` 是不存在的 ——
    // 大小写敏感，CSS Module 不会把类名首字母大写，所以一直是死规则。
    var CLOSE_SEL = 'button[class*="_close"]'
    var TAB_SEL = '[class*="_tabs"] > button[class*="_tab"]'

    function buildCss() {
      var textHex = TEXT_PRIMARY
      return [
        '*:not(svg){border-radius:0 !important;}',
        'img,canvas{image-rendering:pixelated;}',
        'body,button,input,textarea,select{font-family:"Courier New",ui-monospace,SFMono-Regular,Menlo,monospace !important;}',

        // 全局文字颜色：整个 label 层级亮度递降，保留层次。
        //
        // ⚠ 透明度不能再低。这套层次原来是 .74/.56/.44，在侧边栏 #313233 上
        // 勉强能看（5.2:1），但对话区的底是 #6B6B6B 这种中灰，半透明白压上去
        // 会直接糊掉：
        //     .74 白 / #6B6B6B → 3.5:1      .56 → 2.4:1      .44 → 1.8:1
        // 用户报的「黑背景地方字体变灰看不清」就是这个。层次感要靠字号和字重
        // 去做，不能靠把字调到快看不见。
        //
        // 现在这套数值是按**最差底色**（对话区 #6B6B6B，比侧边栏 #313233 亮得多）
        // 定的。对比度是相对亮度算的，深色文字压深底容易过，浅色文字压中灰底才是
        // 瓶颈 —— 所以基准取对话区，侧边栏自然满足：
        //     primary #F2F2F2 / #6B6B6B → 7.4:1   （正文，远超 AA 的 4.5）
        //     secondary .90            → 5.4:1   （次要信息）
        //     tertiary  .80            → 4.1:1   （补充说明，接近 AA）
        //     caption   .72            → 3.3:1   （时间戳等，大字号下可接受）
        // 层级之间靠 8~10 个百分点的透明度差拉开，而不是靠"调暗到快看不见"。
        'html body{'
          + '--dsw-alias-label-primary:' + textHex + ' !important;'
          + '--dsw-alias-label-secondary:' + withAlpha(textHex, 0.90) + ' !important;'
          + '--dsw-alias-label-tertiary:' + withAlpha(textHex, 0.80) + ' !important;'
          + '--dsw-alias-label-caption:' + withAlpha(textHex, 0.72) + ' !important;'
          + '--dsw-alias-bg-base:' + R_FILL + ' !important;'
          + '--dsw-specific-sidebar-fill:' + L_FILL + ' !important;'
          + '--dsw-alias-border-l3:' + L_EDGE + ' !important;'
          // ── 以下这批原本只靠 theme.overrideTokens() 下发 ──────────────
          //
          // ⚠ 这是一次重要修正。TOKENS 对象里有 25 个 token，但 buildCss()
          // 的 html body 段原来只写了其中 5 个，剩下 20 个**完全依赖**
          // theme.overrideTokens() 那条路（它把值写进 body 的行内样式）。
          //
          // 一旦 themeService 拿不到（ctx.get('theme') 返回 undefined，
          // 比如 theme 服务在插件 apply 时还没激活），overrideTokens 就永不
          // 执行，这 20 个 token 全部回落成 DSH 原生浅色值 —— 表现为：
          //   · 代码块底色变白（--dsw-alias-markdown-code-block）
          //   · 设置弹窗变白（--dsw-alias-bg-layer-2）
          //   · 各类面板白底白字
          // 而侧边栏/按钮仍正常，因为它们走的是 buildCss 里那几条 <style>。
          // 这就是用户看到的"重启后突然一片白"。
          //
          // 修法：把这些 token 也写进 buildCss，让样式表这条路独立兜住，
          // 不再单点依赖 overrideTokens。两条路同时存在，谁生效都同一个值。
          // 值必须与 TOKENS 里保持一致（改一处要改两处）。
          + '--dsw-alias-bg-layer-1:#3A3B3C !important;'
          + '--dsw-alias-bg-layer-2:#2A2B2C !important;'
          + '--dsw-alias-bg-layer-3:#333435 !important;'
          + '--dsw-alias-bg-overlay:#3E3F40 !important;'
          // ── 设置页的「卡片底」token ────────────────────────────────
          //
          // DSH 在 ui-theme 的 base.css 里定义了：
          //     body{
          //       --dsw-alias-settings-card-fill: var(--dsw-alias-bg-layer-2);
          //       --dsw-alias-settings-card-stroke: var(--dsw-alias-border-l4);
          //     }
          // 设置页里所有"卡片"都用它取底色 —— 账号信息卡、充值余额卡、
          // 模型供应商行（rowCard）、Agent 预设卡、插件清单卡……
          //
          // 问题：本主题把 bg-layer-2 钉成了 #2A2B2C（近黑），于是这些卡片
          // 全是近黑底；而旁边那些含 `_card` 子串的卡片（如 _6qcDqa_card
          // 账号信息卡）被 CARD_SEL 刷成了 #3E3F40（亮灰）—— 同一页里
          // 两种卡片深浅不一，看起来就是"有的卡片没跟上主题"。
          // （注意 _balanceCard 不含 `_card` 子串，所以 CARD_SEL 管不到它，
          //   它一直是原生 token 的深色，这个差异就是这么来的。）
          //
          // 修法：单独把 settings-card-fill 指向与卡片一致的 #3E3F40，
          // 而不是去改 bg-layer-2 —— 后者还被设置弹窗面板用着，
          // 改亮会让整个弹窗背景变浅，破坏现有观感。
          + '--dsw-alias-settings-card-fill:#3E3F40 !important;'
          + '--dsw-alias-settings-card-stroke:#030303 !important;'
          + '--dsw-alias-markdown-code-block:' + L_FILL + ' !important;'
          + '--dsw-alias-markdown-code-block-banner:#2A2B2C !important;'
          + '--dsw-specific-tip:#353638 !important;'
          + '--dsw-alias-bg-module-platform:#1B1C1D !important;'
          + '--dsw-alias-bg-multi-select:#2A2B2C !important;'
          + '--dsw-alias-bg-mask-drop:#000000B3 !important;'
          + '--dsw-alias-button-elevated-fill:#3A3B3C !important;'
          + '--dsw-alias-button-floating-fill:#3A3B3C !important;'
          + '--dsw-alias-button-ghost-active-fill:#3A3B3C !important;'
          + '--dsw-alias-interactive-bg-hover-solid:#3A3B3C !important;'
          + '--dsw-alias-scrollbar-bg-l1:#313233 !important;'
          + '--dsw-alias-scrollbar-bg-l2:#474848 !important;'
          + '--dsw-alias-border-l1:#030303 !important;'
          + '--dsw-alias-border-l2:#5A5C5E !important;'
          + '--dsw-alias-brand-primary:#6ABF4D !important;'
          + '--dsw-alias-state-warn-primary:#D9A441 !important;'
          // 滚动条 thumb 的两个 token：本文件其余 token 全是 --dsw- 前缀，
          // 这里原本写的 --dsh- 很可能是笔误。无法在离线环境核对 DSH 的真实
          // token 名，所以两个前缀都发一遍 —— 认哪个生效哪个，不认的那个只是
          // 一个没人读的自定义属性，没有副作用。
          + '--dsh-scrollbar-thumb:#C6C6C6 !important;'
          + '--dsh-scrollbar-thumb-hover:#D6D6D6 !important;'
          + '--dsw-scrollbar-thumb:#C6C6C6 !important;'
          + '--dsw-scrollbar-thumb-hover:#D6D6D6 !important;}',

        // 行内代码 / 代码块
        //
        // ⚠ kbd 必须排除出去。原来这条写的是 `code,pre,kbd,samp`，而 DSH 的
        // 快捷键提示组件（ui-primitives 的 ShortcutKeys）正是用
        //   <span class="_keys_38b9q_1">
        //     <kbd class="_key_38b9q_1">Ctrl</kbd>
        //     <kbd class="_separator_38b9q_30">+</kbd>
        //     <kbd class="_key_38b9q_1">K</kbd>
        //   </span>
        // 渲染的，原生样式是 background:var(--dsw-alias-tooltip-key-bg)（浅色）。
        // 被这条规则命中后，全站每一个快捷键提示都变成 #313233 深底 + 黑边，
        // 叠在浅色菜单项上就是用户截图里那种"黑块里的暗字"。
        // kbd 不是代码块，把它从这条里摘掉即可；行内代码/代码块不受影响。
        'code,pre,samp{background-color:' + L_FILL + ' !important;background-image:none !important;'
          + 'border:1px solid ' + L_EDGE + ' !important;}',

        // ── 代码块 / Diff / 终端 ──
        //
        // 这里原来是 8 条 [class*="_codeViewer"] / "_diff" / "_lineAdd" … 规则，
        // 全部是死规则：这些面板用的是 ui-primitives 里的
        // CodeBlock / DiffBlock / ReadBlock / TerminalBlock / SearchBlock，
        // 它们的 CSS Module 类名是 .block / .body / .line / .add / .del 这种
        // **短名**，源码里根本没有 `_codeViewer`、`_diffHeader` 这些前缀。
        // 核对脚本：tools/verify-selectors.mjs（58 条里 37 条是死的）。
        //
        // 改成走 token：底色已由 TOKENS 里的
        // --dsw-alias-markdown-code-block(-banner) 统一钉死，三个面板自动跟随。
        // 这里只保留 diff 增删行的语义色 —— DiffBlock 用
        // .del → state-error-primary、.add → state-success-primary
        // 两个 token，所以改这两个就同时改掉了增删行的颜色。
        //
        // 取值用 Minecraft 官方 16 色板：§c 红 #FF5555 / §a 绿 #55FF55。
        // 删除=红石红、添加=绿，符合 MC 的视觉直觉。
        // 对比度（底色是代码面板的 #313233）：红 4.0:1、绿 9.4:1。
        'html:root body{'
          + '--dsw-alias-state-success-primary:#55FF55 !important;'
          + '--dsw-alias-state-error-primary:#FF5555 !important;}',

        // 消息泡泡 / 列表行：只上底色，不加边框
        // （_userMessage / _userTurn 是死规则，已删：DSH 没有这两个类，
        //   用户消息走的是 MessageItem.module.css 的 .bubble，已在下面覆盖。）
        '[class*="_bubble"]{background-color:' + L_FILL + ' !important;background-image:none !important;}',
        // ⚠ _rowCard 必须排除。它是设置页「模型供应商」那种整行卡片
        // （ui-settings-models 的 .jrmgQW_rowCard），类名含 `_row` 子串，
        // 会被这条刷成 #313233；但它本该走 --dsw-alias-settings-card-fill
        // （= #3E3F40），和同页其它卡片保持一致。
        // 不排除的话，设置页里「充值余额」是亮灰、下面每行供应商却是深灰，
        // 深浅不一（用户截图报过）。
        '[class*="_row"]:not([class*="_rowCard"]),[class*="_millerRow"],'
          + '[class*="_rowSeat"]{background-color:' + L_FILL + ' !important;background-image:none !important;}',
        // 排除之后要把它补回卡片底色。
        // 注意 _rowCard 不含 `_card` 子串（是 rowCard），CARD_SEL 管不到它，
        // 所以这里单独给一条，值与本主题的 settings-card-fill 保持一致。
        '[class*="_rowCard"]{background-color:#3E3F40 !important;}',
        // ⚠ 上面那条 _row 是极宽的子串匹配，会误伤弹出面板内部的行。
        //
        // 实例：ContextMeter（上下文占用）的 <dl> 类名是 `A6Bq1a_rows`、
        // 每行是 `A6Bq1a_row`，都含 `_row` 子串 → 被刷成 #313233 深色；
        // 而它外层 .panel 用的是 --dsw-specific-menu（浅色半透明），
        // 表现为浅色浮层里嵌着一块突兀的黑底。面板标题 `_header`、
        // 进度条 `_bar` 不含 `_row`，所以黑块正好只盖住下面那三行。
        //
        // 修法用「加法」而不是收窄上面的选择器：给浮层容器内部把 _row
        // 重新刷回透明。这样既修好误伤，又完全不影响消息列表行原有的上色
        // —— 不用去猜哪个 _panel/_menu 类名算浮层，也就不会误伤侧边栏面板。
        //
        // 覆盖三类浮层容器：role=dialog（ContextMeter 用的就是它）、
        // 以及类名里带 _panel / _popover / _menu 的容器。
        //
        // ⚠ 必须排除 _rowCard。设置面板本身就是 role="dialog"，
        // 而「模型」页每行供应商的类名是 jrmgQW_rowCard（含 `_row` 子串），
        // 而且它就在这个 dialog 里面 —— 于是被本条刷成 transparent，
        // 透出弹窗深色底，看起来就是"模型页的卡片没跟上主题"。
        // 本条的 specificity 是 (0,2,0)，比 [class*="_rowCard"] 的 (0,1,0)
        // 高，所以不排除的话后面怎么写都盖不过它。
        '[role="dialog"] [class*="_row"]:not([class*="_rowCard"]),'
          + '[class*="_panel"] [class*="_row"]:not([class*="_rowCard"]),'
          + '[class*="_popover"] [class*="_row"]:not([class*="_rowCard"]),'
          + '[class*="_menu"] [class*="_row"]:not([class*="_rowCard"]){'
          + 'background-color:transparent !important;background-image:none !important;}',
        // 卡片内部的 row 必须透明：消息卡片的工具行就是 _row，
        // 给它上色会在卡片底部拉出一条深色带。
        '[data-composer-card] [class*="_row"]{background-color:transparent !important;}',
        // 卡片底色：排除按钮斜角还不够，激活卡片是浅底，会被白字压掉
        //
        // ⚠ 这里必须用「卡片容器」选择器，不能用裸的 [class*="_card"]。
        // 后者是**子串匹配**，会把卡片内部所有含 _card 的元素一起刷上：
        //     V7pFBG_card       ← 真正要的卡片容器
        //     V7pFBG_cardMain   ← 内层文字容器（flex 列）
        //     V7pFBG_cardHead   ← 卡片头部
        //     V7pFBG_cardDesc / _cardTitle / _cardIcon / _cardEnd …
        // 结果就是每个插件卡片「黑框里套黑框」—— 外层卡片一圈，
        // 内层 cardMain 又各自描一圈，视觉上非常乱（用户截图报过）。
        // CARD_SEL 只匹配容器本身，见下面的定义。
        CARD_SEL + '{background-color:' + L_FILL + ' !important;}',
        '[class*="_cardActive"]{background-color:#3A3B3C !important;box-shadow:inset 0 0 0 1px #6ABF4D !important;}',

        // ── 设置项分块 ──────────────────────────────────────────────
        //
        // 插件页的列表容器是 .V7pFBG_cards{gap:2px}，而每张 .V7pFBG_card
        // 本身**没有背景色**（只有 hover/active 才上色）。2px 间距下，
        // 一圈圈透明卡片在深色底上看起来就是"糊成一整块"，没有分隔感。
        //
        // MC 原版设置页是一块一块的独立面板（参考用户给的原版截图）：
        // 每项一个带黑框的独立块，块与块之间有明显空隙。
        //
        // 第一版只把 gap 调到 6px，实测仍看不出分块 —— 因为卡片底色
        // #313233 和页面底色 #6B6B6B 之间只隔了 1px 黑框，深色叠深色，
        // 6px 的空隙被两边的黑框吃掉了。所以这里三管齐下：
        //   · gap 拉到 10px（空隙本身要足够宽）
        //   · 卡片底色比背景**更亮**（#3E3F40），靠明度差分层
        //   · 保留 1px 黑框 + 顶部亮边/底部暗边（MC 面板的立体感）
        '[class*="_cards"]{display:flex !important;flex-direction:column !important;gap:10px !important;}',
        // 描边只加在卡片容器上（CARD_SEL 已排除 cardMain/cardHead 等内层类），
        // 这样每张卡片只有**外面一圈**黑框，内部不再套框。
        CARD_SEL + '{'
          + 'border:1px solid ' + L_EDGE + ' !important;'
          + 'background-color:#3E3F40 !important;'
          + 'background-image:linear-gradient(#4A4B4C,#4A4B4C),linear-gradient(#2A2B2B,#2A2B2B) !important;'
          + 'background-repeat:no-repeat !important;'
          + 'background-position:center top,center bottom !important;'
          + 'background-size:100% 1px,100% 1px !important;}',
        // 列表项自身有 margin:0 -8px（负外边距做整行点击区），分块后会让
        // 卡片超出容器边缘，这里收回到 0，块才会规整地排列。
        '[class*="_cards"] > ' + CARD_SEL + '{margin:0 !important;}',
        // 保险：把卡片内层那些容器强制去掉边框和背景。
        // 万一还有没列举到的 _cardXxx 类（DSH 升级后新增的），
        // 这条兜底能防止再次出现套框。
        '[class*="_cardMain"],[class*="_cardHead"],[class*="_cardDesc"],'
          + '[class*="_cardTitle"],[class*="_cardEnd"],[class*="_cardBody"]{'
          + 'border:0 !important;background:transparent !important;}',
        // 模型设置里「编辑」展开的那块面板：底色由 --dsw-alias-bg-module-platform
        // 钉成黑（见 TOKENS），这里再补一圈亮边，让它和外面的卡片分层。
        // 只认 rowCard 里的那一层——addCard / setupCard 里的同名组件是组件自己
        // 写成透明的（background:0 0），给它加边框会出现双重框。
        // （rowCard 在 ui-settings-models/ModelsSection.module.css:55 确实存在，
        //   且以 styles['rowCard'] 下标形式引用，解析脚本要同时认点访问和下标访问。）
        '[class*="_rowCard"] > [class*="_editor"]{border:1px solid #C6C6C6 !important;}',
        // 对话轮次标记轨
        '[class*="_mark"]{background:transparent !important;border:0 !important;box-shadow:none !important;}',
        // markdown 标签页本体是 DIV，浅底白字，需要单独上色。
        // 注意这里用 _tab / _tabActive 而不是 _tab_ / _tabActive_：
        // CSS Module 编译出来是 `_tab_<hash>`，写 "_tab_" 要求类名里紧跟一个
        // 下划线，实际是 hash 首字符（字母或数字），所以带尾下划线的两条
        // 曾经是死规则。去掉尾下划线后匹配的是 `_tab_<hash>` 里的 `_tab`，
        // 同样能命中，且对任意 hash 都成立。
        //
        // ⚠ 必须排除 _tabLayout。那是 ui-dockkit 的标签页布局容器
        // （ui-dockkit/src/components/TabLayout.tsx 的 css.tabLayout），
        // 在会话里实测是 577×822 的整块 —— 它本身是 DIV 且类名含 `_tab`，
        // 会被裸的 [class*="_tab"] 子串命中，于是整个会话区被刷成不透明
        // #313233，pane 内容全被盖住（表现为右侧一大片"空白"，文字在容器
        // 边界被硬切）。_tabStrip（同一个包的 role=tablist 标签条）继续
        // 上色，那是本来想要的效果。
        //
        // ⚠ 同样必须排除 _tabs（复数）及其内部的 tab 按钮。
        //
        // SegmentedTabs 的结构是：
        //   <div class="_tabs_1p79o_1">          ← 容器，含 _tab 子串
        //     <button class="_tab_1p79o_1">       ← 按钮，也含 _tab 子串
        // 容器会被刷成 #313233，而它原生带 padding:4px，
        // 于是「已安装 / 插件市场」两个分页按钮外面露出一整圈深色底。
        //
        // ⚠ 还有一个 CSS 层叠的坑（实测确认）：
        // 这里用 `background-color`（长写），而给分页按钮上绿色用的是
        // `background`（简写）。两者都是 !important 时，即使简写那条
        // 选择器优先级更高、位置更靠后，Chrome 里仍然是**长写赢**。
        // 最小复现：
        //     [class*="_tab"]{background-color:#313233 !important}
        //     [class*="_tabs"] > button[class*="_tab"]{background:#2F6E1E !important}
        //   → 计算结果 #313233，绿色完全不生效。
        // 所以必须从源头把分页按钮排除掉，不能指望后面覆盖。
        '[class*="_tab"]:not([class*="_tabLayout"]):not([class*="_tabs"])'
          + ':not([class*="_tabs"] *)'
          + ',[class*="_tabActive"]:not([class*="_tabs"] *){'
          + 'background-color:' + L_FILL + ' !important;background-image:none !important;}',

        // ── 左：工作区 ──
        SB_SEL + '{border:1px solid ' + L_EDGE + ' !important;}',
        SB_SEL + ',' + SB_SEL + ' > *{'
          + 'background-color:' + L_FILL + ' !important;'
          + 'background-image:linear-gradient(' + L_TOP + ',' + L_TOP + '),linear-gradient(' + L_BOTTOM + ',' + L_BOTTOM + ') !important;'
          + 'background-repeat:no-repeat !important;background-position:center top,center bottom !important;'
          + 'background-size:100% 1px,100% 1px !important;}',

        // ── 右：对话 ──
        CONV_SEL + '{'
          + 'border:1px solid ' + R_EDGE + ' !important;background-color:' + R_FILL + ' !important;'
          + 'background-image:linear-gradient(' + R_TOP + ',' + R_TOP + '),linear-gradient(' + R_BOTTOM + ',' + R_BOTTOM + ') !important;'
          + 'background-repeat:no-repeat !important;background-position:center top,center bottom !important;'
          + 'background-size:100% 1px,100% 1px !important;}',

        // ── button_template：黑框 + #F1F1F1 上/左/右高光 + 白线 + 2px #555555 底 ──
        'button{--mc-face:#C6C6C6;--mc-hi:#F1F1F1;--mc-lo:#555555;--mc-line:#FFFFFF;}',
        BTN_SEL + '{'
          + 'border:1px solid #000 !important;border-radius:0 !important;color:#1C1C1C !important;text-shadow:none !important;'
          + 'background-color:var(--mc-face) !important;'
          + 'background-image:linear-gradient(var(--mc-lo),var(--mc-lo)),'
            + 'linear-gradient(var(--mc-line),var(--mc-line)),'
            + 'linear-gradient(var(--mc-hi),var(--mc-hi)),'
            + 'linear-gradient(var(--mc-hi),var(--mc-hi)),'
            + 'linear-gradient(var(--mc-hi),var(--mc-hi)) !important;'
          + 'background-repeat:no-repeat !important;'
          + 'background-position:center bottom,center bottom,center top,left center,right center !important;'
          + 'background-size:100% 2px,calc(100% - 2px) 3px,100% 1px,1px 100%,1px 100% !important;'
          + 'box-shadow:none !important;}',
        BTN_SEL + ':hover{--mc-face:#D6D6D6;}',
        BTN_SEL + ':active{--mc-face:#A8A8A8;--mc-hi:#555555;--mc-lo:#F1F1F1;--mc-line:#8B8B8B;}',
        BTN_SEL + ':disabled{--mc-face:#8B8B8B;--mc-hi:#A8A8A8;--mc-lo:#4A4A4A;--mc-line:#7A7A7A;color:#5A5A5A !important;}',
        BTN_SEL + ':focus-visible{outline:1px solid #FFFFFF;outline-offset:1px;}',

        // ── 开关：复用插件自带的 on.png / off.png ──────────────────────
        //
        // 设置页里「MC 主题」「MC 像素字体」两个开关用的是插件自带的
        // assets/on.png、assets/off.png（30×16 的 MC 风格开关图）。
        // 用户要求全局开关（插件页、实验性插件列表等）统一成同一种外观。
        //
        // DSH 原生开关（ui-primitives 的 Switch）结构：
        //   <button role="switch" class="_switch_1ik0f_5" aria-checked="true|false">
        //     <span class="_thumb_1ik0f_33"/>
        //   </button>
        // 原生是 36×20 圆角胶囊 + 圆形滑块。
        //
        // 做法：把 button 本身画成 on/off 图（background-image），
        // 再把内部那个 _thumb 彻底隐藏 —— 图片本身就是完整开关，
        // 不需要额外的滑块元素。
        //
        // ⚠ 尺寸结论（逐像素解码 + 6 种定位方案实测后确定）：
        // 两张图都是 30×16 画布，但有效内容只有 26×16，且位置**相反**：
        //     off.png  滑块 x=0..9  (左)   轨道 x=10..25   透明边在右
        //     on.png   轨道 x=4..19        滑块 x=20..29 (右)  透明边在左
        //
        // 这意味着：任何 26px 宽的窗口都无法同时正确显示两张图 ——
        // 对 off.png 要取左侧 26px，对 on.png 要取右侧 26px，两者矛盾，
        // 而 on.png 的滑块本来就在最右侧，无论怎么偏移都会贴边/被裁。
        //
        // 所以按钮直接用**画布的完整宽度 30px**，两张图都 1:1 铺满，
        // 不做任何偏移和裁剪。这样：
        //     · off.png 完整显示（右侧 4px 是透明，看不出来）
        //     · on.png  完整显示（左侧 4px 是透明，看不出来）
        // 两个状态的滑块位置天然就是「左 → 右」，正是开关该有的样子。
        '[class*="_switch"]{'
          + 'box-sizing:border-box !important;'
          + 'width:30px !important;height:16px !important;'
          + 'padding:0 !important;border:0 !important;border-radius:0 !important;'
          + 'corner-shape:square !important;box-shadow:none !important;'
          + 'background-color:transparent !important;'
          + 'background-repeat:no-repeat !important;'
          + 'background-size:30px 16px !important;'
          + 'background-position:left center !important;'
          + 'background-image:url(' + ASSETS['off.png'] + ') !important;'
          + 'cursor:pointer !important;flex:none !important;'
          + 'display:block !important;}',
        // 开启态：换成 on.png，同样 1:1 铺满、不偏移
        '[class*="_switch"][aria-checked="true"]{'
          + 'background-image:url(' + ASSETS['on.png'] + ') !important;'
          + 'background-position:left center !important;}',
        // 滑块隐藏：图片已经是完整开关，再多一个滑块会叠出重影
        '[class*="_switch"] [class*="_thumb"]{'
          + 'display:none !important;}',

        // 按钮上的字必须跟着按钮一起变暗 —— 这两条是一体的，拆开就会出对比度事故。
        //
        // 上面那条规则把每个按钮的面板刷成 #C6C6C6（浅色）。但按钮内部往往还有
        // 非 button 的子元素在写字，它们走的是 label token 而不是继承 color：
        //   ._7KE1Ra_triggerEffort{color:var(--dsw-alias-label-caption)}   ← 一个 div
        // 原生主题里这个元素所在的触发器是透明 ghost（background:0 0），浅色注释字
        // 压在深底上没问题；可一旦被刷成 #C6C6C6，就变成 rgba(255,255,255,.44)
        // 压浅灰 —— 对比度 1.28:1，基本看不见。
        //
        // 所以：在按钮及其后代上把整套 label token 钉成深色，让「浅底 + 深字」
        // 始终成立，而不是去猜哪个类名是文字。
        //
        // -inverted / -primary-inverted 故意不在这里覆盖：那对 token 的语义就是
        // 「反色标签」，本来就是给深底配浅字用的。
        BTN_SEL + ',' + BTN_SEL + ' *{'
          + '--dsw-alias-label-primary:#1C1C1C !important;'
          + '--dsw-alias-label-primary-foreground:#1C1C1C !important;'
          + '--dsw-alias-label-primary-dimmed:#3B3B3C !important;'
          + '--dsw-alias-label-secondary:#2A2B2C !important;'
          + '--dsw-alias-label-tertiary:#3B3B3C !important;'
          + '--dsw-alias-label-caption:#474848 !important;'
          + '--dsw-alias-label-dimmed:#3B3B3C !important;}',

        // ⚠ 上面那条只够得到「按钮内部」。但有一类卡片是
        //     <div class="卡片">
        //       <button class="…_main"/>   ← 透明按钮，绝对定位铺满，只负责点击
        //       <span class="…_title">标题</span>  ← 文字的兄弟节点，不在 button 里
        //     </div>
        // 文字的 token 继承自卡片 div 而不是 button，于是拿不到上面的深色覆盖，
        // 只剩全局的 #F2F2F2（浅色）—— 而卡片底是浅色 → 白字压浅底。
        //
        // 实例：右栏启动页「新建终端」卡片（ui-sidebar-terminal 的
        // TerminalGuide：div._entry > Button._main + span._title）。同一排的
        // 「工作区文件」「浏览器」两张卡（ui-sidebar-right 的 EntryBox）整个是
        // <button>，标题在里面，所以是深色 —— 三张卡里只有终端那张字发白，
        // 就是用户截图报的这个问题。
        //
        // 修法：把「卡片容器内有透明按钮」这种结构里的文字也钉成深色。
        // 判据用 [data-sidebar-right-guide-entry]（DSH 给启动页卡片的专属属性），
        // 比猜类名可靠；两边的卡片都带这个属性。
        '[data-sidebar-right-guide-entry]{'
          + '--dsw-alias-label-primary:#1C1C1C !important;'
          + '--dsw-alias-label-primary-foreground:#1C1C1C !important;'
          + '--dsw-alias-label-secondary:#2A2B2C !important;'
          + '--dsw-alias-label-tertiary:#3B3B3C !important;'
          + '--dsw-alias-label-caption:#474848 !important;}',
        '[data-sidebar-right-guide-entry] *{'
          + '--dsw-alias-label-primary:#1C1C1C !important;'
          + '--dsw-alias-label-primary-foreground:#1C1C1C !important;'
          + '--dsw-alias-label-secondary:#2A2B2C !important;'
          + '--dsw-alias-label-tertiary:#3B3B3C !important;'
          + '--dsw-alias-label-caption:#474848 !important;}',

        // ── close.png ──
        CLOSE_SEL + '{border:0 !important;border-radius:0 !important;background-color:transparent !important;'
          + 'background-image:url(' + ASSETS['close.png'] + ') !important;'
          + 'background-repeat:no-repeat !important;background-position:center !important;'
          + 'background-size:15px 15px !important;box-shadow:none !important;'
          + 'color:transparent !important;min-width:15px;min-height:15px;}',

        // ── page_template：只命中分页栏的直接子级，避免全站误伤 ──
        //
        // 全部用 background-color（长写）而不是 background（简写）。
        // 原因见上面 ~795 行那条注释：主题里另有一条
        // [class*="_tab"]{background-color:...!important}，长写与简写混用
        // 时 Chrome 会让长写赢，即使简写优先级更高 —— 分页按钮就再也
        // 上不了绿色。统一成长写后，优先级规则恢复正常（后者覆盖前者）。
        TAB_SEL + '{border:0 !important;border-radius:0 !important;'
          + 'background-color:#2F6E1E !important;background-image:none !important;'
          + 'color:#A9CE9B !important;font-weight:700 !important;letter-spacing:.06em;'
          + 'padding:4px 14px 5px !important;text-shadow:none !important;'
          + 'box-shadow:0 0 0 1px #000000,inset 0 0 0 1px #4C9C34 !important;}',
        TAB_SEL + ':after{display:none !important;}',
        '[class*="_tabs"] > button[class*="_tabActive"]{background-color:#3C8527 !important;color:#FFFFFF !important;'
          + 'box-shadow:0 0 0 1px #000000,inset 0 0 0 1px #6ABF4D !important;}',
        '[class*="_tabs"] > button[class*="_tab"]:hover:not([class*="_tabActive"]){background-color:#458F2E !important;color:#E8F5E0 !important;}',
        '[class*="_tabs"]{gap:8px !important;}',
        // ── 分段分页容器（SegmentedTabs）的外圈深色底 ──────────────
        //
        // 「已安装 / 插件市场」这两个绿色分页按钮外面原本有一圈深色底，
        // 来源是 ui-primitives 的 SegmentedTabs 容器：
        //   ._tabs_1p79o_1{ padding:4px;
        //                   background:var(--dsw-alias-bg-module-platform) }
        // 而本主题把 --dsw-alias-bg-module-platform 钉成了 #1B1C1D（近黑），
        // 于是 4px 的内边距露出一整圈黑边，看着像按钮被一圈深色框住。
        //
        // 修法：容器背景透明、去掉内边距，让两个绿色按钮直接落在页面上。
        // 同时把那个滑动指示器（.indicator，半透明方块）也隐藏 ——
        // 本主题的选中态是靠按钮本身变绿表示的，再叠一个指示器会打架。
        '[class*="_tabs"]{background:transparent !important;padding:0 !important;}',
        '[class*="_indicator"]{display:none !important;}',

        // ── text_template：内凹深底 ──
        'input,textarea{border:1px solid #18191A !important;border-radius:0 !important;'
          + 'background-color:#474848 !important;'
          + 'background-image:linear-gradient(#3B3B3C,#3B3B3C),linear-gradient(#717272,#717272) !important;'
          + 'background-repeat:no-repeat !important;background-position:center top,center bottom !important;'
          + 'background-size:100% 1px,100% 1px !important;box-shadow:none !important;}',
        // 整张消息卡片
        '[data-composer-card]{border:1px solid #18191A !important;background-color:#474848 !important;'
          + 'background-image:linear-gradient(#3B3B3C,#3B3B3C),linear-gradient(#717272,#717272) !important;'
          + 'background-repeat:no-repeat !important;background-position:center top,center bottom !important;'
          + 'background-size:100% 1px,100% 1px !important;box-shadow:none !important;}',
        '[data-composer-input]{border:0 !important;background:transparent !important;box-shadow:none !important;}',
        '[data-composer-placeholder]{color:#8A8B8C !important;}',
        'input::placeholder,textarea::placeholder{color:#8A8B8C !important;}',

        // ── 滑轮模板：伪元素不归 * 管，圆角要单独写 ──
        '::-webkit-scrollbar{width:8px !important;height:8px !important;}',
        '::-webkit-scrollbar-track{background:#313233 !important;border-radius:0 !important;}',
        '::-webkit-scrollbar-corner{background:#313233 !important;}',
        '::-webkit-scrollbar-thumb{background-color:#C6C6C6 !important;'
          + 'background-image:linear-gradient(#FFFFFF,#FFFFFF),linear-gradient(#717171,#717171) !important;'
          + 'background-repeat:no-repeat !important;background-position:center top,center bottom !important;'
          + 'background-size:100% 1px,100% 1px !important;'
          + 'border:1px solid #131311 !important;border-radius:0 !important;}',
        '::-webkit-scrollbar-thumb:hover{background-color:#D6D6D6 !important;}',
        'html{scrollbar-color:#C6C6C6 #313233;scrollbar-width:thin;}',
      ].join('\n')
    }

    // ── 字体样式表 ──────────────────────────────────────────────────
    // 只在像素字体开关打开时注入。字体字节不在这个文件里：@font-face 指向
    // Host 半边（src/index.js）注册的路由，浏览器只在真正用到这个字体族时
    // 才去下载它。
    function buildFontCss() {
      var stack = '"' + FONT_FAMILY + '",' + MONO_STACK
      return [
        // @font-face。字体已换成 MinecraftSeven-NotoSansSC.ttf
        // （Minecraft Seven v2 + Noto Sans SC 合并版）。
        //
        // ⚠ 这里原来带一条 unicode-range:U+0-9F,U+100-10FFFF，
        // 把 U+00A0–U+00FF 这 96 个字符排除出本字体。那是为了绕开旧字体
        // MinecraftAE-Pixel.ttf 的一个缺陷 —— 它这一段字形全画错了
        // （· 显示成字母 u，© ° × ü 等也都不对）。
        //
        // 新字体没有这个问题：用 fontkit 逐码点核对过，· © ° × ü 以及
        // 中文、ASCII 全部有正确字形（31570 个 glyph）。所以这条
        // unicode-range 不但没必要，反而会让这些字符错误地回落到系统字体、
        // 失去像素风。已移除，整段字符现在都由本字体渲染。
        '@font-face{font-family:"' + FONT_FAMILY + '";'
          + 'src:url("' + FONT_ROUTE + '") format("truetype");'
          + 'font-style:normal;font-weight:100 900;font-display:swap;}',

        // 标志专用字体：老字体 MinecraftAE-Pixel，只声明、不强制使用。
        // 只有 BrandName 那个 span 会引用这个族名，正文不受影响。
        // font-display:block 而不是 swap —— 标志是一小块像素图，
        // 用后备字体闪一下再跳变很难看，宁可短暂不显示。
        '@font-face{font-family:"' + LOGO_FONT_FAMILY + '";'
          + 'src:url("' + LOGO_FONT_ROUTE + '") format("truetype");'
          + 'font-style:normal;font-weight:700;font-display:block;}',

        // 像素字体绝对不能合成粗体：伪粗体会把 1px 笔画糊成 2px，像素感全没了。
        // font-synthesis-weight:none 让 weight:700 直接复用 400 的字形。
        // -webkit-font-smoothing:none 让 macOS 别做次像素抗锯齿（别的平台无效）。
        'html body{font-synthesis-weight:none;-webkit-font-smoothing:none;}',

        // ★ 真正管用的那一层：覆写应用消费的两个字体「变量」，而不是给元素设字体。
        //
        // 应用是这么写的：body{font-family:var(--dsw-font-family, -apple-system,…)}，
        // 而输入框 .xxx_input 自己还有一条 font-family:var(--dsw-font-family)。
        // 关键在于「元素自己的声明」永远赢过「从 body 继承来的值」，所以
        // `html body input{font-family:… !important}` 这类写法对 contenteditable
        // 的输入区完全无效 —— 它继承不到，而它自己的声明又赢了。
        //
        // 改成覆写变量就没有这个问题：既有声明不用动，它自己就会解析到像素字体。
        // --dsw-font-family 被整套排版 token 引用（--dsw-font-base-16、
        // --dsw-font-markdown-*、--dsw-font-s-14 …共 40 多处），所以这一条
        // 就能把界面文字整体换掉；--ds-font-family-code 是行内代码和代码块
        // 单独走的那条，不改的话代码区仍是 SF Mono。
        //
        // 选择器用 html:root body 而不是 body：应用把 token 定义在 body 上，
        // 而 html[data-ds-dark-theme] body 这类选择器比 html body 更具体。
        // 这里再抬一级并配 !important，保证深浅两种模式下都赢。
        // 代码字体变量同理：--ds-font-family-code 与全文件通用的 --dsw- 前缀
        // 不一致，无法离线确认哪个是 DSH 的真名，两个都发一遍。
        'html:root body{--dsw-font-family:' + stack + ' !important;'
          + '--ds-font-family-code:' + stack + ' !important;'
          + '--dsw-font-family-code:' + stack + ' !important;}',

        // 兜底：给元素直接设字体的那批仍然保留。变量覆写已经覆盖了绝大多数
        // 场景，但万一某个组件把字体写成字面量而不是 var()，这条还能接住。
        'html body,html body button,html body input,html body textarea,html body select,'
          + 'html body code,html body pre,html body kbd,html body samp{'
          + 'font-family:' + stack + ' !important;}',
      ].join('\n')
    }

    // ── 插件入口 ────────────────────────────────────────────────────
    function apply(ctx) {
      var theme = ctx.get('theme')
      if (theme !== undefined) themeService = theme

      // ── 持久化：接 Host 设置文档 ──
      //
      // 顺序很重要：先 bind 出 scope 并采纳一次已存的值，再 applySkin()，
      // 否则会出现"先按默认值渲染一帧、再跳到用户存的值"的闪烁。
      //
      // settingsScope 是可选依赖：拿不到就退化成内存态（开关照常可用，只是
      // 不跨会话记住），不阻塞插件加载。
      var settingsScope = ctx.get('settingsScope')
      if (settingsScope !== undefined && typeof settingsScope.bind === 'function') {
        scope = settingsScope.bind({ namespace: SETTINGS_NAMESPACE })
        adoptSettings()
        scopeStatus = (scope.getSnapshot() || {}).status || 'idle'
        // Host 侧变更（另一个标签页动了开关）也要跟随
        ctx.effect(function () { return scope.subscribe(adoptSettings) },
          PLUGIN_ID + ': settings adoption')
        if (scopeStatus === 'ready') {
          SETTINGS_HINT = '开关状态会保存在 Host 设置里，重启后保留。'
        }
      }

      applySkin()
      // 字体开关默认开着，所以启动时也要探一次；关着的话浏览器根本不会去
      // 请求那 16 MB。
      if (fontStore.get()) probeFont()

      ctx.effect(function () {
        return function () {
          tokenDispose !== null && tokenDispose()
          tokenDispose = null
          removeCss()
          while (slotHandles.length > 0) {
            var dispose = slotHandles.pop()
            try { dispose() } catch (e) { /* 已卸载 */ }
          }
          while (controlHandles.length > 0) {
            var disposeControl = controlHandles.pop()
            try { disposeControl() } catch (e) { /* 已卸载 */ }
          }
        }
      }, PLUGIN_ID + ': teardown')

      var slots = ctx.get('slots')
      if (slots === undefined) return
      slotsService = slots
      applySlots()

      // 控制面永远挂载，否则关掉之后没法重新打开。
      // 句柄存进 controlHandles，随插件卸载一起释放（见上面的 teardown）。
      //
      // ── 挂载位置：插件详情页，两个独立小节 ──────────────────────
      //
      // 挂 plugins.detail.section（插件面板 → 点进本插件 → 详情页底部），
      // 不再挂 settings.general.item（那是全局通用设置页）。
      //
      // 注册**两条** entry，而不是一条：每个开关自成一个小节
      // （左标题说明 + 右开关），互不干扰，视觉上和 DSH 自己的设置行一致。
      // order 20/21 相邻，保证两个小节挨着出现。
      controlHandles.push(slots.inject('plugins.detail.section', function () {
        return slots.register(
          { name: 'plugins.detail.section', id: 'mc-skin-theme', order: 20, label: 'MC 主题' },
          ThemeSettingsSection)
      }))
      controlHandles.push(slots.inject('plugins.detail.section', function () {
        return slots.register(
          { name: 'plugins.detail.section', id: 'mc-skin-font', order: 21, label: 'MC 字体' },
          FontSettingsSection)
      }))
    }

    exports.apply = apply
    // inject 声明本插件依赖的服务。'slots' 用于注册槽位；'theme' 用于
    // theme.overrideTokens() 覆盖颜色 token。
    //
    // ⚠ 原来只有 ['slots']，而 apply() 里用 ctx.get('theme') 取主题服务。
    // cordis 的 ctx.get() 在服务尚未激活时返回 undefined，此时 themeService
    // 永久为 null，overrideTokens 永不执行 —— TOKENS 里那 20 个只靠它下发的
    // token 就全部回落成 DSH 原生浅色（代码块、设置弹窗变白底）。
    // 把 'theme' 写进 inject，cordis 会等该服务就绪后再调用 apply()。
    //
    // 注意：这不能完全替代 buildCss 里的 token 兜底（见上面 html body 段），
    // 两者互为保险 —— 万一 theme 服务仍然拿不到，样式表那条路照样生效。
    exports.inject = ['slots', 'theme']
    return module.exports
  },
})