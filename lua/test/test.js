import { setup, ok, fail } from "aonote/test/helpers.js"
import { expect } from "chai"
import { AR, AO } from "aonote"
import { readFileSync } from "fs"
import { resolve } from "path"

const wait = ms => new Promise(res => setTimeout(() => res(), ms))

describe("WeaveDB", function () {
  this.timeout(0)
  let ao, opt, profile, ar, thumbnail, banner

  before(async () => {
    ;({ thumbnail, banner, opt, ao, ar, profile } = await setup({
      cache: true,
    }))
  })

  it("should deploy weavedb process", async () => {
    const data = readFileSync(
      resolve(import.meta.dirname, "../contracts/weavedb.lua"),
      "utf8",
    )
    const { err, pid } = await ao.spwn({})

    await ao.wait({ pid })
    const { mid } = await ao.load({ pid, data, fills: { BUNDLER: ar.addr } })
    const bob = { name: "Bob" }
    ok(
      await ao.msg({
        pid,
        act: "Rollup",
        data: JSON.stringify({
          diffs: [{ collection: "ppl", doc: "Bob", data: bob }],
        }),
        checkData: "committed!",
      }),
    )
    const q = async (...query) => {
      const get = { name: "Result", json: true }
      const tags = { Query: JSON.stringify(query) }
      return JSON.parse((await ao.dry({ pid, act: "Get", tags, get })).out)
    }
    const res = await q("ppl", "Bob")
    expect(res).to.eql(bob)
    expect(await q("ppl")).to.eql([bob])
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
