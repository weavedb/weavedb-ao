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
      module: "YTNXvQu2x21DD6Pm8zicVBghB-BlnM5VRrVRyfhBPP8",
      scheduler: "-_vZZQMEnvJmiIIfHfp_KuuV6ud2b9VSThfTmYytYQ8",
      aoconnect: {
        MU_URL: "http://localhost:4002",
        CU_URL: "http://localhost:4004",
        GATEWAY_URL: "http://localhost:4000",
      },
    }
  }
  const ao = new AO(opt2)
  const data = readFileSync(
    resolve(__dirname, `../../lua/contracts/${token}.lua`),
    "utf8",
  )
  const { err, pid } = await ao.spwn({})
  console.log(pid)
  await ao.wait({ pid })
  console.log("deployed!!")
  const { mid } = await ao.load({ pid, data })
  console.log("Now minting token...")
  await ao.msg({
    pid,
    act: "Mint",
    tags: {
      Quantity:
        token === "tDB" ? "10000000000000000" : "10000000000000000000000",
    },
  })
  console.log(
    (await ao.dry({ pid, act: "Balances", get: { data: true, json: true } }))
      .out[ao.ar.addr],
  )
  if (token === "tDB") {
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
