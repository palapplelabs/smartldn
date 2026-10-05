// pm2 process for labs.palapple.com/smartldn. Secrets stay outside the web
// root in ~/.config/smartldn/env (mode 600), one KEY=value per line.
const { readFileSync } = require("node:fs")
const { join } = require("node:path")

const envFile = process.env.SMARTLDN_ENV_FILE || join(process.env.HOME || "/home/opc", ".config/smartldn/env")

function readEnv(path) {
  const out = {}
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (match) out[match[1]] = match[2]
  }
  return out
}

module.exports = {
  apps: [
    {
      name: "smartldn",
      cwd: join(__dirname, ".."),
      script: "node_modules/next/dist/bin/next",
      args: "start -p 4317 -H 127.0.0.1",
      env: { NODE_ENV: "production", ...readEnv(envFile) },
      max_memory_restart: "900M",
      time: true,
    },
  ],
}
