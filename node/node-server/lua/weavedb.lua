local json = require("json")
data = data or {}
if bundler ~= '<BUNDLER>' then bundler = '<BUNDLER>' end

local function err(message)
  error(message)
end

local function is_nil(v) return v == nil end
local function is_number(v) return type(v) == "number" end
local function is_string(v) return type(v) == "string" end
local function is_table(v) return type(v) == "table" end

local function includes(item, list)
  if type(list) ~= "table" then return false end
  for _, v in ipairs(list) do if v == item then return true end end
  return false
end

local function clone(t)
  if type(t) ~= "table" then return t end
  local result = {}
  for k, v in pairs(t) do result[k] = type(v) == "table" and clone(v) or v end
  return result
end

local function split_when(pred, query)
  local path = {}
  local opt = {}
  local split_index = nil
  for i, v in ipairs(query) do
    if not is_string(v) and not split_index then split_index = i break end
  end
  if split_index then
    for i = 1, split_index - 1 do table.insert(path, query[i]) end
    for i = split_index, #query do table.insert(opt, query[i]) end
  else
    path = query
  end
  return path, opt
end

local function _parser(query)
  local path, opt = split_when(function(v) return not is_string(v) end, query)
  if is_nil(path) or #path == 0 then return nil end
  if not is_table(opt) then return nil end
  
  local q = { path = path }
  local _filter = { ["=="] = {} }
  local _keys = {}
  local _ranges = {}
  local _range_field = nil
  local _sort = nil
  local _startAt = nil
  local _startAfter = nil
  local _endAt = nil
  local _endBefore = nil
  local _startAtCursor = nil
  local _startAfterCursor = nil
  local _endAtCursor = nil
  local _endBeforeCursor = nil

  for _, v in ipairs(clone(opt)) do
    if is_number(v) then
      if is_nil(q.limit) then
        if v > 1000 then return nil end
        if v ~= math.floor(math.abs(v)) or v < 1 then return nil end
        q.limit = v
      else
        return nil
      end
    elseif not is_table(v) then
      return nil
    else
      if #v == 0 then
        return nil
      elseif v[1] == "startAt" then
        if not is_nil(_startAt) or not is_nil(_startAfter) or
           not is_nil(_startAtCursor) or not is_nil(_startAfterCursor) then
          return nil
        elseif #v <= 1 then
          return nil
        else
          if type(v[2]) == "table" and v[2].__cursor__ then
            _startAtCursor = v
            _startAtCursor[2].data.__id__ = _startAtCursor[2].id
          else
            _startAt = v
          end
        end
      elseif v[1] == "startAfter" then
        if not is_nil(_startAt) or not is_nil(_startAfter) or
           not is_nil(_startAtCursor) or not is_nil(_startAfterCursor) then
          return nil
        elseif #v <= 1 then
          return nil
        else
          if type(v[2]) == "table" and v[2].__cursor__ then
            _startAfterCursor = v
            _startAfterCursor[2].data.__id__ = _startAfterCursor[2].id
          else
            _startAfter = v
          end
        end
      elseif v[1] == "endAt" then
        if not is_nil(_endAt) or not is_nil(_endBefore) or
           not is_nil(_endAtCursor) or not is_nil(_endBeforeCursor) then
          return nil
        elseif #v <= 1 then
          return nil
        else
          if type(v[2]) == "table" and v[2].__cursor__ then
            _endAtCursor = v
            _endAtCursor[2].data.__id__ = _endAtCursor[2].id
          else
            _endAt = v
          end
        end
      elseif v[1] == "endBefore" then
        if not is_nil(_endAt) or not is_nil(_endBefore) or
           not is_nil(_endAtCursor) or not is_nil(_endBeforeCursor) then
          return nil
        elseif #v <= 1 then
          return nil
        else
          if type(v[2]) == "table" and v[2].__cursor__ then
            _endBeforeCursor = v
            _endBeforeCursor[2].data.__id__ = _endBeforeCursor[2].id
          else
            _endBefore = v
          end
        end
      elseif #v == 3 then
        if includes(v[2], {
          "==", "!=", ">", "<", ">=", "<=",
          "in", "not-in", "array-contains", "array-contains-any"
        }) then
          if includes(v[2], {"array-contains", "array-contains-any"}) then
            if not is_nil(_filter["array-contains"]) or
               not is_nil(_filter["array-contains-any"]) then
              return nil
            end
            if v[2] == "array-contains-any" and not is_table(v[3]) then
              return nil
            end
            _filter[v[2]] = v
          elseif includes(v[2], {"!=", "in", "not-in", ">", ">=", "<", "<="}) then
            if includes(v[2], {"in", "not-in"}) and not is_table(v[3]) then
              return nil
            end
            if includes(v[2], {">", ">=", "<", "<="}) then
              if not is_nil(_filter["!="]) or not is_nil(_filter["in"]) or
                 not is_nil(_filter["not-in"]) then
                return nil
              end
              if not is_nil(_range_field) and _range_field ~= v[1] then
                return nil
              elseif _ranges[v[2]] or
                     (v[2] == ">" and _ranges[">="])  or
                     (v[2] == ">=" and _ranges[">"])  or
                     (v[2] == "<" and _ranges["<="]) or
                     (v[2] == "<=" and _ranges["<"]) then
                return nil
              else
                _filter.range = _filter.range or {}
                table.insert(_filter.range, v)
                _range_field = v[1]
                _ranges[v[2]] = true
              end
            else
              if not is_nil(_filter.range) or not is_nil(_filter["!="]) or
                 not is_nil(_filter["in"]) or not is_nil(_filter["not-in"]) then
                return nil
              end
              _filter[v[2]] = v
            end
          elseif v[2] == "==" then
            if not is_nil(_filter.range) or not is_nil(_filter["!="]) or
               not is_nil(_filter["in"]) or not is_nil(_filter["not-in"]) then
              return nil
            elseif _keys[v[1]] then 
              return nil 
            end
            table.insert(_filter["=="], v)
            _keys[v[1]] = true
          else
            if not is_nil(_filter[v[2]]) then return nil end
            _filter[v[2]] = v
          end
        else
          return nil
        end
      elseif #v == 2 then
        if includes(v[2], {"asc", "desc"}) then
          if is_nil(_sort) then
            _sort = {v}
          else
            table.insert(_sort, v)
          end
        else
          return nil
        end
      elseif #v == 1 then
        if is_nil(_sort) then
          _sort = {{v[1], "asc"}}
        else
          table.insert(_sort, {v[1], "asc"})
        end
      else
        return nil
      end
    end
  end

  q.limit = q.limit or 1000
  q.start = _startAt or _startAfter or nil
  q.end_ = _endAt or _endBefore or nil
  q.startCursor = _startAtCursor or _startAfterCursor or nil
  q.endCursor = _endAtCursor or _endBeforeCursor or nil
  q.sort = _sort or {}
  q.reverse = { start = false, end_ = false }
  q.array = _filter["array-contains"] or _filter["array-contains-any"] or nil
  q.equals = _filter["=="]
  
  if _filter.range then
    q.range = _filter.range
  elseif not is_nil(_filter["in"]) then
    q.range = {_filter["in"]}
  elseif not is_nil(_filter["not-in"]) then
    q.range = {_filter["not-in"]}
  elseif not is_nil(_filter["!="]) then
    q.range = {_filter["!="]}
  else
    q.range = nil
  end

  q.sortByTail = false
  return q
