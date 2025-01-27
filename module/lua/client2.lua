local wdb = require("weavedb")
local json = require("json")

local function parse(msg)
  assert(type(msg.Tags.Query) == 'string', 'Query is required!')
  return json.decode(msg.Tags.Query)
end
  
Handlers.add( "Get", "Get" function(msg)
  msg.reply({ Data = wdb.get(parse(msg)) })
end)

Handlers.add( "Cget", "Cget" function(msg)
  msg.reply({ Data = wdb.get(parse(msg)) })
end)

Handlers.add( "Add", "Add" function(msg)
  msg.reply({ Data = wdb.add(parse(msg)) })
end)

Handlers.add( "Set", "Set" function(msg)
  msg.reply({ Data = wdb.set(parse(msg)) })
end)

Handlers.add( "Update", "Update" function(msg)
  msg.reply({ Data = wdb.update(parse(msg)) })
end)

Handlers.add( "Upsert", "Upsert" function(msg)
  msg.reply({ Data = wdb.upsert(parse(msg)) })
end)

Handlers.add( "Delete", "Delete" function(msg)
  msg.reply({ Data = wdb.delete(parse(msg)) })
end)
