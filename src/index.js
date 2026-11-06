/**
 * Host 半边：把 assets/MinecraftSeven-NotoSansSC.ttf 通过一条 HTTP 路由发给浏览器。
 *
 * 为什么字体必须走 Host 半边，而不是像 PNG 那样内联进 client.js：
 * 客户端插件只有 client.js 一个入口，没有静态资源路由；而这份字体是
 * 16 MB，base64 内联要撑成 22 MB 的脚本，每次打开界面都得先解析一遍。
 * 所以字体留在磁盘上，这里按需发货：浏览器只在真正用到该字体族时才下载，
 * 之后靠 ETag 走 304 复验，不会重复传 16 MB。
 *
 * 路由路径与客户端半边的 @font-face 是同一个常量，改一处就要改另一处：
 *   src/client.js 里的 FONT_ROUTE
 */

import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/** 正文字体路由。客户端 @font-face 的 src 必须与此一致。 */
const FONT_ROUTE = '/dsh-mc-skin/font.ttf'

/** 标志字体路由（老字体 MinecraftAE-Pixel，只给侧边栏品牌名用）。 */
const LOGO_FONT_ROUTE = '/dsh-mc-skin/font-logo.ttf'

/**
 * 持久化命名空间。必须匹配 Host 的 /^[a-z][a-z0-9-]*$/。
 * 客户端半边 src/client.js 里有一份同名常量，改一处要改两处。
 */
const SETTINGS_NAMESPACE = 'ui-mc-skin'

/** 两个开关的字段名。与 src/client.js 的 SETTINGS_FIELD_* 一一对应。 */
const FIELD_THEME = 'themeEnabled'
const FIELD_FONT = 'pixelFontEnabled'

/**
 * 开关的持久化 schema —— 不依赖 @deepseek-ai/schemastery。
 *
 * 为什么不 import schemastery：本包常以 `link:` 装进 profile，
 * 而 Node 解析软链时用的是**真实路径**（D:\...\dsh-client-ui-mc-skin），
 * 从那里向上走只能到工作区的 node_modules，够不到 dsh 自带的依赖树。
 * web profile 恰好把 schemastery 摊在 node_modules/@deepseek-ai/ 下所以能解析，
 * 但桌面端（tauri profile）的 @deepseek-ai/ 是空的、依赖全在它自带的 dsh 树里，
 * 于是 import 直接 ERR_MODULE_NOT_FOUND，整个 Host 半边加载失败
 * ——字体路由和设置命名空间一起没了。
 *
 * 所以这里不引入依赖，直接实现 dsh-settings 真正用到的那两部分契约。
 * 它对 schema 的用法（dsh-settings/lib/index.js）只有两处：
 *
 *   1. resolve() 里：  const value = schema(mergeLayers(base, section))
 *      —— 把「composition base + 用户层」合并后的对象喂进来，拿回补过默认值的对象。
 *   2. describe() 里： registration.schema.toJSON()
 *      —— 给配置界面看的 JSON Schema 描述。
 *
 * 于是只要「可调用 + 有 toJSON」就够，不需要完整的 schemastery。
 */
const SCHEMA_DEFAULTS = { [FIELD_THEME]: true, [FIELD_FONT]: true }

const SCHEMA_FIELDS = [
  { key: FIELD_THEME, title: 'MC 主题' },
  { key: FIELD_FONT, title: 'MC 像素字体' },
]

/**
 * 把一层原始值收敛成一个开关：只认布尔，其它一律回落到默认值。
 * 设置文档可能被人手工编辑成杂物，这里不做类型强转、也不抛错 ——
 * 一个坏字段不应该让整个命名空间解析失败（那会让插件加载不出来）。
 */
function readFlag(raw, fallback) {
  return typeof raw === 'boolean' ? raw : fallback
}

/**
 * 见上方说明：一个「可调用 + 可序列化」的最小 schema。
 *
 * 调用结果总是补齐两个字段的完整对象，所以客户端读到的永远是布尔，
 * 不会出现 undefined（那种情况客户端会当成"没有偏好"而用内置默认）。
 */
