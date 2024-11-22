local json = require("json")
local bint = require('.bint')(256)

if aoETH ~= '<TOKEN>' then aoETH = '<TOKEN>' end
if dbToken ~= '<DB>' then dbToken = '<DB>' end

local m = {
  add = function(a, b)
    return tostring(bint(a) + bint(b))
  end,
  sub = function(a, b)
    return tostring(bint(a) - bint(b))
  end,
  mul = function(a, b)
    return tostring(bint(a) * bint(b))
  end,
  div = function(a, b)
    return tostring(bint(a) / bint(b))
  end,
  toBalanceValue = function(a)
    return tostring(bint(a))
  end,
  toNumber = function(a)
    return bint.tonumber(a)
  end,
  floor = function(a)
    return tostring(math.floor(bint.tonumber(a)))
  end,
  ceil = function(a)
    return tostring(math.ceil(bint.tonumber(a)))
  end
}

invalids = invalids or {}
nodes = nodes or {}
count = count or 0
dbs = dbs or {}
profits = profits or {}
Balances = Balances or { [ao.id] = "0" }
minETH = "1"

TotalStake = TotalStake or "0"
TotalDeposit = TotalDeposit or "0"
TotalReward = TotalReward or "0"

function isValidAddr(address)
  return string.match(address, "^[A-Za-z0-9_-]+$") ~= nil and #address == 43
end

Handlers.add(
  "Add-Node",
  "Add-Node",
  function (msg)
    assert(type(msg.URL) == 'string', 'URL is required!')
    count = count + 1
    nodes[tostring(count)] = { url = msg.URL, admin = msg.From, dbs = {} }
    msg.reply({ Data = "node added!" })
  end
)

Handlers.add(
  "Add-DB",
  "Add-DB",
  function (msg)
    assert(type(msg.Node) == 'string' and nodes[msg.Node] ~= nil, 'Valid Node is required!')
    assert(type(msg.Allocations) == 'string', 'Allocations is required!')
    assert(nodes[msg.Node].admin == msg.From, 'Only node admin can execute!')
    assert(type(msg.DB) == 'string', 'DB is required!')
    assert(type(msg.Process) == 'string' and isValidAddr(msg.Process), 'Valid Process is required!')
    assert(bint.__lt(0, bint(msg.Price)), 'Price must be greater than 0')
    assert(bint.__lt(0, bint(msg.Validators)), 'Validators must be greater than 0')
    assert(bint.__lt(0, bint(msg["Min-Stake"])), 'Min-Stake must be greater than 0')
    assert(nodes[msg.Node].dbs[msg.DB] == nil, 'DB already exists!')
    nodes[msg.Node].dbs[msg.DB] = {
      stakes = {},
      delegates = {},
      stake = "0",
      deposit = "0",
      price = msg.Price,
      process = msg.Process
    }
    local allocations = json.decode(msg.Allocations)
    for k, v in pairs(allocations) do
      assert(bint.__lt(0, bint(v)), 'alloc must be greater than 0')
      if k ~= "infra" and k ~= "validators" and k ~= "protocol" and not isValidAddr(k) then
	assert(false, 'invalid allocation address')
      end
    end
    dbs[msg.Process] = {
      allocations = allocations,
      init = false,
      db = msg.DB,
      node = msg.Node,
      height = 0,
      profit = "0",
      min = msg["Min-Stake"],
      blocks = {},
      validators = tonumber(msg.Validators)
    }
    msg.reply({ Data = "db added!" })
  end
)

Handlers.add(
  "Get-Nodes",
  "Get-Nodes",
  function (msg)
    Send({ Target = msg.From, Data = json.encode(nodes) })
  end
)

Handlers.add(
  "Get-DB",
  "Get-DB",
  function (msg)
    assert(type(msg["DB"]) == 'string' and dbs[msg["DB"]] ~= nil, 'Valid DB is required!')
    Send({ Target = msg.From, Data = json.encode(dbs[msg.DB]) })
  end
)

