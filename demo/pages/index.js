import { Link, ssr } from "arnext"
import SyntaxHighlighter from "react-syntax-highlighter"
import a11yDark from "../lib/a11y-dark"
const { AO } = require("aonote")
const { toIndex, path, encodeQuery } = require("zkjson")
import { useEffect, useState } from "react"
import DB from "weavedb-client"
import { abi } from "@/lib/utils"
const contractTxId = process.env.NEXT_PUBLIC_PROCESS
const network = { host: "localhost", port: 4000, protocol: "http" }
const { Contract, getDefaultProvider } = require("ethers")
import About from "@/components/About"
import Footer from "@/components/Footer"
import {
  Image,
  Flex,
  Box,
  Input,
  Textarea,
  Select,
  useToast,
} from "@chakra-ui/react"
import {
  without,
  append,
  range,
  map,
  pluck,
  indexBy,
  prop,
  reverse,
  isNil,
  assoc,
  includes,
  is,
  trim,
} from "ramda"
const wait = ms => new Promise(res => setTimeout(() => res(), ms))
const provider = getDefaultProvider("sepolia", {
  infura: process.env.NEXT_PUBLIC_INFURA_KEY,
})
const rpc = process.env.NEXT_PUBLIC_RPC
const opt =
  process.env.NEXT_PUBLIC_NODE === "localhost"
    ? {
        ar: { port: 4000 },
        aoconnect: {
          MU_URL: "http://localhost:4002",
          CU_URL: "http://localhost:4004",
          GATEWAY_URL: "http://localhost:4000",
        },
      }
    : {}

const getQ = ({
  search,
  selectedCol,
  limit,
  order,
  query,
  operator,
  value,
  sort,
}) => {
  if (search === "single") {
    return [selectedCol, query]
  } else {
    let q = [selectedCol]

    if (!includes(operator, ["array-contains", "array-contains-any"]))
      q.push([sort, order])
    if (operator !== "") {
      let val = value
      if (includes(operator, ["in", "not-in", "array-contains-any"])) {
        val = map(v => {
          let v2 = trim(v)
          if (sort === "age") v2 *= 1
          if (sort === "married") v2 = v2 === "false" ? false : true
          return v2
        })(val.split(","))
      } else {
        if (sort === "age") val *= 1
      }
      q.push([sort, operator, val])
    }
    if (limit !== "") q.push(+limit)
    return q
  }
}
const commit = async ({ _alert, committing, dbname2, setCommitting, dbs }) => {
  let updated = false
  if (!committing[dbname2]) {
    setCommitting(assoc(dbname2, true, committing))
    try {
      const contractTxId = indexBy(prop("id"), dbs)[dbname2].data.contractTxId
      const db = new DB({ rpc, contractTxId })
      const res = await fetch("/api/commitRoot", {
        method: "POST",
        body: JSON.stringify({
          contractTxId,
          key: dbname2,
        }),
      }).then(r => r.json())
      if (res.success) {
        if (_alert) alert("hash committed!")
        updated = res.updated
      } else {
        if (_alert) alert("something went wrong!")
      }
    } catch (e) {
      if (_alert) alert("something went wrong!")
    }
    setCommitting(assoc(dbname2, false, committing))
  }
  return updated
}
const codeDeploy = ({ dbname }) => {
  return `await db.admin({ op: "add_db", key: "${dbname}", db: { owner }})
await db.admin({ op: "deploy_contract", key: "${dbname}" })
`
}

const codeDeploy2 = ({ colName }) => {
  return `const rules = [["write", [["allow()"]]]]
await db.setRules(rules, "${colName}")
const schema = {
  type: "object",
  required: ["name", "age", "married", "favorites"],
  properties: {
    name: { type: "string" },
    age: { type: "number" },
    married: { type: "boolean" },
    favorites: { type: "array", items: { type: "string" } }
  },
}
await db.setSchema(schema, "${colName}" })
`
}

const codeDeploy3 = ({ col, age, name, married, favorites }) => {
  return `const profile = {
  name: "${name}",
  age: ${age},
  married: ${married},
  favorites: [${map(v => `"${v}"`)(favorites).join(", ")}]
}
await db.set(profile, "${col}", "${name}")`
}

const codeDeploy4 = ({
  selectedCol,
  limit,
  order,
  query,
  search,
  operator,
  value,
  sort,
}) => {
  const q = getQ({
    order,
    query,
    search,
    selectedCol,
    limit,
    operator,
    value,
    sort,
  })
  return `await db.get(${JSON.stringify(q).replace(/^\[/, "").replace(/\]$/, "").replace(/,/g, ", ")})
`
}

const codeDeploy5 = ({ db, col, doc, tar }) => {
  return `const zkp = await db.node({
  op: "zkp",
  key: "${db}",
  collection: "${col}",
  doc: "${doc}",
  path: "${tar}",
})
`
}

const codeDeploy6 = ({ txid, path, zkp, fn }) => {
  return `await contract.${fn}(
  "${txid}",
  ${path},
  ${zkp},
)
`
}