const SettingsSchema = Object.assign(
  function resolveSettings(section) {
    const source = (section !== null && typeof section === 'object') ? section : {}
    const out = {}
    for (const { key } of SCHEMA_FIELDS) {
      out[key] = readFlag(source[key], SCHEMA_DEFAULTS[key])
    }
    return out
  },
  {
    /** 配置界面用的 JSON Schema 描述。形状对齐 dsh-settings 的 describe()。 */
    toJSON() {
      return {
        type: 'object',
        properties: Object.fromEntries(SCHEMA_FIELDS.map(({ key, title }) => [
          key,
          { type: 'boolean', default: SCHEMA_DEFAULTS[key], description: title },
        ])),
      }
    },
  },
)


/**
 * 字体文件位置。lib/index.js 与 src/index.js 都在包根下一层，
 * 所以 `../assets` 两种情况都指向包根的 assets/。
 *
 * 字体已从 MinecraftAE-Pixel.ttf（16 MB，U+00A0–U+00FF 段字形损坏）
 * 换成 MinecraftSeven-NotoSansSC.ttf（9.3 MB，Minecraft Seven v2 +
 * Noto Sans SC 合并版，ASCII / 中文 / 拉丁补充段全部正常）。
 *
 * ⚠ 现在是**两套字体并存**：
 *   · 界面正文 → MinecraftSeven-NotoSansSC.ttf（中英文全覆盖，9.3 MB）
 *   · 侧边栏 MINECRAFT 标志 → MinecraftAE-Pixel.ttf（老字体，16 MB）
 * 标志只要字母，用老字体的像素味更冲，所以单独留着它。
 * 两条路由各自独立，只有真正请求的字体才会被读进内存。
 */
const FONTS = [
  {
    // 正文：新字体
    route: '/dsh-mc-skin/font.ttf',
    file: '../assets/MinecraftSeven-NotoSansSC.ttf',
  },
  {
    // 标志：老字体（只给品牌名用）
    route: '/dsh-mc-skin/font-logo.ttf',
    file: '../assets/MinecraftAE-Pixel.ttf',
  },
].map((entry) => ({
  route: entry.route,
  path: fileURLToPath(new URL(entry.file, import.meta.url)),
  cached: null,
}))

const CONTENT_TYPE = 'font/ttf'

/**
 * 读某个字体并算出它的 ETag（大小 + mtime 就够：内容变了这两个必然变）。
 * 每个字体各自缓存，互不影响。
 * @returns {Promise<{ bytes: Buffer, etag: string }>}
 */
async function fontEntry(font) {
  const info = await stat(font.path)
  const etag = '"' + info.size.toString(16) + '-' + Math.floor(info.mtimeMs).toString(16) + '"'
  if (font.cached !== null && font.cached.etag === etag) return font.cached
  font.cached = { bytes: await readFile(font.path), etag }
  return font.cached
}

/**
 * 一条只服务字体的 GET/HEAD 路由。
 * @param ctx - 用来记日志的上下文。
 * @returns node:http 处理器（自己负责整个响应生命周期）。
 */
function fontHandler(ctx, font) {
  return async function handleFont(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' })
      res.end()
      return
    }

    let entry
    try {
      entry = await fontEntry(font)
    } catch (error) {
      // 文件缺失不是崩溃：客户端会把开关标成"加载失败"，界面照常用后备字体。
      // ctx.logger 不保证存在（不同装配方式下可能没注入），这里先判再用，
      // 否则 catch 块自己会再抛一次，把 404 变成未捕获的 rejection。
      if (error.code !== 'ENOENT' && ctx.logger !== undefined
        && typeof ctx.logger.warn === 'function') ctx.logger.warn(error)
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('mc-skin: font not found at ' + font.path + '\n')
      return
    }

    if (req.headers['if-none-match'] === entry.etag) {
      res.writeHead(304, { etag: entry.etag, 'cache-control': 'public, max-age=0, must-revalidate' })
      res.end()
      return
    }

    res.writeHead(200, {
      'content-type': CONTENT_TYPE,
      'content-length': String(entry.bytes.byteLength),
      'cache-control': 'public, max-age=0, must-revalidate',
      etag: entry.etag,
    })
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    res.end(entry.bytes)
  }
}

