import { Src, setup, ok, fail } from "aonote/test/helpers.js"
import { expect } from "chai"
import { AR, AO } from "aonote"
import { readFileSync } from "fs"
import { resolve } from "path"
import forge from "node-forge"
import { _parser, qs3, qs1, qs2 } from "./parser.js"
import { reverse, map, isNil } from "ramda"
const bob = { name: "Bob", age: 5, favs: ["apple", "orange"] }
const alice = { name: "Alice", age: 10, favs: ["apple", "grape"] }
const mike = { name: "Mike", age: 15, favs: ["lemon", "peach"] }
const beth = { name: "Beth", age: 20, favs: ["grape", "peach"] }
const jeff = { name: "Jeff", age: 25, favs: ["apple", "peach"] }
const david = { name: "David", age: 25, favs: ["lemon"] }
const ppl = [bob, alice, mike, beth, jeff, david, beth, jeff, david, bob]

const rmNull = obj => {
  for (let k in obj) {
    if (obj[k] === null) delete obj[k]
  }
  return obj
}

const wait = ms => new Promise(res => setTimeout(() => res(), ms))

async function deriveEntropyForRSA(prfKey) {
  const hkdfKeyMaterial = await crypto.subtle.importKey(
    "raw",
    prfKey,
    "HKDF",
    false,
    ["deriveBits"],
  )

  const derivedEntropy = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32),
      info: new Uint8Array(0),
    },
    hkdfKeyMaterial,
    4096,
  )
  return new Uint8Array(derivedEntropy)
}

