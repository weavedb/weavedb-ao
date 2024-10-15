import { setup, ok, fail } from "aonote/test/helpers.js"
import { expect } from "chai"
import { AR, AO, Profile, Note, Notebook } from "aonote"
import { readFileSync } from "fs"
import { resolve } from "path"

describe("Atomic Notes", function () {
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
})
