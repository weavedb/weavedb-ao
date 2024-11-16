const { expect } = require("chai")
const DB = require("weavedb-node-client")
const SDK = require("weavedb-sdk-node")
const { wait, Test } = require("./lib/utils")
const { readFileSync } = require("fs")
const { resolve } = require("path")
const { AO, AR } = require("aonote")
const { setup, ok, fail } = require("./lib/helpers.js")

const getModule = async () => readFileSync(resolve(__dirname, "../contract.js"))

describe("WeaveDB on AO", function () {
  this.timeout(0)
  let admin,
    network,
    bundler,
    test,
    base,
    arweave,
    opt,
    ao,
    admin_contract,
    token

  before(async () => {
    ;({ ao, opt } = await setup({ cache: false }))
    // testing in insecure mode, never do that in production
    // deploy token
    const data = readFileSync(
      resolve(__dirname, "../../../lua/contracts/tDB.lua"),
      "utf8",
    )
    const { err, pid } = await ao.spwn({})
    ok(await ao.wait({ pid }))
    const { mid } = await ao.load({ pid, data })
    const data2 = readFileSync(
      resolve(__dirname, "../../../lua/contracts/weavedb_node.lua"),
      "utf8",
    )

    const { pid: pid2 } = await ao.spwn({})
    ok(await ao.wait({ pid: pid2 }))

    const { mid: mid2 } = await ao.load({
      pid: pid2,
      data: data2,
      fills: { PARENT: pid, SOURCE: pid },
    })
    admin_contract = pid2
    token = pid

    test = new Test({
      admin_contract,
      bundler: ao.ar.jwk,
      aos: opt.ao,
      secure: false,
      sequencerUrl: "https://gw.warp.cc/",
      apiKey: "xyz",
      ao: true,
    })
    ;({ network, arweave, bundler, admin, base } = await test.start())
    await wait(3000)
  })

  after(async () => await test.stop())
  it("should deploy weavedb on AO", async () => {
    const winston = "000000000000"
    const ar = new AR(opt.ar)
    const { addr } = await ar.gen()
    ok(
      await ao.msg({
        pid: token,
        act: "Mint",
        tags: { Quantity: "10000" + winston },
      }),
    )
    ok(
      await ao.msg({
        pid: token,
        act: "Transfer",
        tags: { Recipient: addr, Quantity: "1000" + winston },
      }),
    )
    expect(
      (
        await ao.dry({
          pid: token,
          act: "Balances",
          get: { data: true, json: true },
        })
      ).out[addr],
    ).to.eql(("1000" + winston) * 1)

    ok(
      await ao.msg({
        jwk: ar.jwk,
        pid: token,
        act: "Transfer",
        tags: { Recipient: admin_contract, Quantity: "200" + winston },
      }),
    )
    await wait(3000)
    expect(
      (
        await ao.dry({
          pid: admin_contract,
          act: "Balances",
          get: { data: true, json: true },
        })
      ).out[addr],
    ).to.eql(("200" + winston) * 1)

    expect((await ao.dry({ pid: token, act: "Info", get: "Name" })).out).to.eql(
      "Testnet DB",
    )

    const db = new DB({
      rpc: "localhost:9090",
      contractTxId: "testdb",
      arweave: network,
    })
    await wait(2000)
    const stats = await db.node({ op: "stats" })
    expect(stats).to.eql({ dbs: [], bundler: ao.ar.addr })

    // add a DB to node
    const tx = await db.admin(
      {
        op: "add_db",
        key: "testdb",
        db: {
          app: "http://localhost:3000",
          name: "Jots",
          rollup: true,
          owner: addr,
        },
      },
      { ar2: ar.jwk },
    )
    expect(tx.success).to.eql(true)

    console.log("aos2...", opt.modules.aos2)
    // deploy L1 AO contract (via node)
    const { contractTxId, srcTxId } = await db.admin(
      {
        op: "deploy_contract",
        key: "testdb",
        type: "ao",
        module: opt.modules.aos2,
        scheduler: opt.ao.scheduler,
      },
      { ar2: ar.jwk },
    )
    expect((await db.node({ op: "stats" })).dbs[0].data.rollup).to.eql(true)

    await wait(2000)

    expect(
      (
        await ao.dry({
          pid: admin_contract,
          act: "Balances",
          get: { data: true, json: true },
        })
      ).out[addr],
    ).to.eql(("100" + winston) * 1)

    // update the DB (via node)
    const db2 = new DB({ rpc: "localhost:9090", contractTxId })
    const Bob = { name: "Bob" }
    const tx2 = await db2.set(Bob, "ppl", "Bob", {
      privateKey: admin.privateKey,
    })
    expect(tx2.success).to.eql(true)
    expect(await db2.get("ppl", "Bob")).to.eql(Bob)
    // check rollup
    await wait(5000)
    expect(
      (
        await ao.dry({
          pid: contractTxId,
          act: "Get",
          tags: { Query: JSON.stringify(["ppl", "Bob"]) },
          get: { data: true, json: true },
        })
      ).out,
    ).to.eql(Bob)

    // check zkp
    let hash = null
    let zkp = null
    try {
      hash = (await db.node({ op: "hash", key: "testdb" })).hash
    } catch (e) {
      console.log(e)
    }
    try {
      zkp = (
        await db.node({
          op: "zkp",
          key: "testdb",
          collection: "ppl",
          doc: "Bob",
          path: "name",
        })
      ).zkp
    } catch (e) {
      console.log(e)
    }
    expect(hash).to.eql(zkp[21])
  })
})
