# Tool handlers status

The `callTool()` switch (line 384 in `index.js`) routes to handlers, but most handlers beyond line 651 are not implemented. Only `launchDefold`, `runProject`, `createProject`, `listProjects`, and `getProjectSettings` have real bodies.

## Implemented

- `launch_defold`
- `run_project`
- `create_project`
- `list_projects`
- `get_project_settings`

## Unimplemented (stubs)

- `update_project_settings`
- `create_script`
- `edit_script`
- `create_lua_module`
- `create_collection`
- `add_game_object`
- `add_component`
- `create_sprite`
- `create_tilemap`
- `create_particlefx`
- `create_sound`
- `create_camera`
- `create_factory`
- `create_gui`
- `setup_physics`
- `configure_render`
- `setup_bob`
- `build_project`
- `bundle_project`
- `debug_logs`
- `stream_logs`
- `enable_hot_reload`
- `add_native_extension`
- `get_project_analytics`