const EthCrypto = require("eth-crypto")
const { readFileSync } = require("fs")
const { join, resolve } = require("path")
const { VM } = require("../../vm")
const { Server } = require("../../server")
const Arweave = require("arweave")
const { rmSync } = require("fs")
const { CU, MU, SU } = require("cwao-units")
const CUWDB = require("cwao-units/cu-weavedb")

const wait = ms => {
  console.log("waiting for...", String(ms), "ms")
  return new Promise(res => setTimeout(() => res(), ms))
}

class Test {
  constructor({
    aos,
    snapshot,
    sequencerUrl,
    apiKey,
    secure = true,
    weavedb_version,
    weavedb_srcTxId,
    dbname,
    bundler,
    staking,
    admin,
    admin_l1,
    network,
    cosmwasm = false,
    admin_contract,
  }) {
    this.aos = aos
    this.admin_contract = admin_contract
    this.snapshot = snapshot
    this.sequencerUrl = sequencerUrl
    this.apiKey = apiKey
    this.admin = admin
    this.admin_l1 = admin_l1
    this.bundler = bundler
    this.staking = staking
    this.secure = secure
    this.weavedb_srcTxId = weavedb_srcTxId
    this.weavedb_version = weavedb_version ?? "0.42.1"
    this.network = network ?? {
      host: "localhost",
      port: 4000,
      protocol: "http",
    }

    this.dbname = dbname ?? `test-${Math.floor(Math.random() * 1000)}`
  }
  async addFunds(wallet, amount = "1000000000000000") {
    const addr = await this.arweave.wallets.getAddress(wallet)
    await this.arweave.api.get(`/mint/${addr}/${amount}`)
  }
  async genBunder() {
    this.arweave = Arweave.init(this.network)
    if (!this.bundler) {
      this.bundler = await this.arweave.wallets.generate()
      await this.addFunds(this.bundler)
    } else {
      console.log("bundler already exists")
      await this.addFunds(this.bundler)
    }
    if (!this.bundler2) {
      this.bundler2 = await this.arweave.wallets.generate()
      await this.addFunds(this.bundler2)
    } else {
      console.log("bundler2 already exists")
    }
  }
  async genAdmin() {
    if (!this.admin) {
      this.admin = EthCrypto.createIdentity()
    } else {
      console.log("admin already exists")
    }
    if (!this.admin_l1) {
      this.admin_l1 = EthCrypto.createIdentity()
    } else {
      console.log("L2 admin already exists")
    }
  }
  async startVM() {
    this.conf = {
      aos: this.aos,
      ao: this.base,
      admin_contract: this.admin_contract,
      snapshot: this.snapshot,
      sequencerUrl: this.sequencerUrl,
      apiKey: this.apiKey,
      secure: this.secure,
      weavedb_srcTxId: this.weavedb_srcTxId,
      weavedb_version: this.weavedb_version,
      arweave: this.network,
      dbname: this.dbname,
      admin: this.admin.privateKey,
      admin_l1: this.admin_l1.privateKey,
      bundler: this.bundler,
      staking: this.staking,
      rollups: {},
      contracts: this.contracts,
    }
    this.vm = new VM({ conf: this.conf })
  }
  async startServer() {
    this.server = new Server({ query: this.vm.query.bind(this.vm) })
  }

  async start() {
    await this.genBunder()
    await this.genAdmin()
    await this.startVM()
    await this.startServer()
    await wait(1000)
    return {
      base: this.base,
      base_cw: this.base_cw,
      mu: this.mu,
      su: this.su,
      cu: this.cu,
      mu_cw: this.mu_cw,
      su_cw: this.su_cw,
      cu_cw: this.cu_cw,
      dbname: this.dbname,
      network: this.network,
      arweave: this.arweave,
      bundler: this.bundler,
      bundler2: this.bundler2,
      admin: this.admin,
      admin_l1: this.admin_l1,
      contracts: this.contracts,
      weavedb_srcTxId: this.weavedb_srcTxId,
      conf: this.conf,
      vm: this.vm,
      server: this.server,
    }
  }
  async stopVM() {
    await this.vm.stop()
  }
  stopServer() {
    this.server.server.forceShutdown()
  }
  deleteCache() {
    try {
      rmSync(resolve(__dirname, "../../cache", this.dbname), {
        recursive: true,
        force: true,
      })
    } catch (e) {
      console.log(e)
    }
    try {
      rmSync(resolve(__dirname, "../../backup", this.dbname), {
        recursive: true,
        force: true,
      })
    } catch (e) {
      console.log(e)
    }
  }
  async stop() {
    this.stopServer()
    await this.stopVM()
    this.deleteCache()
  }
}

module.exports = { Test, wait }
