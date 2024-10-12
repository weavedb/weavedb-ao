local ao = require("ao")
local json = require("json")
data = data or {}

Handlers.add(
  "Rollup",
  Handlers.utils.hasMatchingTag('Action', 'Rollup'),
  function(msg)
    local diffs = json.decode(msg.Data)
    for i, v in ipairs(diffs) do
      data[v.collection] = data[v.collection] or {}
      data[v.collection][v.doc] = v.data
    end
    Handlers.utils.reply('committed!')(msg)
  end
)

Handlers.add(
  "Get",
  Handlers.utils.hasMatchingTag('Action', 'Get'),
  function(msg)
    assert(type(msg.Tags.Query) == 'string', 'Query is required!')
    local query = json.decode(msg.Tags.Query)
    local result = json.encode(data[query[1]][query[2]])
    ao.send({ Target = msg.From, Tags = { Result = json.encode(result)} })
  end
)

