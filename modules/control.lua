--- In-game HTTP control server for MCP-driven testing.
-- Listens on http://127.0.0.1:38290 and dispatches URL paths to
-- registered handlers. Designed to be polled non-blocking from update().
--
-- Usage in a script attached to a persistent game object:
--   local control = require("modules.control")
--   control.register("start", function() ... end)
--   control.register("menu/show_load", function() ... end)
--   function update(self, dt) control.poll() end
--
-- Routes:
--   GET /start                 -> control.handle("start")
--   GET /menu/show_load        -> control.handle("menu/show_load")
--   GET /_ping                 -> 200 OK (health check)
--   GET /_routes               -> JSON list of registered routes

local M = {}

local HTTP_PORT = 38290
local handlers = {}
local server = nil
local backlog = {}  -- { {client=..., request=...}, ... }

--- Register a handler for a route path (no leading slash).
-- @string route  e.g. "start" or "menu/show_load"
-- @func handler  called with no args; return value is ignored
function M.register(route, handler)
  assert(type(route) == "string", "route must be a string")
  assert(type(handler) == "function", "handler must be a function")
  handlers[route] = handler
end

--- Register many handlers at once from a table.
-- @tab map  { ["start"] = fn, ["menu/show_load"] = fn, ... }
function M.register_all(map)
  for route, handler in pairs(map) do
    M.register(route, handler)
  end
end

local function send_response(client, status, body, content_type)
  content_type = content_type or "text/plain"
  body = body or ""
  local lines = {
    "HTTP/1.1 " .. status,
    "Content-Type: " .. content_type,
    "Content-Length: " .. #body,
    "Connection: close",
    "",
    body,
  }
  local ok = pcall(function()
    client:send(table.concat(lines, "\r\n"))
  end)
  pcall(function() client:close() end)
  return ok
end

local function parse_path(request_line)
  -- "GET /foo/bar HTTP/1.1"
  local path = request_line:match("^%a+%s+(/%S+)")
  if not path then return nil end
  -- strip query string
  path = path:gsub("%?.*$", "")
  -- strip leading slash
  return path:sub(2)
end

local function handle_client(client)
  -- Read request line only; we only support GET with no body.
  local data, err = client:receive("*l")
  if not data or err then
    pcall(function() client:close() end)
    return
  end

  local route = parse_path(data)
  if not route then
    send_response(client, "400 Bad Request", "bad request line")
    return
  end

  -- Drain headers so the connection can close cleanly.
  while true do
    local line, lerr = client:receive("*l")
    if not line or line == "" or lerr then break end
  end

  -- Built-in routes
  if route == "_ping" then
    send_response(client, "200 OK", "pong", "text/plain")
    return
  end
  if route == "_routes" then
    local names = {}
    for k, _ in pairs(handlers) do names[#names + 1] = k end
    table.sort(names)
    -- Minimal JSON encoder.
    local parts = {}
    for _, n in ipairs(names) do
      parts[#parts + 1] = '"' .. n .. '"'
    end
    send_response(client, "200 OK",
      "[" .. table.concat(parts, ",") .. "]", "application/json")
    return
  end

  local handler = handlers[route]
  if not handler then
    send_response(client, "404 Not Found", "unknown route: " .. route)
    return
  end

  local ok, rerr = pcall(handler)
  if ok then
    send_response(client, "200 OK", "ok")
  else
    send_response(client, "500 Internal Server Error", tostring(rerr))
  end
end

--- Start the TCP server. Call once from init().
function M.start(port)
  port = port or HTTP_PORT
  if server then return end
  server = socket.tcp()
  server:setoption("reuseaddr", true)
  server:settimeout(0)  -- non-blocking
  local ok, berr = server:bind("127.0.0.1", port)
  if not ok then
    print("[control] bind failed on port " .. port .. ": " .. tostring(berr))
    server:close()
    server = nil
    return false, berr
  end
  ok, berr = server:listen(16)
  if not ok then
    print("[control] listen failed: " .. tostring(berr))
    server:close()
    server = nil
    return false, berr
  end
  print("[control] listening on http://127.0.0.1:" .. port)
  return true
end

--- Stop the server. Call from final().
function M.stop()
  if server then
    pcall(function() server:close() end)
    server = nil
  end
end

--- Poll the listening socket for new connections. Call from update().
-- Accepts at most a few clients per frame to avoid blocking.
function M.poll()
  if not server then return end
  for _ = 1, 4 do
    local client, aerr = server:accept()
    if not client then
      if aerr ~= "timeout" then
        print("[control] accept error: " .. tostring(aerr))
      end
      break
    end
    client:settimeout(0.5)  -- brief blocking per client, bounded
    handle_client(client)
  end
end

return M