function to64(x) {
  let modulus = Buffer.from(x.toByteArray())
  if (modulus[0] === 0) modulus = modulus.slice(1)
  return modulus
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

describe("WeaveDB", function () {
  this.timeout(0)
  let ao, ao2, opt, profile, ar, thumbnail, banner, src

  before(async () => {
    ;({ thumbnail, banner, opt, ao, ao2, ar, profile } = await setup({}))
    src = new Src({ ar, dir: resolve(import.meta.dirname, "../contracts") })
  })

  it.skip("should generate valid arweave keys with node-forge", async () => {
    const key = new Uint8Array([])
    const entropy = await deriveEntropyForRSA(key)
    const rng = forge.random.createInstance()
    rng.seedFileSync = () => entropy.toString("hex")
    const rsaKeyPair = forge.pki.rsa.generateKeyPair({
      bits: 4096,
      e: 0x10001,
      prng: rng,
    })
    const { publicKey, privateKey } = rsaKeyPair
    const { n } = publicKey
    const { d, p, q, dP, dQ, qInv } = privateKey
    const jwk = {
      kty: "RSA",
      e: "AQAB",
      n: to64(n),
      d: to64(d),
      p: to64(p),
      q: to64(q),
      dp: to64(dP),
      dq: to64(dQ),
      qi: to64(qInv),
    }
    const ao = await new AO(opt.ao).init(jwk)
    const data = readFileSync(
      resolve(import.meta.dirname, "../contracts/weavedb.lua"),
      "utf8",
    )
    const { err, pid } = await ao.spwn({})
    await ao.wait({ pid })
    ok(await ao.load({ pid, data, fills: { BUNDLER: ao.ar.addr } }))
  })

  it("should deploy weavedb process", async () => {
    const data = readFileSync(
      resolve(import.meta.dirname, "../contracts/weavedb.lua"),
      "utf8",
    )
    const { err, pid } = await ao.spwn({ module: opt.modules.aos2 })
    await ao.wait({ pid })
    const { mid } = await ao.load({ pid, data, fills: { BUNDLER: ao.ar.addr } })

    ok(
      await ao.msg({
        pid,
        act: "Rollup",
        data: {
          diffs: map(v => ({
            collection: "ppl",
            doc: v.name,
            op: "set",
            data: v,
          }))(ppl),
        },
        check: "committed!",
      }),
    )
    ok(
      await ao.msg({
        pid,
        act: "Rollup",
        data: {
          diffs: map(v => ({
            collection: "ppl",
            doc: v.name,
            op: "delete",
            data: null,
          }))(ppl),
        },
        check: "committed!",
      }),
    )

    ok(
      await ao.msg({
        pid,
        act: "Rollup",
        data: {
          diffs: map(v => ({
            collection: "ppl",
            doc: v.name,
            op: "update",
            data: v,
          }))(ppl),
        },
        check: "committed!",
      }),
    )

    const q = async (...query) => {
      const get = true
      const tags = { Query: JSON.stringify(query) }
      return (await ao.dry({ pid, act: "Get", tags, get })).out
    }
    const q2 = async (...query) => {
      const get = true
      const tags = { Query: JSON.stringify(query) }
      return (await ao.dry({ pid, act: "Parse", tags, get })).out
    }

    const res = await q("ppl", "Bob")
    expect(res).to.eql(bob)
    expect(await q("ppl")).to.eql([alice, beth, bob, mike])
    expect(await q("ppl", ["age", "desc"])).to.eql([beth, mike, alice, bob])
    expect(await q("ppl", ["age"], 2)).to.eql([bob, alice])
    expect(await q("ppl", ["age", "==", 10], 2)).to.eql([alice])
    expect(await q("ppl", ["age", "desc"], ["age", "in", [10, 20]], 2)).to.eql([
      beth,
      alice,
    ])

    expect(
      await q("ppl", ["age", "desc"], ["age", "not-in", [10, 20]], 2),
    ).to.eql([mike, bob])

    expect(await q("ppl", ["age", "desc"], ["age", "!=", 10])).to.eql([
      beth,
      mike,
      bob,
    ])

    expect(await q("ppl", ["favs", "array-contains", "apple"])).to.eql([
      alice,
      bob,
    ])

    expect(
      await q(
        "ppl",
        ["age", "desc"],
        ["favs", "array-contains-any", ["grape", "apple"]],
      ),
    ).to.eql([beth, alice, bob])

    // test parser
    let i = 0
    for (let v of qs3) {
      const lua = await q2(...v)
      const js = rmNull(_parser(v))
      expect(lua).to.eql(js)
      i++
    }
    /*
    const data2 = readFileSync(
      resolve(import.meta.dirname, "../contracts/app.lua"),
      "utf8",
    )
    const { pid: pid2 } = ok(await ao.spwn({ module: opt.modules.aos2 }))
    ok(await ao.wait({ pid: pid2 }))
    ok(
      await ao.load({
        pid: pid2,
        data: data2,
        fills: { BUNDLER: ao.ar.addr },
      }),
    )
    const { res: res2, out } = await ao.msg({
      pid: pid2,
      act: "Fetch",
      tags: { DB: pid },
      get: true,
    })
    console.log(out)
    */
  })

  it("should deploy staking contract", async () => {
    const { p } = ok(await ao2.deploy({ src_data: src.data("staking2") }))
    await p.m("setup", { ts: 1, pool: 60, dur: 5 })
    await p.m("stake", { ts: 1, addr: "a", deposit: 2 })
    await p.m("stake", { ts: 2, addr: "b", deposit: 1 })
    await p.m("stake", { ts: 3, addr: "c", deposit: 3 })
    await p.m("unstake", { ts: 4, addr: "a", deposit: 1 })
    await p.m("unstake", { ts: 4, addr: "b", deposit: 1 })
    await p.m("stake", { ts: 5, addr: "c", deposit: 2 })
    expect((await p.d("get", { ts: 6, addr: "a" })).amount).to.eql("29")
    expect((await p.d("get", { ts: 6, addr: "b" })).amount).to.eql("6")
    expect((await p.d("get", { ts: 6, addr: "c" })).amount).to.eql("25")
    return
  })

  it.only("should deploy staking contract", async () => {
    const infra = await ar.gen()
    const validator_1 = await ar.gen()
    const validator_2 = await ar.gen()
    const delegator_1 = await ar.gen()
    const delegator_2 = await ar.gen()
    const { pid: _db, p: db } = ok(
      await ao2.deploy({ src_data: src.data("tDB") }),
    )
    expect(await db.d("Info", "Name")).to.eql("Testnet DB")
    const { pid: _eth, p: eth } = ok(
      await ao2.deploy({ src_data: src.data("taoETH") }),
    )
    expect(await eth.d("Info", "Name")).to.eql("Testnet aoETH")

    const { pid: _stake, p: stake } = ok(
      await ao2.deploy({
        src_data: src.data("staking"),
        fills: { DB: _db, TOKEN: _eth },
      }),
    )
    const { pid: _wdb, p: wdb } = ok(
      await ao2.deploy({
        src_data: src.data("weavedb"),
        fills: { BUNDLER: infra.addr, STAKING: _stake },
      }),
    )
    const bal = async (p, qty, tar) => {
      tar ??= ar.addr
      expect((await p.d("Balances"))[tar]).to.eql(Number(qty).toString())
    }
    const getNodes = async () => await stake.d("Get-Nodes")

    const stakeBal = async (qty, tar) => {
      tar ??= ar.addr
      const out = await getNodes()
      expect(out["1"].dbs.demo.stakes[tar]).to.eql(Number(qty).toString())
    }

    const mint = async (p, qty, exp, jwk) => {
      await p.m("Mint", { Quantity: qty }, { check: /minted/, jwk })
      if (!isNil(exp)) await bal(p, exp, jwk ? await ar.toAddr(jwk) : null)
    }

    const transfer = async (p, qty, exp, to = _stake, jwk) => {
      await p.m(
        "Transfer",
        {
          Recipient: to,
          Quantity: qty,
          "X-Node": 1,
          "X-DB": "demo",
        },
        { check: /transferred/, jwk },
      )
      if (!isNil(exp)) await bal(p, exp, jwk ? await ar.toAddr(jwk) : null)
    }
    const delegate = async (who, qty, exp, to = _stake, jwk) => {
      await eth.m(
        "Transfer",
        {
          Recipient: to,
          Quantity: qty,
          "X-Node": 1,
          "X-DB": "demo",
          "X-Action": "Delegate",
          "X-Delegate-To": who,
        },
        { check: /transferred/, jwk },
      )
      if (!isNil(exp)) await bal(eth, exp, jwk ? await ar.toAddr(jwk) : null)
    }
    const setReward = async (qty, exp, jwk) => {
      await db.m(
        "Transfer",
        {
          Recipient: _stake,
          Quantity: qty,
          "X-Duration": 10000,
          "X-Action": "Set-Reward",
        },
        { check: /transferred/, jwk },
      )
      if (!isNil(exp)) await bal(db, exp, jwk ? await ar.toAddr(jwk) : null)
    }

    const send = async (p, qty, exp, to = _stake, jwk) => {
      await p.m(
        "Transfer",
        { Recipient: to, Quantity: qty },
        { check: /transferred/, jwk },
      )
      if (!isNil(exp)) await bal(p, exp, jwk ? await ar.toAddr(jwk) : null)
    }

    const withdraw = async (qty, exp, exp_stake, jwk) => {
      await stake.m(
        "Withdraw",
        { Quantity: qty, Node: 1, DB: "demo" },
        { check: /withdrew/, jwk },
      )
      if (!isNil(exp)) await bal(eth, exp, jwk ? await ar.toAddr(jwk) : null)
      if (!isNil(exp_stake)) {
        await stakeBal(exp_stake, jwk ? await ar.toAddr(jwk) : null)
      }
    }

    const withdrawDB = async (exp, jwk) => {
      await stake.m("Withdraw-DB", null, { check: /withdrew/, jwk })
      if (!isNil(exp)) await bal(db, exp, jwk ? await ar.toAddr(jwk) : null)
    }

    const info = async () => {
      return await stake.d("Info", null, {
        get: [
          "MinETH",
          "NodeCount",
          "TotalStake",
          "TotalDeposit",
          "TotalReward",
        ],
      })
    }

    const addNode = async () => {
      await eth.m(
        "Transfer",
        {
          Recipient: _stake,
          Quantity: 1,
          "X-Action": "Add-Node",
          "X-URL": "https://test.wdb.ae",
        },
        { jwk: infra.jwk, check: /transferred/ },
      )
    }

    const addDB = async () => {
      await stake.m(
        "Add-DB",
        {
          Allocations: {
            infra: "40",
            protocol: "10",
            validators: "40",
            [delegator_2.addr]: "10",
          },
          Node: 1,
          DB: "demo",
          Price: 1,
          Process: _wdb,
          Validators: 2,
          "Min-Stake": 1,
        },
        { jwk: infra.jwk, check: "db added!" },
      )
    }
    await mint(db, 110000, 110000)
    await setReward(100000, 10000)
    await mint(eth, 100, 100)
    await send(eth, 10, 90, infra.addr)
    await send(eth, 10, 80, validator_1.addr)
    await send(eth, 10, 70, validator_2.addr)
    await send(eth, 10, 60, delegator_1.addr)
    await send(eth, 10, 50, delegator_2.addr)
    await addNode()
    await addDB()
    await wdb.m("Init-DB", { Node: 1 }, { check: "DB initialized!" })
    expect((await stake.d("Get-DB", { DB: _wdb })).init).to.eql(true)
    await transfer(eth, 1, 9, _stake, validator_1.jwk)
    await transfer(eth, 3, 7, _stake, validator_2.jwk)
    await transfer(db, 100, 9900)
    await withdraw(2, 9, 1, validator_2.jwk)
    await delegate(validator_1.addr, 1, 9, _stake, delegator_1.jwk)
    const out = await wdb.m("Rollup", {
      jwk: infra.jwk,
      data: {
        hash: "abc",
        block_height: 1,
        zkdb: "def",
        txs: ppl,
        diffs: map(v => ({
          collection: "ppl",
          doc: v.name,
          op: "set",
          data: v,
        }))(ppl),
      },
      check: "committed!",
      get: false,
    })

    await stake.m(
      "Validate",
      {
        DB: _wdb,
        Block: 1,
        Txs: ppl.length.toString(),
        Hash: "abc",
        ["ZK-Root"]: "def",
      },
      { check: "validated!", jwk: validator_1.jwk },
    )

    await stake.m(
      "Validate",
      {
        DB: _wdb,
        Block: 1,
        Txs: ppl.length.toString(),
        Hash: "abc",
        ["ZK-Root"]: "def",
      },
      { check: "finalized!", jwk: validator_2.jwk },
    )
    await withdrawDB(5, infra.jwk)
    console.log(await stake.d("Balance", { Recipient: validator_1.addr }))
  })

  it("should deploy tDB token and subledgers", async () => {
    const data = readFileSync(
      resolve(import.meta.dirname, "../contracts/tDB.lua"),
      "utf8",
    )
    const { err, pid } = await ao2.spwn({
      module: opt.modules.aos2,
    })
    await ao.wait({ pid })
    const { mid } = await ao.load({ pid, data })

    expect((await ao.dry({ pid, act: "Info", get: "Name" })).out).to.eql(
      "Testnet DB",
    )
    await ao.msg({ pid, act: "Mint", tags: { Quantity: "100" } })
    expect(
      (await ao.dry({ pid, act: "Balances", get: true })).out[ao.ar.addr],
    ).to.eql("100")

    const data2 = readFileSync(
      resolve(import.meta.dirname, "../contracts/weavedb_node_1.lua"),
      "utf8",
    )
    const { pid: pid2 } = await ao.spwn({
      module: opt.modules.aos2,
      tags: { Authority: "XztbUZU7D8lAcWlbg0avCD0s2lMBbFGgTC4YzLcOR90" },
    })
    await ao.wait({ pid: pid2 })
    const { mid: mid2 } = await ao.load({
      pid: pid2,
      data: data2,
      fills: { PARENT: pid, SOURCE: pid },
    })
    console.log(
      await ao.dry({
        pid: pid2,
        act: "Balances",
        get: true,
      }),
    )

    console.log("transfering....", ao.ar.addr)
    console.log(
      (
        await ao.msg({
          pid,
          act: "Transfer",
          tags: { Recipient: pid2, Quantity: "10" },
        })
      ).res.Messages[1],
    )

    await wait(3000)
    console.log(
      await ao.dry({
        pid: pid2,
        act: "Balances",
        get: true,
      }),
    )
    return
    console.log(
      (
        await ao.msg({
          pid: pid2,
          act: "Transfer",
          tags: { Sender: ao.ar.addr, Recipient: pid2, Quantity: "5" },
        })
      ).res.Messages[0].Tags,
    )
    console.log(ao.ar.addr)
    console.log(
      await ao.dry({
        pid: pid2,
        act: "Balances",
        get: true,
      }),
    )

    await ao.msg({
      pid: pid2,
      act: "Withdraw",
      tags: { Quantity: "3" },
    })

    await wait(3000)

    expect(
      (
        await ao.dry({
          pid: pid2,
          act: "Balances",
          get: true,
        })
      ).out[ao.ar.addr],
    ).to.eql(2)

    expect(
      (await ao.dry({ pid, act: "Balances", get: true })).out[ao.ar.addr],
    ).to.eql(93)
  })
})
