import { AR, AO } from "aonote"
import yargs from "yargs"
import { dirname, resolve } from "path"
import { readFileSync } from "fs"
import { fileURLToPath } from "node:url"
const __dirname = dirname(fileURLToPath(import.meta.url))
const wait = ms => new Promise(res => setTimeout(() => res(), ms))
const {
  token = "tDB",
  wallet = "bundler",
  network = "mainnet",
} = yargs(process.argv.slice(2)).argv

const main = async () => {
  const jwk = JSON.parse(
    readFileSync(resolve(__dirname, ".wallets", `${wallet}.json`), "utf8"),
  )
  const opt = network === "localhost" ? { port: 4000 } : {}
  const ar = await new AR(opt).init(jwk)
  let opt2 = { ar }
  if (network === "localhost") {
    opt2 = {
      ar,
      module: "1S5sWs0XULwHFlOtNN4EHASi-xXkzx9osCFj83senNU",
      scheduler: "KiStqoG_7xh-MrY6m1AWnfhCgFRuPpZWcOhPwjud-mw",
      aoconnect: {
        MU_URL: "http://localhost:4002",
        CU_URL: "http://localhost:4004",
        GATEWAY_URL: "http://localhost:4000",
      },
      authority: "XztbUZU7D8lAcWlbg0avCD0s2lMBbFGgTC4YzLcOR90",
    }
  }
  const ao = new AO(opt2)
  const data = readFileSync(
    resolve(__dirname, `../../lua/contracts/${token}.lua`),
    "utf8",
  )
  const { err, pid, p } = await ao.deploy({ src_data: data })
  console.log(token + " deployed: " + pid)
  console.log("Now minting token...")
  console.log(
    await p.msg("Mint", {
      Quantity:
        token === "tDB"
          ? "1000000000" + "000000000000"
          : "1000000" + "000000000000000000",
    }),
  )
  console.log(await p.d("Balances"))
  if (token === "tDB" && false) {
    const data2 = readFileSync(
      resolve(__dirname, "../../lua/contracts/weavedb_node.lua"),
      "utf8",
    )

    const { pid: pid2 } = await ao.spwn({})
    await ao.wait({ pid: pid2 })

    const { mid: mid2 } = await ao.load({
      pid: pid2,
      data: data2,
      fills: { PARENT: pid, SOURCE: pid },
    })
    console.log(pid2)
  }
}
main()
