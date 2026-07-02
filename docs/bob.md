# bob.jar

Required by: `build_project`, `bundle_project`, `add_native_extension`, `setup_bob`.

- Enforces **OpenJDK 21** at runtime (`index.js:498-500`). Older or newer JDK versions will fail validation.
- Auto-discovered via `DEFOLD_PATH` / `~/defold/bob.jar` / `/usr/local/bin/bob.jar`.
- Falls back to `setup_bob` tool which downloads from GitHub releases.