import { spawn } from 'node:child_process'

for (const engine of ['chromium', 'firefox', 'webkit']) {
  console.log(`\nVerifying ${engine}…`)
  const code = await new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/smoke.ts'], {
      env: { ...process.env, SMOKE_BROWSER: engine },
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('exit', (value) => resolve(value ?? 1))
  })
  if (code !== 0) process.exit(code)
}
