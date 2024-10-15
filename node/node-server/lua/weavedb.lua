local ao = require("ao")
local json = require("json")
data = data or {}
if bundler ~= '<BUNDLER>' then bundler = '<BUNDLER>' end

Handlers.add(
  "Set-Bundler",
  Handlers.utils.hasMatchingTag('Action', 'Set-Bundler'),
  function(msg)
    assert(msg.From == ao.env.Process.Owner, "Only owner can execute!");
    assert(type(msg.Tags.Bundler) == "string", "Bundler required!");
    bundler = msg.Tags.Bundler
    Handlers.utils.reply('bundler set!')(msg)
  end
)

Handlers.add(
  "Rollup",
  Handlers.utils.hasMatchingTag('Action', 'Rollup'),
  function(msg)
    assert(msg.From == bundler, "Only bundler can execute!");
    local _data = json.decode(msg.Data)
    for i, v in ipairs(_data.diffs) do
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
    local result = nil
    if #query == 1 then
      local _result = {}
      for k, v in pairs(data[query[1]]) do
	table.insert(_result, v)
      end
      result = json.encode(_result)
    else
      result = json.encode(data[query[1]][query[2]])
    end
    ao.send({ Target = msg.From, Tags = { Result = json.encode(result)} })
  end
)
