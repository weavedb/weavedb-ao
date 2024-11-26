import yargs from "yargs"
import setup from "./setup.js"
const {
  token = "tDB",
  wallet = "owner",
  network = "mainnet",
} = yargs(process.argv.slice(2)).argv

const main = async () => {
  const { ao, src } = await setup({ wallet, network })
  const { err, pid, p } = await ao.deploy({ src_data: src.data(token) })
  if (err) return console.log(err)
  console.log(token + " deployed: " + pid)
  console.log(
    await p.msg("Mint", {
      Quantity:
        token === "tDB"
          ? "1000000000" + "000000000000"
          : "1000000" + "000000000000000000",
    }),
  )
  console.log(await p.d("Balances"))
}
main()
