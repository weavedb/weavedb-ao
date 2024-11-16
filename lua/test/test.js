import { setup, ok, fail } from "aonote/test/helpers.js"
import { expect } from "chai"
import { AR, AO } from "aonote"
import { readFileSync } from "fs"
import { resolve } from "path"
import forge from "node-forge"
import { _parser, qs3, qs1, qs2 } from "./parser.js"
import { reverse, map } from "ramda"
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
  let ao, opt, profile, ar, thumbnail, banner

  before(async () => {
    ;({ thumbnail, banner, opt, ao, ar, profile } = await setup({
      cache: true,
    }))
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
    ok(await ao.load({ pid, data, fills: { BUNDLER: ar.addr } }))
  })

  it.only("should deploy weavedb process", async () => {
    const data = readFileSync(
      resolve(import.meta.dirname, "../contracts/weavedb.lua"),
      "utf8",
    )
    const { err, pid } = await ao.spwn({ module: opt.modules.aos2 })

    await ao.wait({ pid })
    const { mid } = await ao.load({ pid, data, fills: { BUNDLER: ar.addr } })
    const bob = { name: "Bob", age: 5, favs: ["apple", "orange"] }
    const alice = { name: "Alice", age: 10, favs: ["apple", "grape"] }
    const mike = { name: "Mike", age: 15, favs: ["lemon", "peach"] }
    const beth = { name: "Beth", age: 20, favs: ["grape", "peach"] }
    const ppl = [bob, alice, mike, beth]
    ok(
      await ao.msg({
        pid,
        act: "Rollup",
        data: JSON.stringify({
          diffs: map(v => ({
            collection: "ppl",
            doc: v.name,
            op: "set",
            data: v,
          }))(ppl),
        }),
        checkData: "committed!",
      }),
    )
    ok(
      await ao.msg({
        pid,
        act: "Rollup",
        data: JSON.stringify({
          diffs: map(v => ({
            collection: "ppl",
            doc: v.name,
            op: "delete",
            data: null,
          }))(ppl),
        }),
        checkData: "committed!",
      }),
    )

    ok(
      await ao.msg({
        pid,
        act: "Rollup",
        data: JSON.stringify({
          diffs: map(v => ({
            collection: "ppl",
            doc: v.name,
            op: "update",
            data: v,
          }))(ppl),
        }),
        checkData: "committed!",
      }),
    )

    const q = async (...query) => {
      const get = { data: true, json: true }
      const tags = { Query: JSON.stringify(query) }
      return (await ao.dry({ pid, act: "Get", tags, get })).out
    }
    const q2 = async (...query) => {
      const get = { data: true, json: true }
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
        fills: { BUNDLER: ar.addr },
      }),
    )
    const { res: res2, out } = await ao.msg({
      pid: pid2,
      act: "Fetch",
      tags: { DB: pid },
      get: { data: true, json: true },
    })
    console.log(out)
    */
  })

  it("should deploy tDB token and subledgers", async () => {
    const data = readFileSync(
      resolve(import.meta.dirname, "../contracts/tDB.lua"),
      "utf8",
    )
    const { err, pid } = await ao.spwn({})
    await ao.wait({ pid })
    const { mid } = await ao.load({ pid, data })

    expect((await ao.dry({ pid, act: "Info", get: "Name" })).out).to.eql(
      "Testnet DB",
    )

    await ao.msg({ pid, act: "Mint", tags: { Quantity: "100" } })
    expect(
      (await ao.dry({ pid, act: "Balances", get: { data: true, json: true } }))
        .out[ao.ar.addr],
    ).to.eql(100)
    const data2 = readFileSync(
      resolve(import.meta.dirname, "../contracts/weavedb_node.lua"),
      "utf8",
    )
    const { pid: pid2 } = await ao.spwn({})
    await ao.wait({ pid: pid2 })
    const { mid: mid2 } = await ao.load({
      pid: pid2,
      data: data2,
      fills: { PARENT: pid, SOURCE: pid },
    })
    const res = await ao.msg({
      pid,
      act: "Transfer",
      tags: { Recipient: pid2, Quantity: "10" },
    })
    await wait(3000)
    await ao.msg({
      pid: pid2,
      act: "Transfer",
      tags: { Sender: ao.ar.addr, Recipient: pid2, Quantity: "5" },
    })
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
          get: { data: true, json: true },
        })
      ).out[ao.ar.addr],
    ).to.eql(2)

    expect(
      (await ao.dry({ pid, act: "Balances", get: { data: true, json: true } }))
        .out[ao.ar.addr],
    ).to.eql(93)
  })
})
