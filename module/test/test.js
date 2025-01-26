import assert from "assert"
import { describe, it } from "node:test"
import { AO, Src, acc } from "wao/test"
import { resolve } from "path"

const src_data = `
local wdb = require("weavedb")

Handlers.add("Set", "Set", function (msg)
  wdb.set({ name = "Bob" }, "ppl", "bob")
  wdb.set({ name = "Mike" }, "ppl", "mike")
  wdb.upsert({ name = "Beth" }, "ppl", "beth")
  local id = wdb.add({ name = "Alice" }, "ppl")
  wdb.update({ age = 3 }, "ppl", id)
  wdb.upsert({ name = "Bob", age = 10 }, "ppl", "bob")
  msg.reply({ Data = wdb.cget("ppl") })
end)
`

describe("WeaveDB", function () {
  it("should handle", async () => {
    const ao = await new AO().init(acc[0])
    const src = new Src({ dir: resolve(import.meta.dirname, "..") })
    const { id: module } = await ao.postModule({
      data: src.data("process", "wasm"),
    })
    await ao.spwn({ module })
    const { p, pid } = await ao.deploy({ module, src_data })
    assert.deepEqual(await p.d("Set"), [
      { name: "Alice", age: 3 },
      { name: "Beth" },
      { name: "Bob", age: 10 },
      { name: "Mike" },
    ])
  })
})
