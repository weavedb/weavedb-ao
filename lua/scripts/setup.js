import { AR, AO } from "wao"
import { wait } from "wao/utils"
import { Src } from "wao/test"
import { dirname, resolve } from "path"
import dotenv from "dotenv"
dotenv.config()

import { readFileSync } from "fs"
import { fileURLToPath } from "node:url"
const __dirname = dirname(fileURLToPath(import.meta.url))

export default async ({ wallet, network, module, scheduler }) => {
  const jwk = JSON.parse(
    readFileSync(resolve(__dirname, ".wallets", `${wallet}.json`), "utf8"),
  )
  const opt = network === "localhost" ? { port: 4000 } : {}
  const ar = await new AR(opt).init(jwk)
  let opt2 = { ar }
  if (network === "localhost") {
    opt2 = {
      ar,
      module: module ?? process.env.MODULE,
      scheduler: scheduler ?? process.env.SCHEDULER,
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
  const tdb = process.env.TDB
  const eth = process.env.ETH
  const staking = process.env.STAKING
  const node = process.env.NODE
  return { jwk, ao, src, authority: opt2.authority, tdb, eth, staking, node }
}
