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
    const ao = await new AO(opt.ao).init(ar.jwk)
    const { pid } = await ao.spwn({})
    await ao.wait({ pid })
    const { mid } = await ao.load({ pid, data })
    ok(
      await ao.msg({
        pid,
        act: "Rollup",
        data: JSON.stringify([
          { collection: "ppl", doc: "Bob", data: { name: "Bob" } },
        ]),
        checkData: "committed!",
      }),
    )

    const res = JSON.parse(
      (
        await ao.dry({
          pid,
          act: "Get",
          tags: {
            Query: JSON.stringify(["ppl", "Bob"]),
          },
          get: { name: "Result", json: true },
        })
      ).out,
    )
    expect(res).to.eql({ name: "Bob" })
  })
})
