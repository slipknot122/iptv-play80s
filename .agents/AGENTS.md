# Workflow Rules
- **NEVER ASK THE USER TO BUILD OR RUN COMMANDS MANUALLY.** The user explicitly stated: "ят в консолі нечого запускать не буду перезбирай кожен раз сам і запамятай це".
- Every time you introduce a new feature or fix a bug, you **MUST automatically run `npm run build` or `npm run tauri build`** using the `run_command` tool, verify it works, and inform the user when the build is ready. DO NOT tell the user to run it themselves.
