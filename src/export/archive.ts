import { zipSync, strToU8 } from 'fflate'
import { clone, parseDocument } from '../core/document'
import { flattenNodes } from '../core/motion'
import { readImage } from '../services/media'
import { compileHtml } from './compiler'
import { preflight } from './preflight'
import type { PageDocument } from '../types/editor'

export type ExportLoader = (url: string, signal?: AbortSignal) => Promise<Uint8Array>
async function load(url: string, signal?: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(url, {
    credentials: 'omit',
    signal: AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]),
  })
  if (!response.ok) throw new Error(`资源读取失败（${response.status}）：${url}`)
  const reader = response.body?.getReader()
  if (!reader) throw new Error('浏览器无法读取导出资源，请重试。')
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.length
      if (total > 8_000_000) {
        await reader.cancel()
        throw new Error('单个外部资源超过 8 MB，请先上传经过压缩的本地图片。')
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}
const decode = (data: string) =>
  Uint8Array.from(atob(data.split(',')[1]!), (char) => char.charCodeAt(0))
export async function buildArchive(
  input: PageDocument,
  loader: ExportLoader = load,
  progress: (text: string) => void = () => {},
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const resource = (url: string) => {
    signal?.throwIfAborted()
    return loader(url, signal)
  }
  const original = parseDocument(input),
    doc = clone(original)
  const errors = preflight(doc).filter((issue) => issue.level === 'error')
  if (errors.length) throw new Error(errors[0]!.message)
  const files: Record<string, Uint8Array> = {}
  progress('正在准备动画运行资源…')
  const base = import.meta.env.BASE_URL
  files['runtime.js'] = await resource(`${base}export-runtime/runtime.js`)
  files['images/landscape.svg'] = await resource(`${base}images/landscape.svg`)
  const notices = await resource(`${base}export-runtime/THIRD_PARTY_NOTICES.txt`)
  files['THIRD_PARTY_NOTICES.txt'] = notices
  for (const asset of doc.assets)
    files[`media/${asset.id}.${asset.mime === 'image/jpeg' ? 'jpg' : asset.mime.split('/')[1]}`] =
      decode(asset.dataUrl)
  const external = new Map<string, string>()
  for (const node of flattenNodes(doc.nodes).filter((node) => node.kind === 'image')) {
    signal?.throwIfAborted()
    progress(`正在打包图片：${node.name}`)
    if (node.src.startsWith('asset:')) {
      const asset = doc.assets.find((asset) => `asset:${asset.id}` === node.src)!
      node.src = `./media/${asset.id}.${asset.mime === 'image/jpeg' ? 'jpg' : asset.mime.split('/')[1]}`
    } else if (node.src !== '/images/landscape.svg') {
      if (!external.has(node.src)) {
        if (external.size >= 20)
          throw new Error('单次导出最多打包 20 个外部图片地址，请减少图片后重试。')
        let image: Awaited<ReturnType<typeof readImage>>
        try {
          const bytes = await resource(node.src)
          const mime =
            bytes[0] === 0x89
              ? 'image/png'
              : bytes[0] === 0xff
                ? 'image/jpeg'
                : bytes[0] === 0x52
                  ? 'image/webp'
                  : ''
          image = await readImage(new File([bytes as BlobPart], 'external-image', { type: mime }))
        } catch {
          signal?.throwIfAborted()
          throw new Error(`无法打包「${node.name}」的图片。请先在素材库上传该图片，再重试导出。`)
        }
        const path = `media/${image.id}.${image.mime === 'image/jpeg' ? 'jpg' : image.mime.split('/')[1]}`
        files[path] = decode(image.dataUrl)
        if (Object.values(files).reduce((size, bytes) => size + bytes.length, 0) > 24_000_000)
          throw new Error('图片总量过大，请减少素材后重试。')
        external.set(node.src, `./${path}`)
      }
      node.src = external.get(node.src)!
    }
  }
  doc.assets = []
  const page = compileHtml(doc)
  files['index.html'] = strToU8(page.html)
  files['styles.css'] = strToU8(page.css)
  files['project.json'] = strToU8(JSON.stringify(original))
  files['README.txt'] = strToU8(
    '解压后打开 index.html 即可体验；也可将整个文件夹上传到 GitHub Pages 等静态托管。\n必须保留 runtime.js、styles.css、images 和 media 文件夹。\nproject.json 可重新导入 Scroll Studio 继续编辑；仅下载 index.html 不包含全部资源。\n导出采用系统字体回退，无需在线字体服务。请保留第三方许可文件并确认 GSAP 用途许可。\n',
  )
  if (Object.values(files).reduce((size, bytes) => size + bytes.length, 0) > 40_000_000)
    throw new Error('导出包超过 40 MB，请减少素材后重试。')
  progress('正在生成 ZIP…')
  signal?.throwIfAborted()
  return zipSync(files, { level: 0 })
}
