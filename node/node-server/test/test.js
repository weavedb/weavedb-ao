const { expect } = require("chai")
const DB = require("weavedb-node-client")
const SDK = require("weavedb-sdk-node")
const { wait, Test } = require("./lib/utils")
const { readFileSync } = require("fs")
const { resolve } = require("path")
const { AO } = require("aonote")
const { setup, ok, fail } = require("./lib/helpers.js")

const getModule = async () => readFileSync(resolve(__dirname, "../contract.js"))

describe("WeaveDB on AO", function () {
  this.timeout(0)
  let admin, network, bundler, test, base, arweave, opt

  before(async () => {
    ;({ opt } = await setup({ cache: true }))
    // testing in insecure mode, never do that in production
    test = new Test({
      aos: opt.ao,
      secure: false,
      sequencerUrl: "https://gw.warp.cc/",
      apiKey: "xyz",
      ao: true,
    })
    ;({ network, arweave, bundler, admin, base } = await test.start())
    await wait(3000)
  })

  after(async () => {
    await test.stop()
    // some processes linger, so force exit for now
    process.exit()
  })

  it("should deploy weavedb on AO", async () => {
    const db = new DB({
      rpc: "localhost:9090",
      contractTxId: "testdb",
      arweave: network,
    })
    await wait(2000)
    const stats = await db.node({ op: "stats" })
    expect(stats).to.eql({ dbs: [] })

    // add a DB to node
    const tx = await db.admin(
      {
        op: "add_db",
        key: "testdb",
        db: {
          app: "http://localhost:3000",
          name: "Jots",
          rollup: true,
          owner: admin.address,
        },
      },
      { privateKey: admin.privateKey },
    )
    expect(tx.success).to.eql(true)

    // deploy L1 AO contract (via node)
    const { contractTxId, srcTxId } = await db.admin(
      {
        op: "deploy_contract",
        key: "testdb",
        type: "ao",
        module: opt.ao.module,
        scheduler: opt.ao.scheduler,
      },
      { privateKey: admin.privateKey },
    )
    expect((await db.node({ op: "stats" })).dbs[0].data.rollup).to.eql(true)

    await wait(2000)

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
    const ao = new AO(opt.ao)
    expect(
      JSON.parse(
        (
          await ao.dry({
            pid: contractTxId,
            act: "Get",
            tags: { Query: JSON.stringify(["ppl", "Bob"]) },
            get: { name: "Result", json: true },
          })
        ).out,
      ),
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