/**
 * 注册字体路由。
 *
 * ⚠ 修复记录（重要，别再改回去）：
 *
 * 这里原来写的是"先 get 再 inject"的探测式写法：
 *     if (ctx.get('webServer') !== undefined) mount(ctx)
 *     else ctx.inject(['webServer'], mount)
 *
 * 它会抛
 *     cannot get property "webServer" without inject
 * 原因有两层：
 *
 * 1. `ctx.get(name)` 默认 strict=true，只在提供该服务的 fiber 已经
 *    **active** 时才返回值。插件启动早期 webServer 往往还没 active，
 *    于是 get() 返回 undefined，代码走进 else 分支。
 *
 * 2. `ctx.inject(deps, cb)` 内部是 `ctx.plugin({ inject: deps, apply: cb })`，
 *    会**新建一个子 fiber**。子 fiber 的 inject 里虽然有 webServer，
 *    但 cordis 的 Proxy 读属性时会沿 fiber 链向上找，父 fiber（本插件）
 *    并没有 inject webServer —— 找到父级就抛错了。
 *    换句话说，在 apply() 内部临时 inject 一个服务，救不了父上下文。
 *
 * 正确做法：把依赖声明在**插件导出**上（见文件末尾的 export），
 * cordis 会在加载插件前先等这些服务就绪，apply() 里直接读 ctx.webServer
 * 就是安全的。这样也顺带消除了"服务晚到导致字体路由没注册"的时序问题。
 *
 * @param ctx - 插件上下文（已保证 webServer 可用）。
 */
function apply(ctx) {
  // 每个字体注册一条独立路由（正文一个、标志一个）。
  for (const font of FONTS) {
    ctx.effect(
      () => ctx.webServer.register({
        kind: 'exact',
        path: font.route,
        handler: fontHandler(ctx, font),
      }),
      'mc-skin: font route ' + font.route,
    )
  }

  // ── 关于设置持久化（重要）──────────────────────────────────────────
  //
  // 这里原本还有一段：
  //     scoped.effect(() => scoped.settings.register(SETTINGS_NAMESPACE, SettingsSchema, ...))
  // 它会让 Host 半边在加载时抛
  //     TypeError: scoped.settings.register is not a function
  // 于是整条 fiber 进入 failed —— 插件页显示「异常」、开关变灰，
  // 连带字体路由也一起没注册上（因为 apply() 在抛错处中断）。
  //
  // 原因：当前 DSH 的 settings 服务（dsh-settings 的 SettingsForms）**没有
  // register(namespace, schema) 这个方法**。它的真实接口是
  // configure / describe / schema / update / replace / mutate / write，
  // 而 schema 是从插件自己的 package.json `dsh` 字段或 Config 里读的，
  // 不需要插件手工注册命名空间。客户端侧也没有 settingsScope 这个服务。
  //
  // 所以设置持久化这条路在当前 DSH 上走不通，直接删掉调用，让插件能正常加载。
  // 代价：两个开关退化为**内存态**（本次会话有效，重启回默认）。
  // 这不是回归 —— 之前它本来就是坏的，而且坏得更彻底（整个插件加载失败）。
  //
  // 将来若要恢复持久化，得改用 DSH 当前支持的机制（例如在 package.json 的
  // dsh 字段声明 schema，由 settings 服务自动收集），而不是这条已不存在的 API。
  void SettingsSchema
  void SETTINGS_NAMESPACE
}

export { apply, FONT_ROUTE, LOGO_FONT_ROUTE, SETTINGS_NAMESPACE }

/**
 * Host 半边的插件默认导出 —— 用类形式，才能带 static inject。
 *
 * cordis 读取插件依赖的方式是 `plugin.inject`（见 cordis 的 resolve/isApplicable）：
 * 类插件读 **static inject**，函数插件读函数对象上的 inject 属性。
 * 所以 `export const inject = [...]` 是没用的 —— 具名导出不会变成
 * 插件对象上的属性，cordis 看不到它。
 *
 * 官方插件的写法一致（例如 dsh-settings 的
 *   `static inject = ["configEditor", "profileContext"]`）。
 *
 * 声明 webServer 之后，cordis 会先等该服务 active 再调用 apply()，
 * 于是 apply() 里 `ctx.webServer` 就是可读的 —— 这正是
 * "cannot get property webServer without inject" 的根治办法。
 *
 * 只声明 webServer：字体路由是 Host 半边唯一必需的能力。
 * settings 持久化在当前 DSH 上不可用（见 apply 里的说明），不在这里声明。
 */
export default class McSkinHost {
  static inject = ['webServer']

  constructor(ctx) {
    apply(ctx)
  }
}

