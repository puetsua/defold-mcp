--- Example: wire the in-game control server to menu buttons.
-- Drop into your main menu controller script and require it from init(),
-- or copy the register_all block directly into your own menu script.
--
-- Button -> action mapping (matcha-novel example):
--   Start    -> matchanovel.start()
--   Load     -> matchanovel.post("menu", "show_load")
--   Settings -> matchanovel.post("menu", "show_settings")
--   Quit     -> matchanovel.exit()
--
-- The MCP `game_click` tool then triggers these by hitting
-- http://127.0.0.1:38290/<route> without stealing the user's mouse.

local control = require("modules.control")

local M = {}

function M.init()
  -- Replace these handlers with your own game's calls. The routes below
  -- match the matcha-novel main menu buttons.
  control.register_all({
    ["start"] = function()
      local matchanovel = require("matchanovel.matchanovel")
      matchanovel.start()
    end,
    ["menu/show_load"] = function()
      local matchanovel = require("matchanovel.matchanovel")
      matchanovel.post("menu", "show_load")
    end,
    ["menu/show_settings"] = function()
      local matchanovel = require("matchanovel.matchanovel")
      matchanovel.post("menu", "show_settings")
    end,
    ["quit"] = function()
      local matchanovel = require("matchanovel.matchanovel")
      matchanovel.exit()
    end,
  })
  control.start()
end

function M.update()
  control.poll()
end

function M.final()
  control.stop()
end

return M