export default function Home({ _date = null }) {
  const [depositing, setDepositing] = useState(false)
  const toast = useToast()
  const [op, setOp] = useState("Deposit")
  const [amount, setAmount] = useState("100")
  const [where, setWhere] = useState("")
  const [qtype, setQType] = useState("disclosure")
  const [operator, setOperator] = useState("")
  const [value, setValue] = useState("")
  const [limit, setLimit] = useState("")
  const [sort, setSort] = useState("name")
  const [order, setOrder] = useState("asc")
  const [search, setSearch] = useState("single")
  const [showCode, setShowCode] = useState(false)
  const [showCode2, setShowCode2] = useState(false)
  const [showCode3, setShowCode3] = useState(false)
  const [showCode4, setShowCode4] = useState(false)
  const [showCode5, setShowCode5] = useState(false)
  const [showCode6, setShowCode6] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [favs, setFavs] = useState([])
  const [tab, setTab] = useState("about")
  const [hash, setHash] = useState(null)
  const [committing, setCommitting] = useState({})
  const [generating, setGenerating] = useState(false)
  const [querying, setQuerying] = useState(false)
  const [which, setWhich] = useState("WeaveDB Rollup")
  const [zkp, setZKP] = useState(null)
  const [name, setName] = useState("")
  const [dbname, setDBName] = useState("")
  const [dbname2, setDBName2] = useState("")
  const [query, setQuery] = useState("")
  const [tar, setTar] = useState("name")
  const [age, setAge] = useState(5)
  const [married, setMarried] = useState(true)
  const [latency, setLatency] = useState(null)
  const [latency2, setLatency2] = useState(null)
  const [latency3, setLatency3] = useState(null)
  const [latency4, setLatency4] = useState(null)
  const [latency5, setLatency5] = useState(null)
  const [latency6, setLatency6] = useState(null)
  const [loading, setLoading] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [data, setData] = useState(null)
  const [data2, setData2] = useState(null)
  const [selectedData, setSelectedData] = useState(null)
  const [dbs, setDBs] = useState([])
  const [cols, setCols] = useState([])
  const [colName, setColName] = useState("")
  const [qvalue, setQValue] = useState("")
  const [selectedCol, setSelectedCol] = useState(null)
  const [addr, setAddr] = useState(null)
  const [balance, setBalance] = useState(0)
  const [deposit, setDeposit] = useState(0)

  const _path = isNil(zkp)
    ? null
    : [Number(zkp.col_id).toString(), toIndex(zkp.data.name), ...path(zkp.tar)]

  const tabs = [
    { key: "about", name: "About" },
    { key: "create", name: "Create DB" },
    { key: "query", name: "Query" },
    { key: "zkjson", name: "zkJSON" },
    { key: "usecases", name: "Use Cases" },
  ]

  useEffect(() => {
    ;(async () => {
      const db = new DB({ rpc, contractTxId: dbname, arweave: network })
      const stats = await db.node({ op: "stats" })
      setDBs(stats.dbs)
      if (stats.dbs[0]) {
        setDBName2(stats.dbs[0].id ?? null)
        const db2 = new DB({
          rpc,
          contractTxId: stats.dbs[0].id,
          arweave: network,
        })
        const _cols = await db2.listCollections()
        setSelectedCol(_cols[0] ?? null)
        setCols(_cols)
        if (!isNil(_cols[0])) setProfiles(await db2.get(_cols[0]))
      }
    })()
  }, [])
  const processId = isNil(zkp)
    ? ""
    : (indexBy(prop("id"), dbs)[zkp.db]?.data?.contractTxId ?? "")
  const deploy_ok = !/^\s*$/.test(dbname) && deposit * 1 >= 100 * 10 ** 12
  const deposit_ok = amount * 1 > 0 && balance * 1 >= amount * 10 ** 12
  const add_ok = !/^\s*$/.test(colName)
  const save_ok = !/^\s*$/.test(name)
  const query_ok = search === "multi" || !/^\s*$/.test(query)
  const zkp_ok =
    !isNil(selectedData) && (qtype === "disclosure" || !/^\s*$/.test(qvalue))
  const eth_ok = !committing[zkp?.db]
  const ops = includes(tar, ["name", "age", "married"])
    ? [
        {
          val: "disclosure",
          name: "Selective Disclosure",
        },
        { val: "gt", name: "$gt" },
        { val: "gte", name: "$gte" },
        { val: "lt", name: "$lt" },
        { val: "lte", name: "$lte" },
        { val: "eq", name: "$eq" },
        { val: "ne", name: "$ne" },
        { val: "in", name: "$in" },
      ]
    : [
        { val: "contains", name: "$contains" },
        {
          val: "contains_any",
          name: "$contains_any",
        },
        {
          val: "contains_all",
          name: "$contains_all",
        },
        {
          val: "contains_none",
          name: "$contains_none",
        },
      ]
  return (
    <>
      <Flex
        h="60px"
        sx={{
          position: "fixed",
          top: 0,
          left: 0,
          borderBottom: "1px solid #9c89f6",
        }}
        w="100%"
        align="center"
        p={4}
        justify="center"
        bg="white"
      >
        <Flex w="100%" maxW="1360px">
          <Flex align="center" color="#5137C5" fontWeight="bold">
            <Image mr={2} src="/logo.svg" boxSize="25px" />
            WeaveDB Demos
          </Flex>
          <Box flex={1} />
          <Flex
            h="40px"
            justify="center"
            w="150px"
            align="center"
            bg={"#5137C5"}
            color="white"
            py={1}
            px={3}
            sx={{
              borderRadius: "5px",
              ":hover": { opacity: 0.75 },
              cursor: "pointer",
            }}
            onClick={async () => {
              await arweaveWallet.connect([
                "ACCESS_ADDRESS",
                "SIGN_TRANSACTION",
                "ACCESS_PUBLIC_KEY",
              ])
              const addr = await arweaveWallet.getActiveAddress()
              const ao = new AO(opt)
              const { out } = await ao.dry({
                pid: process.env.NEXT_PUBLIC_TDB,
                act: "Balance",
                tags: { Target: addr },
                get: "Balance",
              })
              setBalance(out * 1)

              const { out: out2 } = await ao.dry({
                pid: process.env.NEXT_PUBLIC_ADMIN_CONTRACT,
                act: "Balance",
                tags: { Target: addr },
                get: "Balance",
              })
              setDeposit(out2 * 1)
              setAddr(addr)
            }}
          >
            {addr ? addr.slice(0, 10) : "Connect Wallet"}
          </Flex>
        </Flex>
      </Flex>
      <Flex
        align="center"
        justify="center"
        mt="60px"
        color="#3c3c43"
        fontSize={"30px"}
      >
        <Flex
          align="center"
          justify="center"
          h="100%"
          w="100%"
          sx={{
            backgroundPosition: "left",
            backgroundRepeat: "no-repeat",
          }}
          p={8}
        >
          <Flex
            w="100%"
            maxW="1150px"
            fontSize="50px"
            my="50px"
            sx={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
          >
            <Box>
              <Box fontWeight="bold">Zero Knowledge Provable</Box>
              <Box fontWeight="bold">NoSQL Database</Box>
              <Box
                mt={4}
                w="100%"
                maxW="1150px"
                fontSize="24px"
                sx={{
                  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                }}
              >
                <Box>
                  <Box>Hyper Extending Blockchains with zkJSON.</Box>
                  <Box mt={1}>Web3 with Web2 UX is Finally Here.</Box>
                </Box>
                <Flex mt={6} mb={5}>
                  <Link href="https://x.com/Mardeni01" target="_blank">
                    <Flex
                      color="white"
                      sx={{
                        bg: "#9C89F6",
                        borderRadius: "30px",
                        cursor: "pointer",
                        ":hover": { opacity: 0.75 },
                      }}
                      fontSize="18px"
                      w="130px"
                      justify="center"
                      p={2}
                    >
                      CEO
                    </Flex>
                  </Link>
                  <Link href="https://x.com/0xTomo" target="_blank">
                    <Flex
                      ml={4}
                      color="white"
                      sx={{
                        bg: "#9C89F6",
                        borderRadius: "30px",
                        cursor: "pointer",
                        ":hover": { opacity: 0.75 },
                      }}
                      fontSize="18px"
                      w="130px"
                      justify="center"
                      p={2}
                    >
                      Tech Lead
                    </Flex>
                  </Link>
                  <Link
                    href="https://github.com/weavedb/weavedb-ao"
                    target="_blank"
                  >
                    <Flex
                      ml={4}
                      color="white"
                      sx={{
                        bg: "#9C89F6",
                        borderRadius: "30px",
                        cursor: "pointer",
                        ":hover": { opacity: 0.75 },
                      }}
                      fontSize="18px"
                      w="130px"
                      justify="center"
                      p={2}
                    >
                      Github
                    </Flex>
                  </Link>
                  <Link href="https://x.com/weave_db" target="_blank">
                    <Flex
                      ml={4}
                      color="white"
                      sx={{
                        bg: "#9C89F6",
                        borderRadius: "30px",
                        cursor: "pointer",
                        ":hover": { opacity: 0.75 },
                      }}
                      fontSize="18px"
                      w="130px"
                      justify="center"
                      p={2}
                    >
                      X
                    </Flex>
                  </Link>
                </Flex>
              </Box>
            </Box>
            <Flex flex={1} align="center" justify="center">
              <Flex
                p={10}
                align="center"
                justify="center"
                sx={{
                  border: "15px solid #5137C5",
                  borderRadius: "50%",
                  ":hover": { opacity: 0.75 },
                }}
              >
                <Image src="/logo.svg" boxSize="200px" pt="30px" />
              </Flex>
            </Flex>
          </Flex>
        </Flex>
      </Flex>
      <Flex justify="center">
        <Flex w="100%" maxW="1150px">
          {map(v => {
            return (
              <Flex
                sx={{
                  borderRadius: "5px 5px 0 0",
                  cursor: "pointer",
                  ":hover": { opacity: 0.75 },
                }}
                justify="center"
                py={3}
                w="130px"
                bg={v.key === tab ? "#5137C5" : "white"}
                color={v.key === tab ? "#eee" : "#5137C5"}
                fontWeight="bold"
                onClick={() => {
                  if (v.soon) return alert("Coming Soon!")
                  setTab(v.key)
                }}
              >
                {v.name}
              </Flex>
            )
          })(tabs)}
        </Flex>
      </Flex>
      <Flex justify="center" p={10} bg="#5137C5" color="#9C89F6">
        {tab === "about" ? (
          <About {...{ setTab }} />
        ) : tab === "create" ? (
          <Box w="100%" maxW="1150px">
            <Flex>
              <Box flex={1} mr={4}>
                <Flex mb={4} align="center">
                  <Flex
                    px={6}
                    py={1}
                    bg="#9C89F6"
                    color="white"
                    sx={{ borderRadius: "50px" }}
                  >
                    Deposit tDB Token
                  </Flex>
                  <Box flex={1} />
                  <Flex>
                    Your Balance:
                    <Box mx={2}>{balance / 1000000000000} tDB</Box>
                  </Flex>
                  <Flex ml={4}>
                    Deposit:
                    <Box mx={2}>{deposit / 1000000000000} tDB</Box>
                  </Flex>
                </Flex>
                <Box
                  my={4}
                  sx={{ borderRadius: "5px", border: "1px solid #9C89F6" }}
                  p={4}
                  bg="white"
                >
                  <Flex>
                    <Box mr={4}>
                      <Box mb={1}>Operation</Box>
                      <Select
                        w="150px"
                        value={op}
                        onChange={e => setOp(e.target.value)}
                      >
                        <option value="Deposit">Deposit</option>
                        <option value="Withdraw">Withdraw</option>
                      </Select>
                    </Box>
                    <Box mr={4}>
                      <Box mb={1}>Amount (tDB)</Box>
                      <Input
                        value={amount}
                        onChange={e => {
                          if (
                            !Number.isNaN(+e.target.value) &&
                            Math.round(e.target.value * 1) === +e.target.value
                          ) {
                            setAmount(e.target.value)
                          }
                        }}
                      />
                    </Box>
                    <Box flex={1} />
                    <Flex align="flex-end">
                      <Flex
                        h="40px"
                        justify="center"
                        w="100px"
                        align="center"
                        bg={deposit_ok ? "#5137C5" : "#999"}
                        color="white"
                        py={1}
                        px={3}
                        sx={{
                          borderRadius: "5px",
                          ":hover": { opacity: 0.75 },
                          cursor: deposit_ok ? "pointer" : "default",
                        }}
                        onClick={async () => {
                          if (!depositing && deposit_ok) {
                            setDepositing(true)
                            try {
                              await arweaveWallet.connect([
                                "ACCESS_ADDRESS",
                                "SIGN_TRANSACTION",
                                "ACCESS_PUBLIC_KEY",
                              ])
                              const addr =
                                await arweaveWallet.getActiveAddress()
                              const ao = await new AO(opt).init(arweaveWallet)
                              const winston = "000000000000"
                              if (op === "Deposit") {
                                const { err, res } = await ao.msg({
                                  pid: process.env.NEXT_PUBLIC_TDB,
                                  act: "Transfer",
                                  tags: {
                                    Recipient:
                                      process.env.NEXT_PUBLIC_ADMIN_CONTRACT,
                                    Quantity: `${amount}${winston}`,
                                  },
                                })
                              } else {
                                const { err, res } = await ao.msg({
                                  pid: process.env.NEXT_PUBLIC_ADMIN_CONTRACT,
                                  act: "Withdraw",
                                  tags: { Quantity: `${amount}${winston}` },
                                })
                              }
                              await wait(3000)
                              const { out } = await ao.dry({
                                pid: process.env.NEXT_PUBLIC_TDB,
                                act: "Balance",
                                tags: { Target: addr },
                                get: "Balance",
                              })
                              setBalance(out * 1)

                              const { out: out2 } = await ao.dry({
                                pid: process.env.NEXT_PUBLIC_ADMIN_CONTRACT,
                                act: "Balance",
                                tags: { Target: addr },
                                get: "Balance",
                              })
                              setDeposit(out2 * 1)
                              setAddr(addr)
                            } catch (e) {
                              console.log(e)
                            }
                            setDepositing(false)
                          }
                        }}
                      >
                        {depositing ? (
                          <Box as="i" className="fas fa-spin fa-circle-notch" />
                        ) : (
                          op
                        )}
                      </Flex>
                    </Flex>
                  </Flex>
                </Box>
                <Flex mt={6} mb={4} align="center">
                  <Flex
                    px={6}
                    py={1}
                    bg="#9C89F6"
                    color="white"
                    sx={{ borderRadius: "50px" }}
                  >
                    Create DB Instance
                  </Flex>
                  <Box flex={1} />
                  <Flex>
                    Your Deposit:
                    <Box mx={2}>{deposit / 1000000000000} tDB</Box>
                  </Flex>
                  <Flex ml={4}>
                    Cost:
                    <Box mx={2}>100 tDB</Box>
                  </Flex>
                </Flex>
                <Box
                  my={4}
                  sx={{ borderRadius: "5px", border: "1px solid #9C89F6" }}
                  p={4}
                  bg="white"
                >
                  <Flex>
                    <Box mr={4}>
                      <Box mb={1}>Select Node</Box>
                      <Select w="150px">
                        <option>test.wdb.ae</option>
                      </Select>
                    </Box>
                    <Box mr={4}>
                      <Box mb={1}>New DB Name</Box>
                      <Input
                        value={dbname}
                        onChange={e => setDBName(e.target.value)}
                      />
                    </Box>
                    <Box flex={1} />
                    <Flex align="flex-end">
                      <Flex
                        h="40px"
                        justify="center"
                        w="100px"
                        align="center"
                        bg={deploy_ok ? "#5137C5" : "#999"}
                        color="white"
                        py={1}
                        px={3}
                        sx={{
                          borderRadius: "5px",
                          ":hover": { opacity: 0.75 },
                          cursor: deploy_ok ? "pointer" : "default",
                        }}
                        onClick={async () => {
                          if (!deploying && deploy_ok) {
                            await arweaveWallet.connect([
                              "ACCESS_ADDRESS",
                              "SIGN_TRANSACTION",
                              "ACCESS_PUBLIC_KEY",
                            ])
                            const addr = await arweaveWallet.getActiveAddress()
                            const ao = new AO(opt)
                            const { out: out2 } = await ao.dry({
                              pid: process.env.NEXT_PUBLIC_TDB,
                              act: "Balances",
                              get: { data: true, json: true },
                            })
                            const { out } = await ao.dry({
                              pid: process.env.NEXT_PUBLIC_ADMIN_CONTRACT,
                              act: "Balances",
                              get: { data: true, json: true },
                            })
                            const deposit = out?.[addr] ?? 0
                            if (deposit < 100000000000000) {
                              toast({
                                title: "Something Went Wrong!",
                                status: "error",
                                description:
                                  "Your deposit of tDB token is not enough.",
                                duration: 5000,
                                isClosable: true,
                              })
                              return
                            }
                            setDeploying(true)
                            const db = new DB({
                              rpc,
                              contractTxId: dbname,
                              arweave: network,
                            })
                            try {
                              const start = Date.now()
                              const tx = await db.admin(
                                {
                                  op: "add_db",
                                  key: dbname,
                                  db: {
                                    rollup: true,
                                    owner: addr,
                                  },
                                },
                                { ar2: arweaveWallet },
                              )
                              const { contractTxId, srcTxId } = await db.admin(
                                {
                                  op: "deploy_contract",
                                  key: dbname,
                                  type: "ao",
                                  module:
                                    "YTNXvQu2x21DD6Pm8zicVBghB-BlnM5VRrVRyfhBPP8",
                                  scheduler:
                                    "-_vZZQMEnvJmiIIfHfp_KuuV6ud2b9VSThfTmYytYQ8",
                                },
                                { ar2: arweaveWallet },
                              )
                              const duration = Date.now() - start
                              setLatency4({
                                dbname,
                                txid: contractTxId,
                                duration,
                              })
                              const stats = await db.node({ op: "stats" })
                              setDBs(stats.dbs)
                              setDBName("")
                              toast({
                                title: `DB Deployed in ${duration} ms!`,
                                description: contractTxId,
                                status: "success",
                                duration: 5000,
                                isClosable: true,
                              })
                            } catch (e) {
                              toast({
                                title: "Something Went Wrong!",
                                status: "error",
                                description: e.toString(),
                                duration: 5000,
                                isClosable: true,
                              })
                            }
                            setDeploying(false)
                          }
                        }}
                      >
                        {deploying ? (
                          <Box as="i" className="fas fa-spin fa-circle-notch" />
                        ) : (
                          "Deploy"
                        )}
                      </Flex>
                    </Flex>
                  </Flex>
                  <Flex
                    fontSize="12px"
                    mt={4}
                    justify="center"
                    sx={{
                      textDecoration: "underline",
                      cursor: "pointer",
                      ":hover": { opacity: 0.75 },
                    }}
                    onClick={() => setShowCode(!showCode)}
                  >
                    {showCode ? "Hide JS Code" : "Show JS Code"}
                  </Flex>

                  {!showCode ? null : (
                    <Box fontSize="12px" mt={2}>
                      <SyntaxHighlighter language="javascript" style={a11yDark}>
                        {codeDeploy({ dbname })}
                      </SyntaxHighlighter>
                    </Box>
                  )}
                </Box>
                <Flex justify="flex-end" align="center" mb={6}>
                  {latency4 ? (
                    <>
                      <Link
                        target="_blank"
                        href={`${process.env.NEXT_PUBLIC_SCAN}/node/${process.env.NEXT_PUBLIC_NODE}/db/${latency4.dbname}`}
                      >
                        <Box
                          sx={{
                            textDecoration: "underline",
                            ":hover": { opacity: 0.75 },
                          }}
                        >
                          WeaveDB
                        </Box>
                      </Link>
                      <Box as="i" className="fas fa-arrow-right" mx={4} />
                      <Link
                        target="_blank"
                        href={`https://ao.link/#/entity/${latency4.txid}`}
                      >
                        <Box
                          sx={{
                            textDecoration: "underline",
                            ":hover": { opacity: 0.75 },
                          }}
                        >
                          AO
                        </Box>
                      </Link>
                      <Box as="i" className="fas fa-arrow-right" mx={4} />
                      <Link
                        target="_blank"
                        href={`https://sepolia.etherscan.io/address/${process.env.NEXT_PUBLIC_CONTRACT}`}
                      >
                        <Box
                          sx={{
                            textDecoration: "underline",
                            ":hover": { opacity: 0.75 },
                          }}
                        >
                          Ethereum
                        </Box>
                      </Link>
                      <Box flex={1} />
                      <Flex>
                        DB deployed in{" "}
                        <Box
                          ml={3}
                          fontWeight="bold"
                          bg="white"
                          px={2}
                          sx={{ borderRadius: "5px" }}
                        >
                          {latency4.duration} ms
                        </Box>
                      </Flex>
                    </>
                  ) : null}
                </Flex>
              </Box>
              <Box flex={1} ml={4}>
                <Box>
                  <Flex
                    fontSize="14px"
                    px={4}
                    bg="white"
                    sx={{
                      borderRadius: "5px 5px 0 0",
                      borderBottom: "1px solid #9C89F6",
                    }}
                  >
                    <Box w="100px" p={2}>
                      DB Name
                    </Box>
                    <Box p={2} flex={1}>
                      AO Process TxId
                    </Box>
                    <Box p={2} flex={1}>
                      DB Admin
                    </Box>
                  </Flex>
                  {map(v => {
                    return (
                      <Flex
                        px={4}
                        sx={{
                          borderBottom: "1px solid #9C89F6",
                        }}
                        align="center"
                      >
                        <Box w="100px" p={2}>
                          <Link
                            target="_blank"
                            href={`${process.env.NEXT_PUBLIC_SCAN}/node/${process.env.NEXT_PUBLIC_NODE}/db/${v.id}`}
                          >
                            <Box
                              sx={{
                                cursor: "pointer",
                                ":hover": { opacity: 0.75 },
                              }}
                            >
                              {v.id}
                            </Box>
                          </Link>
                        </Box>
                        <Box flex={1} p={2} fontSize="12px">
                          <Link
                            target="_blank"
                            href={`https://ao.link/#/entity/${v.data.contractTxId}`}
                          >
                            <Box
                              sx={{
                                cursor: "pointer",
                                ":hover": { opacity: 0.75 },
                              }}
                            >
                              {v.data.contractTxId.slice(0, 20)}...
                            </Box>
                          </Link>
                        </Box>
                        <Box flex={1} p={2} fontSize="12px">
                          <Link
                            target="_blank"
                            href={`https://ao.link/#/entity/${v.data.admin}`}
                          >
                            <Box
                              sx={{
                                cursor: "pointer",
                                ":hover": { opacity: 0.75 },
                              }}
                            >
                              {v.data.admin.slice(0, 20)}...
                            </Box>
                          </Link>
                        </Box>
                      </Flex>
                    )
                  })(reverse(dbs))}
                </Box>
              </Box>
            </Flex>
          </Box>
        ) : tab === "query" || tab === "zkjson" ? (
          <Box w="100%" maxW="1150px">
            <Flex>
              <Box flex={1} mr={4}>
                <Box
                  mb={6}
                  sx={{ borderRadius: "5px", border: "1px solid #9C89F6" }}
                  p={4}
                  bg="white"
                >
                  <Flex>
                    <Box mr={4} flex={1}>
                      <Box mb={1}>Choose DB</Box>
                      <Select
                        value={dbname2}
                        onChange={async e => {
                          const dbname = e.target.value
                          setDBName2(dbname)
                          const db = new DB({
                            rpc,
                            contractTxId: dbname,
                            arweave: network,
                          })
                          const _cols = await db.listCollections()
                          setCols(_cols)
                          setSelectedCol(_cols[0] ?? null)
                          if (!isNil(_cols[0])) {
                            const prs = await db.get(_cols[0])
                            setProfiles(prs)
                            if (!isNil(prs[0])) {
                              setSelectedData(prs[0])
                            } else {
                              setSelectedData(null)
                            }
                          } else {
                            setSelectedData(null)
                          }
                        }}
                      >
                        {map(v => <option value={v.id}>{v.id}</option>)(dbs)}
                      </Select>
                    </Box>
                    <Box flex={1}>
                      <Box mb={1}>Collections</Box>
                      <Select
                        value={selectedCol}
                        onChange={async e => {
                          const contractTxId = indexBy(prop("id"), dbs)[dbname2]
                            .data.contractTxId
                          const db = new DB({
                            rpc,
                            contractTxId,
                            arweave: network,
                          })
                          setSelectedCol(e.target.value)
                          setProfiles(await db.get(e.target.value))
                          setSelectedData(null)
                        }}
                      >
                        {map(v => <option value={v}>{v}</option>)(cols)}
                      </Select>
                    </Box>
                  </Flex>
                </Box>

                {tab === "query" ? (
                  <>
                    <Flex mb={4}>
                      <Flex
                        px={6}
                        py={1}
                        bg="#9C89F6"
                        color="white"
                        sx={{ borderRadius: "50px" }}
                      >
                        Add Collection
                      </Flex>
                    </Flex>
                    <Box
                      my={4}
                      sx={{ borderRadius: "5px", border: "1px solid #9C89F6" }}
                      p={4}
                      bg="white"
                    >
                      <Flex>
                        <Box mr={4} flex={1}>
                          <Box mb={1}>New Collection Name</Box>
                          <Input
                            value={colName}
                            onChange={e => setColName(e.target.value)}
                          />
                        </Box>
                        <Box mr={4} flex={1}>
                          <Box mb={1}>Data Schema</Box>
                          <Select>
                            <option>Simple Profile</option>
                          </Select>
                        </Box>
                        <Flex align="flex-end">
                          <Flex
                            bg={add_ok ? "#5137C5" : "#999"}
                            color="white"
                            py={2}
                            px={3}
                            w="70px"
                            justify="center"
                            sx={{
                              borderRadius: "5px",
                              ":hover": { opacity: 0.75 },
                              cursor: add_ok ? "pointer" : "default",
                            }}
                            onClick={async () => {
                              if (add_ok) {
                                let err = null
                                let txid = null
                                let txid2 = null
                                try {
                                  const contractTxId = indexBy(prop("id"), dbs)[
                                    dbname2
                                  ].data.contractTxId
                                  const db = new DB({
                                    rpc,
                                    contractTxId,
                                    arweave: network,
                                  })
                                  const start = Date.now()
                                  const rules = [["write", [["allow()"]]]]
                                  const tx2 = await db.setRules(
                                    rules,
                                    colName,
                                    {
                                      ar2: arweaveWallet,
                                    },
                                  )
                                  if (!tx2.success) {
                                    err = "error"
                                  } else {
                                    txid = tx2.originalTxId
                                    const schema = {
                                      type: "object",
                                      required: ["name", "age", "married"],
                                      properties: {
                                        name: { type: "string" },
                                        age: { type: "number" },
                                        married: { type: "boolean" },
                                        favorites: {
                                          type: "array",
                                          items: { type: "string" },
                                        },
                                      },
                                    }
                                    const tx3 = await db.setSchema(
                                      schema,
                                      colName,
                                      { ar2: arweaveWallet },
                                    )
                                    if (tx3.success) {
                                      txid2 = tx3.originalTxId
                                      setCols(await db.listCollections())
                                      setLatency5({
                                        dbname: dbname2,
                                        duration: Date.now() - start,
                                        txid,
                                        txid2,
                                      })
                                      setSelectedCol(colName)
                                      setProfiles([])
                                    } else {
                                      err = tx3.error.toString()
                                    }
                                  }
                                } catch (e) {
                                  err = "error"
                                }
                                if (err) {
                                  toast({
                                    title: "Something Went Wrong!",
                                    status: "error",
                                    description: err,
                                    duration: 5000,
                                    isClosable: true,
                                  })
                                } else {
                                  toast({
                                    title: "Collection Added!",
                                    status: "success",
                                    description: `${colName}`,
                                    duration: 5000,
                                    isClosable: true,
                                  })
                                }
                              }
                            }}
                          >
                            Add
                          </Flex>
                        </Flex>
                      </Flex>
                      <Flex
                        fontSize="12px"
                        mt={4}
                        justify="center"
                        sx={{
                          textDecoration: "underline",
                          cursor: "pointer",
                          ":hover": { opacity: 0.75 },
                        }}
                        onClick={() => setShowCode2(!showCode2)}
                      >
                        {showCode2 ? "Hide JS Code" : "Show JS Code"}
                      </Flex>

                      {!showCode2 ? null : (
                        <Box fontSize="12px" mt={2}>
                          <SyntaxHighlighter
                            language="javascript"
                            style={a11yDark}
                          >
                            {codeDeploy2({ colName })}
                          </SyntaxHighlighter>
                        </Box>
                      )}
                    </Box>
                    <Flex justify="flex-end" align="center" mb={6}>
                      {latency5 ? (
                        <>
                          <Link
                            target="_blank"
                            href={`${process.env.NEXT_PUBLIC_SCAN}/node/${process.env.NEXT_PUBLIC_NODE}/db/${latency5.dbname}/tx/${latency5.txid}`}
                          >
                            <Box
                              sx={{
                                textDecoration: "underline",
                                ":hover": { opacity: 0.75 },
                              }}
                            >
                              Rules
                            </Box>
                          </Link>
                          <Link
                            target="_blank"
                            href={`${process.env.NEXT_PUBLIC_SCAN}/node/${process.env.NEXT_PUBLIC_NODE}/db/${latency5.dbname}/tx/${latency5.txid2}`}
                          >
                            <Box
                              mx={4}
                              sx={{
                                textDecoration: "underline",
                                ":hover": { opacity: 0.75 },
                              }}
                            >
                              Schema
                            </Box>
                          </Link>
                          <Box flex={1} />
                          <Flex>
                            Collection added in{" "}
                            <Box
                              ml={3}
                              fontWeight="bold"
                              bg="white"
                              px={2}
                              sx={{ borderRadius: "5px" }}
                            >
                              {latency5.duration} ms
                            </Box>
                          </Flex>
                        </>
                      ) : null}
                    </Flex>
                    <Flex mb={4}>
                      <Flex
                        px={6}
                        py={1}
                        bg="#9C89F6"
                        color="white"
                        sx={{ borderRadius: "50px" }}
                      >
                        Store Data on WeaveDB
                      </Flex>
                    </Flex>
                    <Box
                      my={4}
                      sx={{ borderRadius: "5px", border: "1px solid #9C89F6" }}
                      p={4}
                      bg="white"
                    >
                      <Flex>
                        <Box>
                          <Flex>
                            <Box mr={4}>
                              <Box mb={1}>Name</Box>
                              <Input
                                value={name}
                                onChange={e => setName(e.target.value)}
                              />
                            </Box>
                            <Box mr={4}>
                              <Box mb={1}>Age</Box>
                              <Select
                                w="100px"
                                value={age}
                                onChange={e => setAge(e.target.value)}
                              >
                                {range(1, 100).map(v => (
                                  <option>{v}</option>
                                ))}
                              </Select>
                            </Box>
                            <Box>
                              <Box mb={1}>Married</Box>
                              <Select
                                w="100px"
                                value={married}
                                onChange={e => setMarried(e.target.value)}
                              >
                                {[true, false].map(v => (
                                  <option value={v}>
                                    {v ? "True" : "False"}
                                  </option>
                                ))}
                              </Select>
                            </Box>
                          </Flex>
                          <Box mt={4}>
                            <Box mb={1}>Favorites</Box>
                            <Flex>
                              {map(v => {
                                return (
                                  <Flex
                                    flex={1}
                                    align="center"
                                    sx={{
                                      cursor: "pointer",
                                      ":hover": { opacity: 0.75 },
                                    }}
                                    onClick={() => {
                                      if (includes(v, favs)) {
                                        setFavs(without([v], favs))
                                      } else {
                                        setFavs(append(v, favs))
                                      }
                                    }}
                                  >
                                    <Box
                                      mr={2}
                                      as="i"
                                      className={
                                        includes(v, favs)
                                          ? "far fa-check-square"
                                          : "far fa-square"
                                      }
                                    />
                                    <Box flex={1}>{v}</Box>
                                  </Flex>
                                )
                              })([
                                "apple",
                                "orange",
                                "grape",
                                "peach",
                                "lemon",
                              ])}
                            </Flex>
                          </Box>
                        </Box>
                      </Flex>
                      <Flex
                        fontSize="12px"
                        mt={4}
                        justify="center"
                        sx={{
                          textDecoration: "underline",
                          cursor: "pointer",
                          ":hover": { opacity: 0.75 },
                        }}
                        onClick={() => setShowCode3(!showCode3)}
                      >
                        {showCode3 ? "Hide JS Code" : "Show JS Code"}
                      </Flex>

                      {!showCode3 ? null : (
                        <Box fontSize="12px" mt={2}>
                          <SyntaxHighlighter
                            language="javascript"
                            style={a11yDark}
                          >
                            {codeDeploy3({
                              name,
                              age,
                              married,
                              favorites: favs,
                              col: selectedCol,
                            })}
                          </SyntaxHighlighter>
                        </Box>
                      )}
                      <Flex
                        mt={4}
                        bg={save_ok ? "#5137C5" : "#999"}
                        color="white"
                        py={2}
                        px={3}
                        justify="center"
                        sx={{
                          borderRadius: "5px",
                          ":hover": { opacity: 0.75 },
                          cursor: save_ok ? "pointer" : "default",
                        }}
                        onClick={async () => {
                          if (save_ok) {
                            const contractTxId = indexBy(prop("id"), dbs)[
                              dbname2
                            ].data.contractTxId
                            const db = new DB({
                              rpc,
                              contractTxId,
                            })
                            const ppl = {
                              name,
                              age: +age,
                              married: married === "true" ? true : false,
                              favorites: favs,
                            }
                            const start = Date.now()
                            const tx3 = await db.set(ppl, selectedCol, name, {
                              ar2: arweaveWallet,
                            })
                            if (tx3.success) {
                              setLatency({
                                dbname: dbname2,
                                duration: Date.now() - start,
                                txid: tx3.originalTxId,
                              })
                              setProfiles(await db.get(selectedCol))
                              let updated = true
                              setTimeout(async () => {
                                do {
                                  updated = await commit({
                                    committing,
                                    dbname2,
                                    dbs,
                                    setCommitting,
                                    _alert: false,
                                  })
                                } while (updated)
                              }, 5000)
                              toast({
                                title: "Doc Added!",
                                status: "success",
                                description: `${name}`,
                                duration: 5000,
                                isClosable: true,
                              })
                              setSelectedData(ppl)
                            } else {
                              toast({
                                title: "Something Went Wrong!",
                                status: "error",
                                description: "error",
                                duration: 5000,
                                isClosable: true,
                              })
                            }
                          }
                        }}
                      >
                        Save
                      </Flex>
                    </Box>
                    <Flex justify="flex-end" align="center" mb={6}>
                      {latency ? (
                        <>
                          <Link
                            target="_blank"
                            href={`${process.env.NEXT_PUBLIC_SCAN}/node/${process.env.NEXT_PUBLIC_NODE}/db/${latency.dbname}/tx/${latency.txid}`}
                          >
                            <Box
                              sx={{
                                textDecoration: "underline",
                                ":hover": { opacity: 0.75 },
                              }}
                            >
                              Doc
                            </Box>
                          </Link>
                          <Box flex={1} />
                          <Flex>
                            Doc stored in{" "}
                            <Box
                              ml={3}
                              fontWeight="bold"
                              bg="white"
                              px={2}
                              sx={{ borderRadius: "5px" }}
                            >
                              {latency.duration} ms
                            </Box>
                          </Flex>
                        </>
                      ) : null}
                    </Flex>
                    <Flex mt={6} mb={4}>
                      <Flex
                        px={6}
                        py={1}
                        bg="#9C89F6"
                        color="white"
                        sx={{ borderRadius: "50px" }}
                      >
                        Query Data
                      </Flex>
                    </Flex>
                    <Box
                      my={4}
                      sx={{ borderRadius: "5px", border: "1px solid #9C89F6" }}
                      p={4}
                      bg="white"
                    >
                      <Select
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      >
                        <option value="single">Single Doc</option>
                        <option value="multi">Multiple Docs</option>
                      </Select>
                      <Flex mt={4}>
                        {search === "single" ? (
                          <Box mr={4}>
                            <Box>Doc ID</Box>
                            <Input
                              value={query}
                              onChange={e => setQuery(e.target.value)}
                            />
                          </Box>
                        ) : (
                          <Box mr={4}>
                            <Flex>
                              <Box flex={1} mr={4}>
                                <Box>Sort</Box>
                                <Select
                                  value={sort}
                                  onChange={e => {
                                    setSort(e.target.value)
                                    setOperator("")
                                    setValue("")
                                  }}
                                >
                                  {map(v => <option value={v}>{v}</option>)([
                                    "name",
                                    "age",
                                    "married",
                                    "favorites",
                                  ])}
                                </Select>
                              </Box>
                              <Box flex={1} mr={4}>
                                <Box>Order</Box>
                                <Select
                                  value={order}
                                  onChange={e => setOrder(e.target.value)}
                                >
                                  {map(v => <option value={v}>{v}</option>)([
                                    "asc",
                                    "desc",
                                  ])}
                                </Select>
                              </Box>
                              <Box flex={1}>
                                <Box>Limit</Box>
                                <Input
                                  value={limit}
                                  onChange={e => {
                                    if (
                                      !Number.isNaN(+e.target.value) &&
                                      Math.round(e.target.value * 1) ===
                                        +e.target.value
                                    ) {
                                      setLimit(e.target.value)
                                    }
                                  }}
                                />
                              </Box>
                            </Flex>
                            <Flex>
                              <Box flex={1} mr={4}>
                                <Box mt={4}>Where</Box>
                                <Select
                                  disabled={true}
                                  value={sort}
                                  onChange={e => setWhere(e.target.value)}
                                >
                                  {map(v => <option value={v}>{v}</option>)([
                                    "name",
                                    "age",
                                    "married",
                                    "favorites",
                                  ])}
                                </Select>
                              </Box>
                              <Box flex={1} mr={4}>
                                <Box mt={4}>Operator</Box>
                                <Select
                                  value={operator}
                                  onChange={e => setOperator(e.target.value)}
                                >
                                  {map(v => <option value={v}>{v}</option>)(
                                    sort === "favorites"
                                      ? [
                                          "",
                                          "array-contains",
                                          "array-contains-any",
                                        ]
                                      : [
                                          "",
                                          "==",
                                          ">",
                                          ">=",
                                          "<",
                                          "<=",
                                          "in",
                                          "not-in",
                                        ],
                                  )}
                                </Select>
                              </Box>
                              <Box flex={1}>
                                <Box mt={4}>
                                  Value
                                  {includes(operator, [
                                    "in",
                                    "not-in",
                                    "array-contains-any",
                                  ])
                                    ? " (csv)"
                                    : ""}
                                </Box>
                                <Input
                                  disabled={includes(operator, [""])}
                                  value={value}
                                  onChange={e => {
                                    setValue(e.target.value)
                                  }}
                                />
                              </Box>
                            </Flex>
                          </Box>
                        )}
                      </Flex>
                      <Flex
                        fontSize="12px"
                        mt={4}
                        justify="center"
                        sx={{
                          textDecoration: "underline",
                          cursor: "pointer",
                          ":hover": { opacity: 0.75 },
                        }}
                        onClick={() => setShowCode4(!showCode4)}
                      >
                        {showCode4 ? "Hide JS Code" : "Show JS Code"}
                      </Flex>

                      {!showCode4 ? null : (
                        <Box fontSize="12px" mt={2}>
                          <SyntaxHighlighter
                            language="javascript"
                            style={a11yDark}
                          >
                            {codeDeploy4({
                              selectedCol,
                              limit,
                              order,
                              query,
                              search,
                              operator,
                              value,
                              sort,
                            })}
                          </SyntaxHighlighter>
                        </Box>
                      )}
                      <Flex justify="center" mt={4}>
                        <Flex
                          h="40px"
                          align="center"
                          flex={1}
                          justify="center"
                          bg={query_ok ? "#5137C5" : "#999"}
                          color="white"
                          py={1}
                          px={3}
                          sx={{
                            borderRadius: "5px",
                            ":hover": { opacity: 0.75 },
                            cursor: query_ok ? "pointer" : "default",
                          }}
                          onClick={async () => {
                            if (query_ok) {
                              setLoading(true)
                              setData(null)
                              const contractTxId = indexBy(prop("id"), dbs)[
                                dbname2
                              ].data.contractTxId
                              const db = new DB({
                                rpc,
                                contractTxId,
                              })
                              const start = Date.now()

                              const q = getQ({
                                order,
                                query,
                                search,
                                selectedCol,
                                limit,
                                operator,
                                value,
                                sort,
                              })
                              const tx3 = await db.get(...q)
                              setData(tx3)
                              if (search === "single") setSelectedData(tx3)
                              setLatency2(Date.now() - start)
                              setWhich("WeaveDB Rollup")
                              setLoading(false)
                            }
                          }}
                        >
                          Query Rollup (fast)
                        </Flex>
                        {search === "multi" ? null : (
                          <Flex
                            h="40px"
                            align="center"
                            ml={4}
                            flex={1}
                            justify="center"
                            bg={query_ok ? "#5137C5" : "#999"}
                            color="white"
                            py={1}
                            px={3}
                            sx={{
                              borderRadius: "5px",
                              ":hover": { opacity: 0.75 },
                              cursor: query_ok ? "pointer" : "default",
                            }}
                            onClick={async () => {
                              setLoading(true)
                              setData(null)
                              const contractTxId = indexBy(prop("id"), dbs)[
                                dbname2
                              ].data.contractTxId
                              const ao = new AO(opt)
                              const start = Date.now()
                              const b = JSON.parse(
                                (
                                  await ao.dry({
                                    pid: contractTxId,
                                    act: "Get",
                                    tags: {
                                      Query: JSON.stringify([
                                        selectedCol,
                                        query,
                                      ]),
                                    },
                                    get: { name: "Result", json: true },
                                  })
                                ).out,
                              )
                              setLatency2(Date.now() - start)
                              setWhich("AO Process")
                              setData(b)
                              setSelectedData(b)
                              setLoading(false)
                            }}
                          >
                            Query AO (slow)
                          </Flex>
                        )}
                      </Flex>
                      <Box mt={4} w="100%" fontSize="14px">
                        {loading ? (
                          "querying..."
                        ) : !data ? (
                          "data not found..."
                        ) : (
                          <Box>
                            <Flex
                              fontSize="14px"
                              px={4}
                              color="white"
                              bg="#9C89F6"
                              sx={{
                                borderRadius: "5px 5px 0 0",
                                borderBottom: "1px solid #9C89F6",
                              }}
                            >
                              <Box w="100px" p={2}>
                                name
                              </Box>
                              <Box w="70px" p={2}>
                                age
                              </Box>
                              <Box w="70px" p={2}>
                                married
                              </Box>
                              <Box flex={1} p={2}>
                                favorites
                              </Box>
                            </Flex>
                            {map(v => {
                              return (
                                <Flex
                                  px={4}
                                  sx={{
                                    borderBottom: "1px solid #9C89F6",
                                  }}
                                >
                                  <Box w="100px" p={2}>
                                    {v.name}
                                  </Box>
                                  <Box w="70px" p={2}>
                                    {v.age}
                                  </Box>
                                  <Box w="70px" p={2}>
                                    {v.married ? "true" : "false"}
                                  </Box>
                                  <Box flex={1} p={2}>
                                    {(v.favorites ?? []).join(", ")}
                                  </Box>
                                </Flex>
                              )
                            })(is(Array, data) ? data : [data])}
                          </Box>
                        )}
                      </Box>
                    </Box>
                    <Flex justify="flex-end" align="center" mb={6}>
                      {latency2 ? (
                        <>
                          <Box
                            as="a"
                            target="_blank"
                            href={`https://ao.link/#/entity/${contractTxId}`}
                            sx={{ textDecoration: "underline" }}
                          >
                            AO Process
                          </Box>
                          <Box flex={1} />
                          <Flex>
                            Queried on {which} in{" "}
                            <Box
                              ml={3}
                              fontWeight="bold"
                              bg="white"
                              px={2}
                              sx={{ borderRadius: "5px" }}
                            >
                              {latency2} ms
                            </Box>
                          </Flex>
                        </>
                      ) : null}
                    </Flex>
                  </>
                ) : (
                  <>
                    <Flex mb={4}>
                      <Flex
                        px={6}
                        py={1}
                        bg="#9C89F6"
                        color="white"
                        sx={{ borderRadius: "50px" }}
                      >
                        Generate ZKP
                      </Flex>
                      <Box flex={1} />
                      Cost:
                      <Box mx={2}>0 tDB</Box>
                    </Flex>
                    {isNil(selectedData) ? (
                      <Box mt={6} px={4}>
                        Select a doc.
                      </Box>
                    ) : (
                      <>
                        <Box
                          sx={{
                            borderRadius: "5px",
                            border: "1px solid #9C89F6",
                          }}
                          p={4}
                          bg="white"
                        >
                          <Flex>
                            <Box>
                              <Box mb={1}>Field</Box>
                              <Select
                                w="120px"
                                value={tar}
                                onChange={e => {
                                  setTar(e.target.value)
                                  if (
                                    includes(e.target.value, [
                                      "name",
                                      "age",
                                      "married",
                                    ])
                                  ) {
                                    if (
                                      includes(qtype, [
                                        "contains",
                                        "contains_any",
                                        "contains_all",
                                        "contains_none",
                                      ])
                                    ) {
                                      setQType("disclosure")
                                    }
                                  } else {
                                    if (
                                      !includes(qtype, [
                                        "contains",
                                        "contains_any",
                                        "contains_all",
                                        "contains_none",
                                      ])
                                    ) {
                                      setQType("contains")
                                    }
                                  }
                                }}
                              >
                                <option value="name">name</option>
                                <option value="age">age</option>
                                <option value="married">married</option>
                                <option value="favorites">favorites</option>
                              </Select>
                            </Box>
                            <Box ml={4}>
                              <Box mb={1}>Query Type</Box>
                              <Select
                                w="200px"
                                value={qtype}
                                onChange={e => setQType(e.target.value)}
                              >
                                {map(v => (
                                  <option value={v.val}>{v.name}</option>
                                ))(ops)}
                              </Select>
                            </Box>
                            <Box flex={1} ml={4}>
                              <Box mb={1}>
                                Value
                                {includes(qtype, [
                                  "in",
                                  "contains_any",
                                  "contains_all",
                                  "contains_none",
                                ])
                                  ? " (csv)"
                                  : ""}
                              </Box>
                              <Input
                                disabled={qtype === "disclosure"}
                                value={qvalue}
                                onChange={e => setQValue(e.target.value)}
                              />
                            </Box>
                          </Flex>
                          <Flex
                            mt={4}
                            bg={zkp_ok ? "#5137C5" : "#999"}
                            justify="center"
                            color="white"
                            py={2}
                            px={3}
                            h="40px"
                            align="center"
                            sx={{
                              borderRadius: "5px",
                              ":hover": { opacity: 0.75 },
                              cursor: zkp_ok ? "pointer" : "default",
                            }}
                            onClick={async () => {
                              let err = null
                              if (zkp_ok && !generating) {
                                setGenerating(true)
                                const contractTxId = indexBy(prop("id"), dbs)[
                                  dbname2
                                ].data.contractTxId
                                const db = new DB({ rpc, contractTxId })
                                const start = Date.now()
                                try {
                                  let _zkp = {
                                    data: selectedData,
                                    col: selectedCol,
                                    db: dbname2,
                                    txid: contractTxId,
                                    tar: tar,
                                    qtype,
                                  }
                                  let params = {
                                    op: "zkp",
                                    key: dbname2,
                                    collection: selectedCol,
                                    doc: selectedData.name,
                                    path: tar,
                                  }
                                  if (
                                    qtype !== "disclosure" &&
                                    !/^\s*$/.test(qvalue)
                                  ) {
                                    params.query = ["$" + qtype]
                                    let qv = null
                                    if (
                                      includes(qtype, [
                                        "in",
                                        "contains_any",
                                        "contains_all",
                                        "contains_none",
                                      ])
                                    ) {
                                      qv = map(v => {
                                        let v2 = trim(v)
                                        if (tar === "age") {
                                          return v2 * 1
                                        } else if (tar === "married") {
                                          return v2 === "false" ? false : true
                                        } else {
                                          return v2
                                        }
                                      })(qvalue.split(","))
                                    } else {
                                      if (tar === "age") {
                                        qv = qvalue * 1
                                      } else if (tar === "married") {
                                        qv = qvalue === "false" ? false : true
                                      } else {
                                        qv = qvalue
                                      }
                                    }
                                    params.query.push(qv)
                                    _zkp.qvalue = qv
                                  }

                                  _zkp.query = params.query
                                  const zkp = await db.node(params)
                                  if (!isNil(zkp.zkp)) {
                                    setLatency3(Date.now() - start)
                                    setZKP({
                                      ..._zkp,
                                      zkp: zkp.zkp,
                                      col_id: zkp.col_id,
                                    })
                                    setData2(null)
                                    toast({
                                      title: "ZKP Generated!",
                                      status: "success",
                                      description: `${params.key} > ${params.collection} > ${params.doc} > ${params.path} (${qtype === "disclosure" ? "Selective Disclosure" : `$${qvalue}`})`,
                                      duration: 5000,
                                      isClosable: true,
                                    })
                                  } else {
                                    console.log(zkp)
                                    err = "error"
                                  }
                                } catch (e) {
                                  console.log(e)
                                  err = e.toString()
                                }
                                setGenerating(false)
                                if (err) {
                                  toast({
                                    title: "Something Went Wrong!",
                                    status: "error",
                                    description: err,
                                    duration: 5000,
                                    isClosable: true,
                                  })
                                }
                              }
                            }}
                          >
                            {generating ? (
                              <Box
                                as="i"
                                className="fas fa-spin fa-circle-notch"
                              />
                            ) : (
                              "Generate ZKP"
                            )}
                          </Flex>
                          {!zkp ? null : (
                            <>
                              <Flex align="center" mt={4}>
                                <Box mb={1}>AO Process TxID</Box>
                                <Box flex={1} />
                                <Box
                                  sx={{
                                    textDecoration: "underline",
                                    cursor: "pointer",
                                    ":hover": { opacity: 0.75 },
                                  }}
                                  onClick={() => {
                                    navigator.clipboard.writeText(processId)
                                  }}
                                >
                                  Copy
                                </Box>
                              </Flex>
                              <Flex
                                px={4}
                                mr={4}
                                fontSize="12px"
                                h="40px"
                                w="100%"
                                align="center"
                                flex={1}
                                sx={{
                                  borderRadius: "5px",
                                  border: "1px solid #9C89F6",
                                }}
                              >
                                {processId}
                              </Flex>
                              <Flex align="center" mt={4}>
                                <Box mb={1}>Data Path</Box>
                                <Box flex={1} />
                                <Box
                                  sx={{
                                    textDecoration: "underline",
                                    cursor: "pointer",
                                    ":hover": { opacity: 0.75 },
                                  }}
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      JSON.stringify(_path).replace(/"/g, ""),
                                    )
                                  }}
                                >
                                  Copy
                                </Box>
                              </Flex>
                              <Flex
                                px={4}
                                mr={4}
                                fontSize="10px"
                                h="40px"
                                w="100%"
                                align="center"
                                flex={1}
                                sx={{
                                  borderRadius: "5px",
                                  border: "1px solid #9C89F6",
                                }}
                              >
                                {JSON.stringify(_path).replace(/"/g, "")}
                              </Flex>
                              <Flex align="center" mt={4}>
                                <Box mb={1}>Zero Knowledge Proof</Box>
                                <Box flex={1} />
                                <Box
                                  sx={{
                                    textDecoration: "underline",
                                    cursor: "pointer",
                                    ":hover": { opacity: 0.75 },
                                  }}
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      JSON.stringify(zkp.zkp).replace(/"/g, ""),
                                    )
                                  }}
                                >
                                  Copy
                                </Box>
                              </Flex>
                              <Flex
                                px={4}
                                mr={4}
                                fontSize="10px"
                                h="180px"
                                w="100%"
                                align="center"
                                flex={1}
                                sx={{
                                  wordBreak: "break-all",
                                  borderRadius: "5px",
                                  border: "1px solid #9C89F6",
                                }}
                              >
                                {JSON.stringify(zkp.zkp).replace(/"/g, "")}
                              </Flex>
                            </>
                          )}
                          <Flex
                            fontSize="12px"
                            mt={4}
                            justify="center"
                            sx={{
                              textDecoration: "underline",
                              cursor: "pointer",
                              ":hover": { opacity: 0.75 },
                            }}
                            onClick={() => setShowCode5(!showCode5)}
                          >
                            {showCode5 ? "Hide JS Code" : "Show JS Code"}
                          </Flex>

                          {!showCode5 ? null : (
                            <Box fontSize="12px" mt={2}>
                              <SyntaxHighlighter
                                language="javascript"
                                style={a11yDark}
                              >
                                {codeDeploy5({
                                  db: dbname2,
                                  col: selectedCol,
                                  doc: query,
                                  tar,
                                })}
                              </SyntaxHighlighter>
                            </Box>
                          )}
                        </Box>
                        <Flex justify="flex-end" align="center" mb={6} mt={4}>
                          {latency3 ? (
                            <>
                              <Box
                                as="a"
                                target="_blank"
                                href={`https://sepolia.etherscan.io/address/${process.env.NEXT_PUBLIC_CONTRACT}#readContract`}
                                sx={{
                                  textDecoration: "underline",
                                  ":hover": { opacity: 0.75 },
                                }}
                              >
                                Copy the ZKP to Etherscan ({" "}
                                {!isNil(zkp.qvalue)
                                  ? "qCond"
                                  : zkp.tar === "name"
                                    ? "qString"
                                    : zkp.tar === "age"
                                      ? "qInt"
                                      : "qBool"}{" "}
                                )
                              </Box>
                              <Box flex={1} />
                              <Flex>
                                ZKP generated in{" "}
                                <Box
                                  ml={3}
                                  fontWeight="bold"
                                  bg="white"
                                  px={2}
                                  sx={{ borderRadius: "5px" }}
                                >
                                  {latency3} ms
                                </Box>
                              </Flex>
                            </>
                          ) : null}
                        </Flex>
                      </>
                    )}
                    <Flex mt={6} mb={4}>
                      <Flex
                        px={6}
                        py={1}
                        bg="#9C89F6"
                        color="white"
                        sx={{ borderRadius: "50px" }}
                      >
                        Query from Ethereum with ZKP
                      </Flex>
                    </Flex>
                    {!zkp ? (
                      <Box mt={6} px={4}>
                        Generate a ZKP.
                      </Box>
                    ) : (
                      <>
                        <Box
                          sx={{
                            borderRadius: "5px",
                            border: "1px solid #9C89F6",
                          }}
                          p={4}
                          bg="white"
                        >
                          <Flex align="center" mb={2} fontSize="12px">
                            <Box
                              mr={2}
                              px={2}
                              bg="#9C89F6"
                              color="white"
                              sx={{ borderRadius: "3px" }}
                            >
                              DB
                            </Box>
                            {zkp.db}
                            <Box
                              mr={2}
                              ml={4}
                              px={2}
                              bg="#9C89F6"
                              color="white"
                              sx={{ borderRadius: "3px" }}
                            >
                              Collection
                            </Box>
                            {zkp.col}
                            <Box
                              mr={2}
                              ml={4}
                              px={2}
                              bg="#9C89F6"
                              color="white"
                              sx={{ borderRadius: "3px" }}
                            >
                              Doc
                            </Box>
                            {zkp.data.name}
                            <Box
                              mr={2}
                              ml={4}
                              px={2}
                              bg="#9C89F6"
                              color="white"
                              sx={{ borderRadius: "3px" }}
                            >
                              Field
                            </Box>
                            {zkp.tar}
                          </Flex>
                          <Flex align="center" mb={4} fontSize="12px">
                            <Box
                              mr={2}
                              px={2}
                              bg="#9C89F6"
                              color="white"
                              sx={{ borderRadius: "3px" }}
                            >
                              Query Type
                            </Box>
                            {zkp.qtype === "disclosure"
                              ? "Selective Disclosure"
                              : "$" + zkp.qtype}{" "}
                            {isNil(zkp.qvalue) ? null : (
                              <>
                                {is(Array, zkp.qvalue)
                                  ? zkp.qvalue.join(", ")
                                  : zkp.qvalue}
                              </>
                            )}
                          </Flex>
                          <Box>
                            <Flex>
                              <Flex
                                px={4}
                                mr={4}
                                align="center"
                                flex={1}
                                sx={{
                                  borderRadius: "5px",
                                  border: "1px solid #9C89F6",
                                }}
                              >
                                {data2 ?? ""}
                              </Flex>
                              <Flex
                                h="40px"
                                w="180px"
                                justify="center"
                                bg={eth_ok ? "#5137C5" : "#999"}
                                color="white"
                                py={2}
                                px={3}
                                align="center"
                                sx={{
                                  borderRadius: "5px",
                                  ":hover": { opacity: 0.75 },
                                  cursor: eth_ok ? "pointer" : "default",
                                }}
                                onClick={async () => {
                                  if (eth_ok && !querying) {
                                    let err = null
                                    setQuerying(true)
                                    try {
                                      const contractTxId = indexBy(
                                        prop("id"),
                                        dbs,
                                      )[zkp.db].data.contractTxId
                                      const db = new DB({ rpc, contractTxId })
                                      const hash = (
                                        await db.node({
                                          op: "hash",
                                          key: zkp.db,
                                        })
                                      ).hash
                                      const contract = new Contract(
                                        process.env.NEXT_PUBLIC_CONTRACT,
                                        abi,
                                        provider,
                                      )
                                      const start = Date.now()
                                      let res = null
                                      if (!isNil(zkp.qvalue)) {
                                        const cond = zkp.zkp.slice(13, 18)
                                        res = (await contract.qCond(
                                          contractTxId,
                                          _path,
                                          cond,
                                          zkp.zkp,
                                        ))
                                          ? "true"
                                          : "false"
                                        setData2(res)
                                      } else if (zkp.tar === "age") {
                                        res = (
                                          await contract.qInt(
                                            contractTxId,
                                            _path,
                                            zkp.zkp,
                                          )
                                        ).toString()
                                        setData2(res)
                                      } else if (zkp.tar === "married") {
                                        res = (await contract.qBool(
                                          contractTxId,
                                          _path,
                                          zkp.zkp,
                                        ))
                                          ? "true"
                                          : "false"
                                        setData2(res)
                                      } else {
                                        res = await contract.qString(
                                          contractTxId,
                                          _path,
                                          zkp.zkp,
                                        )
                                        setData2(res)
                                      }
                                      setLatency6(Date.now() - start)
                                      toast({
                                        title: "Queried from Ethereum!",
                                        status: "success",
                                        description: res,
                                        duration: 5000,
                                        isClosable: true,
                                      })
                                    } catch (e) {
                                      console.log(e)
                                      err = e.toString()
                                    }

                                    setQuerying(false)
                                    if (err) {
                                      if (err.match(/match/)) {
                                        err = "Network Error: Try again"
                                      } else {
                                        err = "Invalid ZKP"
                                      }
                                      toast({
                                        title: "Something Went Wrong!",
                                        status: "error",
                                        description: err,
                                        duration: 5000,
                                        isClosable: true,
                                      })
                                    }
                                  }
                                }}
                              >
                                {querying ? (
                                  <Box
                                    as="i"
                                    className="fas fa-spin fa-circle-notch"
                                  />
                                ) : (
                                  "Query from Ethereum"
                                )}
                              </Flex>
                            </Flex>
                          </Box>
                          <Flex
                            fontSize="12px"
                            mt={4}
                            justify="center"
                            sx={{
                              textDecoration: "underline",
                              cursor: "pointer",
                              ":hover": { opacity: 0.75 },
                            }}
                            onClick={() => setShowCode6(!showCode6)}
                          >
                            {showCode6 ? "Hide JS Code" : "Show JS Code"}
                          </Flex>
                          {!showCode6 ? null : (
                            <Box fontSize="12px" mt={2}>
                              <SyntaxHighlighter
                                language="javascript"
                                style={a11yDark}
                              >
                                {codeDeploy6({
                                  txid: zkp.txid,
                                  path: `[${map(v => `"${v}"`)(_path)}]`,
                                  zkp: "zkp",
                                  fn:
                                    zkp.tar === "name"
                                      ? "qString"
                                      : zkp.tar === "age"
                                        ? "qInt"
                                        : "qBool",
                                })}
                              </SyntaxHighlighter>
                            </Box>
                          )}
                        </Box>
                        <Flex justify="flex-end" align="center" mb={6} mt={4}>
                          <>
                            {committing[zkp?.db] ? (
                              <Flex align="center">
                                <Box
                                  mr={2}
                                  as="i"
                                  className="fas fa-spin fa-circle-notch"
                                />
                                Committing root...
                              </Flex>
                            ) : (
                              <Box
                                sx={{
                                  textDecoration: "underline",
                                  cursor: "pointer",
                                  ":hover": { opacity: 0.75 },
                                }}
                                onClick={async () => {
                                  let updated = true
                                  do {
                                    updated = await commit({
                                      committing,
                                      dbname2: zkp.db,
                                      dbs,
                                      setCommitting,
                                      _alert: false,
                                    })
                                  } while (updated)
                                }}
                              >
                                Commit Root
                              </Box>
                            )}
                            <Box flex={1} />
                            {latency6 ? (
                              <Flex>
                                Queried in{" "}
                                <Box
                                  ml={3}
                                  fontWeight="bold"
                                  bg="white"
                                  px={2}
                                  sx={{ borderRadius: "5px" }}
                                >
                                  {latency6} ms
                                </Box>
                              </Flex>
                            ) : null}
                          </>
                        </Flex>
                      </>
                    )}
                  </>
                )}
              </Box>
              <Box flex={1} ml={4}>
                <Box>
                  <Flex
                    fontSize="14px"
                    px={4}
                    bg="white"
                    sx={{
                      borderRadius: "5px 5px 0 0",
                      borderBottom: "1px solid #9C89F6",
                    }}
                  >
                    <Box w="100px" p={2}>
                      name
                    </Box>
                    <Box w="70px" p={2}>
                      age
                    </Box>
                    <Box w="70px" p={2}>
                      married
                    </Box>
                    <Box flex={1} p={2}>
                      favorites
                    </Box>
                  </Flex>
                  {map(v => {
                    return (
                      <Flex
                        px={4}
                        sx={{
                          borderBottom: "1px solid #9C89F6",
                          cursor: "pointer",
                          ":hover": { opacity: 0.75 },
                        }}
                        bg={selectedData?.name === v.name ? "#9C89F6" : ""}
                        color={selectedData?.name === v.name ? "white" : ""}
                        onClick={() => setSelectedData(v)}
                      >
                        <Box w="100px" p={2}>
                          {v.name}
                        </Box>
                        <Box w="70px" p={2}>
                          {v.age}
                        </Box>
                        <Box w="70px" p={2}>
                          {v.married ? "true" : "false"}
                        </Box>
                        <Box flex={1} p={2}>
                          {(v.favorites ?? []).join(", ")}
                        </Box>
                      </Flex>
                    )
                  })(profiles)}
                </Box>
              </Box>
            </Flex>
          </Box>
        ) : (
          <Box w="100%" maxW="1150px">
            {map(v => {
              return map(v2 => {
                return (
                  <Box p={4}>
                    <Box
                      onClick={() => alert("Coming Soon!")}
                      p={4}
                      color="#9C89F6"
                      sx={{
                        cursor: "pointer",
                        ":hover": { opacity: 0.75 },
                        borderRadius: "5px",
                        border: "#9C89F6 1px solid",
                      }}
                    >
                      <Box fontWeight="bold" fontSize="20px">
                        <Box mr={4} as="i" className="fas fa-plus" />
                        {v2.title}
                      </Box>
                    </Box>
                  </Box>
                )
              })(v)
            })([
              [
                {
                  title: "Decentralized Social Apps",
                },
                {
                  title: "zkOracles",
                },
                {
                  title: "Token / Data Bridges",
                },
              ],
              [
                {
                  title: "zkNFT",
                },
                {
                  title: "DeSci",
                },
                {
                  title: "Blockchain History",
                },
              ],
              [
                {
                  title: "Private Databases",
                },
                {
                  title: "Decentalized Point Systems",
                },
                {
                  title: "AI Autonomous Databases",
                },
              ],
            ])}
          </Box>
        )}
      </Flex>
      {tab === "about" ? (
        <>
          <Flex justify="center">
            <Box w="100%" maxW="1150px" py={20}>
              <Box fontWeight="bold" fontSize="20px" px={4} color="#9C89F6">
                Backers
              </Box>
              <Box
                mb={4}
                fontWeight="bold"
                fontSize="35px"
                px={4}
                color="#3C3C43"
              >
                Supported Worldwide by Industry's Best
              </Box>
              <Flex align="center" wrap="wrap" justify="center">
                {map(v => {
                  return v.name ? (
                    <Link target="_blank" href={v.href ?? "/"}>
                      <Flex
                        sx={{ ":hover": { opacity: 0.75 } }}
                        mx={4}
                        my={2}
                        direction="column"
                        justify="center"
                        align="center"
                      >
                        <Box align="center" fontWeight="bold" fontSize="26px">
                          {v.name}
                        </Box>
                        <Box
                          fontSize="16px"
                          align="center"
                          color={v.color ?? "#034337"}
                        >
                          {v.at}
                        </Box>
                      </Flex>
                    </Link>
                  ) : (
                    <Link target="_blank" href={v.href ?? "/"}>
                      <Image
                        src={v.img}
                        height={v.height ?? "50px"}
                        mx={4}
                        my={2}
                        py={v.py ?? 0}
                        sx={{ ":hover": { opacity: 0.75 } }}
                      />
                    </Link>
                  )
                })([
                  {
                    img: "permanent-ventures.webp",
                    href: "http://permanent.ventures",
                  },
                  { img: "iosg.png", href: "https://iosg.vc" },
                  { img: "mask.svg", href: "https://mask.io" },
                  { img: "forward-research.png", href: "https://fwd.g8way.io" },
                  {
                    img: "hansa.svg",
                    py: 2,
                    href: "https://www.hansa.capital",
                  },
                  {
                    img: "next-web-capital.webp",
                    height: "80px",
                    href: "https://nextweb.capital",
                  },
                  { img: "cmtd.png", py: 2, href: "https://cmt.digital" },
                  {
                    img: "formless-capital.webp",
                    href: "https://formless.capital",
                  },
                  {
                    name: "Scott Moore",
                    at: "Gitcoin Founder",
                    href: "https://www.gitcoin.co",
                  },
                  { img: "cogitent.png", href: "https://cogitent.ventures" },
                  {
                    name: "YY Lai",
                    at: "Signum Capital",
                    color: "#0082B9",
                    href: "https://signum.capital",
                  },
                  { img: "hub71.svg", py: 2, href: "https://hub71.com" },
                ])}
              </Flex>
            </Box>
          </Flex>
          <Flex h="250px" justify="center" bg="#9C89F6">
            <Box w="100%" maxW="1150px" py={20}>
              <Box fontWeight="bold" fontSize="20px" px={4} color="#ddd">
                Ecosystem
              </Box>
              <Box
                color="#5137C5"
                mb={4}
                fontWeight="bold"
                fontSize="35px"
                px={4}
              >
                Who's Building on WeaveDB & zkJSON
              </Box>
            </Box>
          </Flex>
        </>
      ) : null}
      <Footer />
    </>
  )
}