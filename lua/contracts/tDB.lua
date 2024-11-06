local json = require("json")
local crypto = require(".crypto");
local bint = require('.bint')(256)

balances = balances or {}

if name ~= "Testnet DB" then
  name = "Testnet DB"
end

if ticker ~= "tDB" then
  ticker = "tDB"
end

if denomination ~= 12 then
  denomination = 12
end

Handlers.add(
  "transfer",
  Handlers.utils.hasMatchingTag("Action", "Transfer"),
  function (msg)
    assert(type(msg.Tags.Recipient) == 'string', 'Recipient is required!')
    assert(type(msg.Tags.Quantity) == 'string', 'Quantity is required!')

    if not balances[msg.From] then
      balances[msg.From] = 0
    end

    if not balances[msg.Tags.Recipient] then
      balances[msg.Tags.Recipient] = 0
    end

    local qty = tonumber(msg.Tags.Quantity)
    assert(type(qty) == 'number', 'qty must be number')
    
    if balances[msg.From] >= qty then
      balances[msg.From] = balances[msg.From] - qty
      balances[msg.Tags.Recipient] = balances[msg.Tags.Recipient] + qty
      ao.send({
	  Target = msg.From,
	  Tags = {
	    Action = "Debit-Notice",
	    Quantity = tostring(qty),
	    Recipient = msg.Tags.Recipient
	  }
      })
      ao.send({
	  Target = msg.Tags.Recipient,
	  Tags = {
	    Action = "Credit-Notice",
	    Quantity = tostring(qty),
	    Sender = msg.From
      }})

    end
  end
)

Handlers.add(
  "balance",
  Handlers.utils.hasMatchingTag("Action", "Balance"),
  function (msg)
    local target = msg.Tags.Target or msg.From
    local bal = "0"
    if balances[target] then
      bal = tostring(balances[target])
    end
    ao.send({Target = msg.From, Tags = {
	       Target = target,
	       Balance = bal,
	       Ticker = ticker or ""
    }})
  end
)

Handlers.add(
  "balances",
  Handlers.utils.hasMatchingTag("Action", "Balances"),
  function (msg)
    ao.send({
	Target = msg.From,
	Data = json.encode(balances)
    })
  end

)

Handlers.add(
  "info",
  Handlers.utils.hasMatchingTag("Action", "Info"),
  function (msg)
    ao.send({Target = msg.From, Tags = {
	       Name = name,
	       Ticker = ticker,
	       Logo = logo,
	       Denomination = tostring(denomination)
    }})
  end
)

Handlers.add(
  'mint',
  Handlers.utils.hasMatchingTag("Action", "Mint"),
  function(msg)
    assert(msg.From == ao.env.Process.Owner, 'Only Owner can execute!')
    assert(type(msg.Quantity) == 'string', 'Quantity is required!')
    assert(bint(0) < bint(msg.Quantity), 'Quantity must be greater than zero!')
    if not balances[msg.From] then balances[msg.From] = 0 end
    if msg.From == ao.env.Process.Owner then
      balances[msg.From] = balances[msg.From] + tonumber(msg.Quantity)
      Handlers.utils.reply('Successfully minted!')(msg)
    else
      Handlers.utils.reply('Mint error!')(msg)
    end
  end
)
