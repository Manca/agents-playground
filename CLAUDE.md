# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm test                        # run all tests (vitest)
npm test -- --reporter=verbose  # run tests with per-test output
npx vitest run src/tools/calculator.test.ts  # run a single test file
npm run server                  # start Express server → http://localhost:3000
npm run stop                    # stop the server
npm run calculator              # run calculator agent CLI (Anthropic, default question)
npm run calculator -- --provider openai "What is 99 * 12?"
npm run weather                 # run weather agent once then schedule hourly
```

There is no build step for running — `tsx` executes TypeScript directly. `tsconfig.json` targets `dist/` but compilation is not part of any workflow.

## Architecture

The project is a TypeScript ESM package (`"type": "module"`, NodeNext resolution). All imports within `src/` must use `.js` extensions even though the source files are `.ts`.

**Agent pattern** — both agents use a `while (true)` tool-calling loop: send messages, check for tool calls in the response, execute them locally, push results back, repeat until the model returns with no tool calls (OpenAI) or `stop_reason === 'end_turn'` (Anthropic).

**Layer structure:**
- `src/tools/` — pure functions (`calculate`, `getWeather`, `appendWeather`) plus the OpenAI/Anthropic tool schemas that wrap them. Tool logic and schema definitions live together per tool.
- `src/agents/` — orchestration loops only; they import tools and call the AI SDK. `calculator.ts` supports both providers; `weather.ts` uses OpenAI only.
- `src/prompts/` — prompt templates as exported functions.
- `src/utils/clients.ts` — singleton Anthropic and OpenAI clients (reads from env).
- `src/utils/scheduler.ts` — thin wrapper around `node-cron`.
- `src/server.ts` — Express 5 server; serves `public/` statically and exposes two POST endpoints (`/api/weather/check`, `/api/calculator`) plus `GET /api/weather/history`.
- `calculator-agent.ts` / `weather-agent.ts` — CLI entrypoints at the repo root.

**Models in use:** calculator agent uses `claude-haiku-4-5-20251001` (Anthropic) and `gpt-4o-mini` (OpenAI); weather agent uses `gpt-4o-mini`.

**Weather data** is fetched from `wttr.in/?format=j1` (no API key). Results are appended as timestamped lines to `weather.txt` (gitignored).

**Frontend** (`public/`) is vanilla JS/CSS — no framework, no build step. `app.js` polls `/api/weather/history` every 15 s. City autocomplete uses the Photon API (`photon.komoot.io`) with a 300 ms debounce.

## Tests

Tests live alongside source in `src/**/*.test.ts` and run with Vitest. The `fs` module is mocked in `weather.test.ts` — `appendFileSync` is a no-op spy so tests never write to disk. `server.test.ts` uses `supertest` against the live Express app.
