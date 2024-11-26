import { AR, AO } from "aonote"
import { wait } from "aonote/test/utils.js"
import { Src } from "aonote/test/helpers.js"
import { dirname, resolve } from "path"
import dotenv from "dotenv"
dotenv.config()

import { readFileSync } from "fs"
import { fileURLToPath } from "node:url"
const __dirname = dirname(fileURLToPath(import.meta.url))

export default async ({ wallet, network }) => {
  const jwk = JSON.parse(
    readFileSync(resolve(__dirname, ".wallets", `${wallet}.json`), "utf8"),
  )
  const opt = network === "localhost" ? { port: 4000 } : {}
  const ar = await new AR(opt).init(jwk)
  let opt2 = { ar }
  if (network === "localhost") {
    opt2 = {
      ar,
      module: process.env.MODULE,
      scheduler: process.env.SCHEDULER,
      authority: process.env.AUTHORITY,
      aoconnect: {
        MU_URL: "http://localhost:4002",
        CU_URL: "http://localhost:4004",
        GATEWAY_URL: "http://localhost:4000",
      },
    }
  }
  const ao = new AO(opt2)
  const src = new Src({ ar, dir: resolve(__dirname, "../../lua/contracts") })
  return { ao, src }
}