end



local function get_table_keys(t)
  local keys = {}
  for k in pairs(t) do table.insert(keys, k) end
  return keys
end

local function sort_docs(docs, sort_specs)
  if #sort_specs == 0 then
    sort_specs = {{"__id__", "asc"}}
  end
  table.sort(
    docs,
    function(a, b)
      for _, spec in ipairs(sort_specs) do
	local field, direction = spec[1], spec[2]
	local aVal = field == "__id__" and a.__id__ or a[field]
	local bVal = field == "__id__" and b.__id__ or b[field]
	
	if aVal ~= bVal then
	  if direction == "asc" then
	    return aVal < bVal
	  else
	    return aVal > bVal
	  end
	end
      end
      return false
    end
  )
  return docs
end

local function matches_filters(doc, filters)
  local id = doc.__id__
  
  -- Handle equals
  for _, filter in ipairs(filters.equals or {}) do
    local field, _, value = table.unpack(filter)
    if doc[field] ~= value then return false end
  end
  
  -- Handle array operations
  if filters.array then
    local field, op, value = table.unpack(filters.array)
    if op == "array-contains" then
      if not doc[field] or type(doc[field]) ~= "table" then return false end
      local found = false
      for _, v in ipairs(doc[field]) do
        if v == value then found = true; break end
      end
      if not found then return false end
    elseif op == "array-contains-any" then
      if not doc[field] or type(doc[field]) ~= "table" then return false end
      local found = false
      for _, target in ipairs(value) do
        for _, v in ipairs(doc[field]) do
          if v == target then found = true; break end
        end
        if found then break end
      end
      if not found then return false end
    end
  end
  
  -- Handle range operations
  if filters.range then
    for _, range in ipairs(filters.range) do
      local field, op, value = table.unpack(range)
      local doc_val = doc[field]
      
      if op == ">" and not (doc_val > value) then return false end
      if op == ">=" and not (doc_val >= value) then return false end
      if op == "<" and not (doc_val < value) then return false end
      if op == "<=" and not (doc_val <= value) then return false end
      if op == "!=" and doc_val == value then return false end
      if op == "in" then
        local found = false
        for _, v in ipairs(value) do
          if doc_val == v then found = true; break end
        end
        if not found then return false end
      end
      if op == "not-in" then
        for _, v in ipairs(value) do
          if doc_val == v then return false end
        end
      end
    end
  end
  
  return true
