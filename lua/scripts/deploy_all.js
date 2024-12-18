import yargs from "yargs"
import setup from "./setup.js"
import { Src } from "wao/test"
import { wait } from "wao/utils"
import { dirname, resolve } from "path"
import { writeFileSync, readFileSync } from "fs"
import { fileURLToPath } from "node:url"
import config from "../../node/node-server/weavedb.config.js"
const __dirname = dirname(fileURLToPath(import.meta.url))

const {
  owner = "owner",
  bundler = "bundler",
  validator1 = "validator1",
  validator2 = "validator2",
  delegator = "delegator",
  db = "db",
  network = "localhost",
} = yargs(process.argv.slice(2)).argv
const w = n => Number(n).toString() + "000000000000"
const g = n => Number(n).toString() + "000000000000000000"

let wallets = { owner, bundler, validator1, validator2, db, delegator }
for (let k in wallets) {
  wallets[k] = JSON.parse(
    readFileSync(resolve(__dirname, ".wallets", `${k}.json`), "utf8"),
  )
}
import { createDataItemSigner, spawn } from "@permaweb/aoconnect"
let env = []
const deploy_token = async ({ ao, src, token }) => {
  const { err, pid, p } = await ao.deploy({ src_data: src.data(token) })
  if (err) return console.log(err)
  const { err: err2 } = await p.msg("Mint", {
    Quantity: token === "tDB" ? w(1000000000) : g(1000000),
  })
  if (err2) return console.log(err2)
  console.log(`${token === "tDB" ? "TDB" : "ETH"}=${pid}`)
  return pid
}

const deploy_staking = async ({ ao, src, tdb, eth }) => {
  const { err, pid, p } = await ao.deploy({
    src_data: src.data("staking"),
    fills: { DB: tdb, TOKEN: eth },
  })
  if (err) return console.log(err)
  env.push(`STAKING=${pid}`)
  console.log(`STAKING=${pid}`)
  return pid
}

const deploy_node = async ({ ao, src, tdb }) => {
  const { err, pid, p } = await ao.deploy({
    src_data: src.data("weavedb_node"),
    fills: { PARENT: tdb, SOURCE: tdb },
    jwk: wallets.bundler,
  })
  if (err) return console.log(err)
  env.push(`NODE=${pid}`)
  console.log(`NODE=${pid}`)
  return pid
}

const set_reward = async ({
  ao,
  tdb,
  staking,
  amount = 100000000,
  duration = 1000 * 60 * 60 * 24 * 365,
}) => {
  const db = ao.p(tdb)
  const { mid } = await db.msg(
    "Transfer",
    {
      Recipient: staking,
      Quantity: w(amount),
      "X-Duration": duration,
      "X-Action": "Set-Reward",
    },
    { check: /transferred/ },
  )
  console.log("reward set! " + mid)
}

const main = async () => {
  const { ao, src } = await setup({ wallet: owner, network })
  await ao.ar.mint(ao.ar.addr, "10")
  const src2 = new Src({ ar: ao.ar })
  await wait(100)
  const wasm_aos2 = await src2.upload("aos2_0_1", "wasm")
  const { id: module_aos2 } = await ao.postModule({
    data: await ao.ar.data(wasm_aos2),
  })
  const { scheduler } = await ao.postScheduler({
    url: "http://localhost:4003",
    overwrite: true,
  })
  const module = module_aos2
  env.push(`AUTHORITY=${ao.authority}`)
  console.log(`AUTHORITY=${ao.authority}`)
  env.push(`MODULE=${module_aos2}`)
  console.log(`MODULE=${module_aos2}`)
  env.push(`SCHEDULER=${scheduler}`)
  console.log(`SCHEDULER=${scheduler}`)

  const { ao: ao2 } = await setup({
    wallet: owner,
    network,
    module,
    scheduler,
  })
  const tdb = await deploy_token({ ao: ao2, src, token: "tDB" })
  const eth = await deploy_token({ ao: ao2, src, token: "taoETH" })
  const staking = await deploy_staking({ ao: ao2, src, tdb, eth })
  const node = await deploy_node({ ao: ao2, src, tdb })
  env.push(`TDB=${tdb}`)
  env.push(`ETH=${eth}`)
  writeFileSync(resolve(import.meta.dirname, "../.env"), env.join("\n"))
  console.log()

  console.log(`NEXT_PUBLIC_TDB=${tdb}`)

  console.log(`NEXT_PUBLIC_ETH=${eth}`)
  console.log(`NEXT_PUBLIC_ADMIN_CONTRACT=${node}`)
  console.log(`NEXT_PUBLIC_STAKING=${staking}`)
  console.log()
  await set_reward({ ao, tdb, staking })

  let pubs = readFileSync(
    resolve(import.meta.dirname, "../../demo/.env.local"),
    "utf8",
  ).split("\n")
  let i = 0
  for (let v of pubs) {
    let sp = v.split("=")
    if (sp[0] === "NEXT_PUBLIC_TDB") pubs[i] = `NEXT_PUBLIC_TDB=${tdb}`
    if (sp[0] === "NEXT_PUBLIC_ETH") pubs[i] = `NEXT_PUBLIC_ETH=${eth}`
    if (sp[0] === "NEXT_PUBLIC_ADMIN_CONTRACT")
      pubs[i] = `NEXT_PUBLIC_ADMIN_CONTRACT=${node}`
    if (sp[0] === "NEXT_PUBLIC_STAKING")
      pubs[i] = `NEXT_PUBLIC_STAKING=${staking}`
    i++
  }
  writeFileSync(
    resolve(import.meta.dirname, "../../demo/.env.local"),
    pubs.join("\n"),
  )
  config.admin_contract = node
  config.staking = staking
  config.aos.module = module
  config.aos.scheduler = scheduler
  writeFileSync(
    resolve(import.meta.dirname, "../../node/node-server/weavedb.config.js"),
    `module.exports = ${JSON.stringify(config, null, 2)}`,
  )

  const p = ao.p(tdb)
  const p2 = ao.p(eth)
  await p.m("Transfer", {
    Quantity: w(10000),
    Recipient: await ao.ar.toAddr(wallets.db),
  })
  await p2.m("Transfer", {
    Quantity: g(10),
    Recipient: await ao.ar.toAddr(wallets.bundler),
  })

  await p2.m("Transfer", {
    Quantity: g(10),
    Recipient: await ao.ar.toAddr(wallets.validator1),
  })
  await p2.m("Transfer", {
    Quantity: g(10),
    Recipient: await ao.ar.toAddr(wallets.validator2),
  })
  await p2.m("Transfer", {
    Quantity: g(10),
    Recipient: await ao.ar.toAddr(wallets.delegator),
  })
  const p_eth = ao.p(eth)
  await p_eth.m(
    "Transfer",
    {
      Recipient: staking,
      Quantity: g(1),
      "X-Action": "Add-Node",
      "X-URL": "http://localhost:8080",
    },
    { jwk: wallets.bundler, check: /transferred/ },
  )
}
main()