Handlers.add(
  "Stake",
  "Credit-Notice",
  function (msg)
    if msg.From == aoETH then
      if msg["X-Action"] == "Add-Node" then
	assert(type(msg["X-URL"]) == 'string', 'X-URL is required!')
	assert(bint.__le(bint(minETH), bint(msg.Quantity)), 'Deposit not enough!')
	count = count + 1
	nodes[tostring(count)] = { url = msg["X-URL"], admin = msg.Sender, deposit = msg.Quantity, dbs = {} }
	TotalStake = m.add(TotalStake, msg.Quantity)
	msg.reply({ Data = "node added!" })
      else
	assert(type(msg["X-Node"]) == 'string' and nodes[msg["X-Node"]] ~= nil, 'Valid Node is required!')
	local info = nodes[msg["X-Node"]].dbs[msg["X-DB"]]
	assert(type(msg["X-DB"]) == 'string' and info ~= nil, 'Valid DB is required!')
	if msg["X-Action"] == "Delegate" then
	  local to = msg["X-Delegate-To"]
	  assert(type(to) == 'string' and info.delegates[to] ~= nil, 'Valid Delegate-To is required!')
	  info.delegates[to][msg.Sender] = info.delegates[to][msg.Sender] or "0"
	  info.delegates[to][msg.Sender] = m.add(info.delegates[to][msg.Sender], msg.Quantity)
	else
	  info.stakes[msg.Sender] = info.stakes[msg.Sender] or "0"
	  info.delegates[msg.Sender] = info.delegates[msg.Sender] or {}
	  info.stakes[msg.Sender] = m.add(info.stakes[msg.Sender], msg.Quantity)
	end
	info.stake = m.add(info.stake, msg.Quantity)
	TotalStake = m.add(TotalStake, msg.Quantity)
	msg.reply({ Data = "staked!" })
      end
    elseif msg.From == dbToken then
      if type(msg["X-Node"]) == 'string' and nodes[msg["X-Node"]] ~= nil and type(msg["X-DB"]) == 'string' and nodes[msg["X-Node"]].dbs[msg["X-DB"]] ~= nil then
	nodes[msg["X-Node"]].dbs[msg["X-DB"]].deposit = m.add(nodes[msg["X-Node"]].dbs[msg["X-DB"]].deposit, msg.Quantity)
	TotalDeposit = m.add(TotalDeposit, msg.Quantity)
	msg.reply({ Data = "depositted!" })
      else
	TotalReward = m.add(TotalReward, msg.Quantity)
	msg.reply({ Data = "protocol depositted!" })
      end
    end
  end
)

Handlers.add(
  "Withdraw",
  "Withdraw",
  function (msg)
    assert(type(msg["Node"]) == 'string' and nodes[msg["Node"]] ~= nil, 'Valid Node is required!')
    local info = nodes[msg["Node"]].dbs[msg["DB"]]
    assert(type(msg["DB"]) == 'string' and info ~= nil, 'Valid DB is required!')
    assert(type(msg.Quantity) == 'string', 'Quantity is required!')
    local staked = nodes[msg["Node"]].dbs[msg["DB"]].stakes[msg.From] or "0"
    assert(bint.__le(bint(msg.Quantity), bint(staked)), "Staked amount is not enough!")
    info.stakes[msg.From] = m.sub(staked, msg.Quantity)
    Send({
	Target = aoETH,
	Action = "Transfer",
	Recipient = msg.From,
	Quantity = msg.Quantity
    })
    TotalStake = m.sub(TotalStake, msg.Quantity)
    info.stake = m.sub(info.stake, msg.Quantity)
    msg.reply({ Data = "withdrew!" })
  end
)

Handlers.add(
  "Withdraw-DB",
  "Withdraw-DB",
  function (msg)
    assert(bint.__lt(0, bint(Balances[msg.From])), "Balance is zero!")
    local bal = Balances[msg.From]
    Balances[msg.From] = "0"
    Send({
	Target = dbToken,
	Action = "Transfer",
	Recipient = msg.From,
	Quantity = bal
    })
    msg.reply({ Data = "withdrew!" })
  end
)

Handlers.add(
  'info',
  "Info",
  function(msg)
    msg.reply(
      {
	NodeCount = tostring(count),
	MinETH = minETH,
	TotalStake = TotalStake,
	TotalDeposit = TotalDeposit,
	TotalReward = TotalReward,
    })
  end
)

Handlers.add(
  "Rollup",
  "Rollup",
  function (msg)
    local db = dbs[msg.From]
    assert(db ~= nil, 'DB does not exist!')
    assert(type(msg.Hash) == "string", 'Hash is required!')
    assert(type(msg["ZK-Root"]) == "string", 'ZK-Root is required!')
    assert(bint.__lt(0, bint(msg.Block)), 'Block is required!')
    assert(bint.__lt(0, bint(msg.Txs)), 'Txs is required!')
    local info = nodes[db.node].dbs[db.db]
    local price = m.mul(msg.Txs, info.price)
    assert(bint.__le(bint(price), bint(info.deposit)), 'Deposit is not enough!')
    local block = db.blocks[msg.Block]
    assert(block ==  nil, 'Block already exists!')
    info.deposit = m.sub(info.deposit, price)
    db.blocks[msg.Block] = {
      hash = msg.Hash,
      zkroot = msg["ZK-Root"],
      txs = msg.Txs,
      validators = {},
      validated_count = 0,
      finalized = false
    }
    msg.reply({ Data = "rolled up!" })
  end
)

