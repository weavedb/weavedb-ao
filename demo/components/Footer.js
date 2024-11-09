import { Image, Flex, Box } from "@chakra-ui/react"
import { Link } from "arnext"

export default function Footer({ setTab }) {
  return (
    <Flex justify="center">
      <Box w="100%" maxW="1150px" p={10}>
        <Flex align="center" color="#5137C5">
          <Box
            alignItems="center"
            display={["none", null, "flex"]}
            target="_blank"
            sx={{ ":hover": { opacity: 0.75 } }}
            as="a"
            href="https://github.com/weavedb"
          >
            <Flex align="center">
              <Image mr={2} src="/logo.svg" boxSize="25px" />
              <Box fontSize="18px">WeaveDB</Box>
            </Flex>
          </Box>
          <Box flex={1} />
          <Flex align="center" wrap="wrap">
            <Box ml={6}>Blog</Box>
            <Box ml={6}>Docs</Box>
            <Link href="https://scan.weavedb.dev" target="_blank">
              <Box ml={6}>Scan</Box>
            </Link>
            <Link
              href={`https://ao.link/#/token/${process.env.NEXT_PUBLIC_TDB}`}
              target="_blank"
            >
              <Box ml={6}>tDB Token</Box>
            </Link>
            <Box ml={6}>Web Console</Box>
          </Flex>
        </Flex>
        <Box w="100%" sx={{ borderBottom: "1px #9C89F6 solid" }} my={6} />
        <Flex justify="flex-end" align="center">
          <Link
            target="_blank"
            href="https://github.com/weavedb"
            sx={{ ":hover": { opacity: 0.75 } }}
          >
            <Box
              ml={4}
              as="i"
              className="fab fa-github"
              color="#5137C5"
              fontSize="24px"
            />
          </Link>
          <Link
            target="_blank"
            href="https://x.com/weave_db"
            sx={{ ":hover": { opacity: 0.75 } }}
          >
            <Box
              ml={4}
              as="i"
              className="fab fa-twitter"
              color="#5137C5"
              fontSize="24px"
            />
          </Link>
          <Link
            target="_blank"
            href="https://discord.com/invite/jhKjsK3Jq5"
            sx={{ ":hover": { opacity: 0.75 } }}
          >
            <Box
              ml={4}
              as="i"
              className="fab fa-discord"
              color="#5137C5"
              fontSize="24px"
            />
          </Link>
        </Flex>
      </Box>
    </Flex>
  )
}
