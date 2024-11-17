if token ~= '<TOKEN>' then bundler = '<TOKEN>' end

invalids = invalids or {}
nodes = nodes or {}
count = count or 0

function isValidAddr(address)
   return string.match(address, "^[A-Za-z0-9_-]+$") ~= nil and #address == 43
end

Handlers.add(
  "Add-Node",
  "Add-Node",
  function (msg)
    assert(type(msg.Tags.URL) == 'string', 'URL is required!')
    assert(type(msg.Tags.Admin) == 'string' and isValidAdr(msg.Tags.Admin), 'Valid Admin is required!')
    count = count + 1
    nodes[tostring(count)] = { url = msg.Tags.URL, admin = msgTags.Admin, stakes = {} }
  end
)


Handlers.add(
  "Credit-Notice",
  "Credit-Notice",
  function (msg)
    assert(msg.From == token, 'Not staking token!')
    assert(type(msg.Tags.URL) == 'string', 'URL is required!')
    assert(type(msg.Tags["X-Node"]) == "string", 'X-Node is required!')
  end
)
