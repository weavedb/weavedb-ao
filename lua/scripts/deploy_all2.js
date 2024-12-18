import yargs from "yargs"
import setup from "./setup.js"
import { Src } from "wao/test"
import { wait } from "wao/utils"
import { dirname, resolve } from "path"
import { writeFileSync, readFileSync } from "fs"
import { fileURLToPath } from "node:url"
import config from "../../node/node-server/weavedb.config.js"
const __dirname = dirname(fileURLToPath(import.meta.url))
import DB from "weavedb-node-client"

const {
  owner = "owner",
  bundler = "bundler",
  validator1 = "validator1",
  validator2 = "validator2",
  delegator = "delegator",
  committer = "committer",
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
wallets.committer = JSON.parse(
  readFileSync(resolve(__dirname, ".wallets", `${committer}.json`), "utf8"),
)
import { createDataItemSigner, spawn } from "@permaweb/aoconnect"

const main = async () => {
  const { tdb, eth, staking, node, ao, src } = await setup({
    wallet: owner,
    network,
  })
  await wait(100)
  const token = ao.p(tdb)
  const aoeth = ao.p(eth)
  const st = ao.p(staking)
  const nd = ao.p(node)
  console.log(await ao.ar.toAddr(wallets.node))
  await token.m(
    "Transfer",
    { Recipient: node, Quantity: w(100) },
    { jwk: wallets.db },
  )
  await wait(2000)
  const db = new DB({
    rpc: "localhost:8080",
    contractTxId: "testdb",
  })
  console.log(await ao.ar.toAddr(wallets.db))
  console.log(await st.d("Balances"))
  console.log(await nd.d("Balances"))
  console.log(await token.d("Balances"))
  const tx = await db.admin(
    {
      op: "add_db",
      key: "testdb",
      db: { rollup: true, owner: await ao.ar.toAddr(wallets.db) },
    },
    { ar2: wallets.db },
  )
  if (!tx.success) return console.log("error")

  const { contractTxId, srcTxId } = await db.admin(
    {
      op: "deploy_contract",
      key: "testdb",
      type: "ao",
    },
    { ar2: wallets.db },
  )
  await wait(2000)
  await token.m(
    "Transfer",
    {
      Recipient: staking,
      Quantity: w(1000),
      "X-DB": contractTxId,
    },
    { jwk: wallets.db },
  )
  await token.m(
    "Transfer",
    {
      Recipient: staking,
      Quantity: w(1000),
      "X-DB": contractTxId,
    },
    { jwk: wallets.db },
  )

  await aoeth.m(
    "Transfer",
    {
      Recipient: staking,
      Quantity: g(1),
      "X-DB": contractTxId,
    },
    { check: /transferred/, jwk: wallets.validator1 },
  )
  await aoeth.m(
    "Transfer",
    {
      Recipient: staking,
      Quantity: g(1),
      "X-DB": contractTxId,
    },
    { check: /transferred/, jwk: wallets.validator2 },
  )
  const db2 = new DB({ rpc: "localhost:8080", contractTxId })
  await db2.admin(
    {
      op: "add_validator",
      pid: contractTxId,
    },
    { ar2: wallets.validator1 },
  )
  await db2.admin(
    {
      op: "add_validator",
      pid: contractTxId,
    },
    { ar2: wallets.validator2 },
  )

  await db2.admin(
    {
      op: "add_committer",
      pid: contractTxId,
    },
    { privateKey: wallets.committer.privateKey },
  )
}
main()