end

local function apply_cursor(docs, cursor, is_start)
  if not cursor then return docs end

  local op, value = cursor[1], cursor[2]
  local comparison = nil
  
  if op == "startAt" then
    comparison = function(doc) return doc >= value end
  elseif op == "startAfter" then
    comparison = function(doc) return doc > value end
  elseif op == "endAt" then
    comparison = function(doc) return doc <= value end
  elseif op == "endBefore" then
    comparison = function(doc) return doc < value end
  end

  local result = {}
  for i, doc in ipairs(docs) do
    if comparison(is_start and doc or value) then
      table.insert(result, doc)
    end
  end
  
  return result
end


local function query_data(query)
  local docs = {}
  local collection = data[query.path[1]]
  local docs = {}
  for id, doc in pairs(collection) do
    local doc2 = doc
    doc2.__id__ = id    
    table.insert(docs, doc2)
  end
  
    -- Apply filters
  local filtered_docs = {}
  for _, doc in ipairs(docs) do
    if matches_filters(doc, query) then
      table.insert(filtered_docs, doc)
    end
  end
  
  -- Sort
  local sorted_docs = sort_docs(filtered_docs, query.sort)

    -- Apply cursors
  local cursored_docs = apply_cursor(sorted_docs, query.start, true)
  cursored_docs = apply_cursor(cursored_docs, query.end_, false)

  -- Apply limit
  if query.limit and #cursored_docs > query.limit then
    local limited = {}
    for i = 1, query.limit do
      table.insert(limited, cursored_docs[i])
    end
    cursored_docs = limited
  end
  
  -- Remove injected IDs
  for _, doc in ipairs(cursored_docs) do
    doc.__id__ = nil
  end
  
  return cursored_docs
end

Handlers.add(
  "Set-Bundler",
  "Set-Bundler",
  function(msg)
    assert(msg.From == ao.env.Process.Owner, "Only owner can execute!");
    assert(type(msg.Tags.Bundler) == "string", "Bundler required!");
    bundler = msg.Tags.Bundler
    msg.reply({ Data = 'bundler set!' })
  end
)

Handlers.add(
  "Rollup",
  "Rollup",
  function(msg)
    assert(msg.From == bundler, "Only bundler can execute!");
    local _data = json.decode(msg.Data)
    for i, v in ipairs(_data.diffs) do
      data[v.collection] = data[v.collection] or {}
      if v.op == "set" then
	data[v.collection][v.doc] = v.data
      elseif v.op == "delete" then
	data[v.collection][v.doc] = nil
      elseif v.op == "update" then
	data[v.collection][v.doc] = data[v.collection][v.doc] or {}
	for key, val in pairs(v.data) do
	  data[v.collection][v.doc][key] = val
	end
      end
    end
    msg.reply({ Data = 'committed!'})
  end
)


Handlers.add(
  "Get",
  "Get",
  function(msg)
    assert(type(msg.Tags.Query) == 'string', 'Query is required!')
    local query = json.decode(msg.Tags.Query)
    local q = _parser(query)
    local result = nil
    if #q.path == 1 then
      local __result = query_data(q)
      result = __result
    else
      result = data[query[1]][query[2]]
    end
    msg.reply({ Data = json.encode(result) })
  end
)

Handlers.add(
  "Parse",
  "Parse",
  function(msg)
    assert(type(msg.Tags.Query) == 'string', 'Query is required!')
    local query = json.decode(msg.Tags.Query)
    local q = _parser(query)
    msg.reply({ Data = json.encode(q) })
  end
)