Handlers.add(
  "Validate",
  "Validate",
  function (msg)
    assert(type(msg.DB) == "string", 'DB is required!')
    local db = dbs[msg.DB]
    assert(db ~= nil, 'DB does not exist!')
    assert(tonumber(msg.Block) - 1 == db.height, 'Current Block is required!')
    local block = db.blocks[msg.Block]
    assert(block ~=  nil, 'Block does not exist!')
    assert(block.finalized ==  false, 'Block has been finalized!')
    assert(type(msg.Hash) == "string" and msg.Hash == block.hash, 'Valid Hash is required!')
    assert(type(msg["ZK-Root"]) == "string" and block.zkroot == msg["ZK-Root"],  'Valid ZK-Root is required!')
    assert(bint.__lt(0, bint(msg.Txs)) and msg.Txs == block.txs, 'Valid Txs is required!')
    local info = nodes[db.node].dbs[db.db]
    assert(bint.__le(bint(db.min), bint(info.stakes[msg.From])), 'Min Stake is required!')
    block.validators[msg.From] = true
    block.validated_count = block.validated_count + 1
    if block.validated_count == db.validators then
      local price = m.mul(msg.Txs, info.price)
      block.finalized = true
      db.height = db.height + 1
      db.profit = m.add(db.profit, price)
      local total_alloc = "0"
      for k, v in pairs(db.allocations) do
	total_alloc = m.add(total_alloc, v)
      end
      local total = price
      local validator_total = "0"
      local reward_base = "0"
      for k, v in pairs(db.allocations) do
	local amount = m.floor(m.div(m.mul(price, v), total_alloc))
	if k == "protocol" then
	  total = m.sub(total, amount)
	  Balances[ao.id] = Balances[ao.id] or "0"
	  Balances[ao.id] = m.add(Balances[ao.id], amount)
	elseif k == "validators" then
	  reward_base = amount
	elseif k ~= "infra" then
	  total = m.sub(total, amount)
	  Balances[k] = Balances[k] or "0"
	  Balances[k] = m.add(Balances[k], amount)
	end
	end
      for k, v in pairs(block.validators) do
	validator_total = m.add(validator_total, info.stakes[k])
	for k2, v2 in pairs(info.delegates[k]) do
	  validator_total = m.add(validator_total, v2)
	end
      end
      local admin = nodes[db.node].admin
      Balances[admin] = Balances[admin] or "0"
      for k, v in pairs(block.validators) do
	Balances[k] = Balances[k] or "0"
	local v_reward = m.floor(m.div(m.mul(reward_base, info.stakes[k]), validator_total))
	Balances[k] = m.add(Balances[k], v_reward)
	total = m.sub(total, v_reward)
	for k2, v2 in pairs(info.delegates[k]) do
	  Balances[k2] = Balances[k2] or "0"
	  local v_reward = m.floor(m.div(m.mul(reward_base, v2), validator_total))
	  Balances[k2] = m.add(Balances[k2], v_reward)
	  total = m.sub(total, v_reward)
	end
      end
      Balances[admin] = m.add(Balances[admin], total)
      msg.reply({ Data = "finalized!" })
    end
    msg.reply({	Data = "validated!" })
  end
)

Handlers.add(
  'balance',
  "Balance",
  function(msg)
    local bal = '0'

    if (msg.Tags.Recipient) then
      if (Balances[msg.Tags.Recipient]) then
	bal = Balances[msg.Tags.Recipient]
      end
    elseif msg.Tags.Target and Balances[msg.Tags.Target] then
      bal = Balances[msg.Tags.Target]
    elseif Balances[msg.From] then
      bal = Balances[msg.From]
    end
    msg.reply({
	Balance = bal,
	Ticker = Ticker,
	Account = msg.Tags.Recipient or msg.From,
	Data = bal
    })
  end
)

Handlers.add(
  'balances',
  "Balances",
  function(msg) 
    msg.reply({ Data = json.encode(Balances) })
  end
)

Handlers.add(
  'Init-DB',
  "Init-DB",
  function(msg)
    assert(type(msg["Node"]) == 'string' and nodes[msg["Node"]] ~= nil, 'Valid Node is required!')
    local db = dbs[msg.From]
    assert(db ~= nil, 'DB does not exist!')
    assert(db.node == msg["Node"], 'The wrong node!')
    assert(db.init == false, "Already initialized!")
    db.init = true
    msg.reply({ Data = "initialized!" })
  end
)
