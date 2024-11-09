import { Image, Flex, Box } from "@chakra-ui/react"
import { Link } from "arnext"
import { useEffect, useState } from "react"
const { AO } = require("aonote")
import { opt } from "@/lib/utils"

export default function Header({
  addr,
  toast,
  setBalance,
  setDeposit,
  setAddr,
}) {
  const [connecting, setConnecting] = useState(false)
  return (
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
            if (!connecting) {
              let err = null
              if (addr) {
                if (confirm("Disconnect your wallet?")) {
                  setAddr(null)
                  toast({
                    title: "Wallet Disconnected!",
                    status: "success",
                    duration: 5000,
                    isClosable: true,
                  })
                }
              } else {
                setConnecting(true)

                try {
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
                  toast({
                    title: "Wallet Connected!",
                    status: "success",
                    description: addr,
                    duration: 5000,
                    isClosable: true,
                  })
                } catch (e) {
                  err = e.toString()
                }
              }
              setConnecting(false)
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
          {connecting ? (
            <Box as="i" className="fas fa-spin fa-circle-notch" />
          ) : addr ? (
            addr.slice(0, 10)
          ) : (
            "Connect Wallet"
          )}
        </Flex>
      </Flex>
    </Flex>
  )
}
