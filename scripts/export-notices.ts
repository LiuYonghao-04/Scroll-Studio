import { readFile, writeFile } from 'node:fs/promises'
const [gsap, fflate] = await Promise.all([
  readFile('node_modules/gsap/gsap-core.js', 'utf8'),
  readFile('node_modules/fflate/LICENSE', 'utf8'),
])
const header = gsap.match(/\/\*![\s\S]*?\*\//)?.[0] ?? ''
await writeFile(
  'public/export-runtime/THIRD_PARTY_NOTICES.txt',
  `Scroll Studio static page export\n\nGSAP / ScrollTrigger\n${header}\nGSAP Standard License: https://gsap.com/community/standard-license/\nThe package links to the official license rather than shipping a LICENSE file. Preserve all proprietary notices. Visual animation builders must confirm that their intended use is permitted.\n\nfflate (used to create ZIP archives in the editor)\n${fflate}\n`,
)
