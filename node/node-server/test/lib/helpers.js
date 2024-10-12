const { Note, Profile, AR, AO, Collection, Notebook } = require("aonote")
const { expect } = require("chai")
const { resolve } = require("path")
const { mkdirSync, existsSync, writeFileSync, readFileSync } = require("fs")

class Src {
  constructor({ ar, base = "../../lua", readFileSync, dir, resolve }) {
    this.ar = ar
    this.base = base
    this.dir = dir
  }
  data(file, ext = "lua") {
    return readFileSync(
      resolve(this.dir, this.base, `${file}.${ext}`),
      ext === "wasm" ? null : "utf8",
    )
  }
  async upload(file, ext = "lua") {
    const res = await this.ar.post({ data: this.data(file, ext) })
    return res.err ? null : res.id
  }
}

const setup = async ({
  aoconnect,
  arweave,
  cache = false,
  cacheDir = ".cache",
} = {}) => {
  let opt = null
  console.error = () => {}
  console.warn = () => {}
  const dir = resolve(__dirname)
  const _cacheDir = resolve(__dirname, cacheDir)
  const optPath = `${_cacheDir}/opt.json`
  if (cache) {
    if (!existsSync(_cacheDir)) mkdirSync(_cacheDir)
    if (existsSync(optPath)) opt = JSON.parse(readFileSync(optPath, "utf8"))
  }
  if (opt) {
    const ar = await new AR(opt.ar).init(opt.jwk)
    const ao = new AO({ ...opt.ar, ar })
    const profile = new Profile({ ...opt.profile, ao })
    return { opt, ar, ao, profile }
  }
  arweave ??= { port: 4000 }
  aoconnect ??= {
    MU_URL: "http://localhost:4002",
    CU_URL: "http://localhost:4004",
    GATEWAY_URL: "http://localhost:4000",
  }
  const ar = new AR(arweave)
  await ar.gen("10")
  const src = new Src({ ar, readFileSync, dir })
  const wasm = await src.upload("aos", "wasm")
  const ao = new AO({ aoconnect, ar })
  const { scheduler } = await ao.postScheduler({
    url: "http://su",
    overwrite: true,
  })
  const { id: module } = await ao.postModule({
    data: await ar.data(wasm),
    overwrite: true,
  })
  opt = { ar: { ...arweave }, jwk: ar.jwk }
  opt.ao = { module: module, scheduler, aoconnect, ar: opt.ar }
  if (cache) writeFileSync(optPath, JSON.stringify(opt))
  return { opt, ao, ar, src }
}

const ok = obj => {
  if (obj.err) console.log(obj.err)
  expect(obj.err).to.eql(null)
  return obj
}

const fail = obj => {
  if (!obj.err) console.log(obj.res)
  expect(obj.err).to.not.eql(null)
  return obj
}

module.exports = { Src, setup, ok, fail }
