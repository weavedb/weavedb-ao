import yargs from "yargs"
import setup from "./setup.js"
const {
  tdb = "tDB",
  wallet = "bundler",
  network = "mainnet",
} = yargs(process.argv.slice(2)).argv

const main = async () => {
  const { ao, src } = await setup({ wallet, network })
  const { err, pid, p } = await ao.deploy({
    src_data: src.data("weavedb_node"),
    fills: { PARENT: tdb, SOURCE: tdb },
  })
  console.log("deployed: " + pid)
}
main()
