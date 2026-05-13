# agents-playground

A TypeScript AI agent console with weather monitoring and a calculator agent, featuring a terminal-style web UI.

## Agents

**Calculator** — tool-calling loop that solves math problems, supports Anthropic and OpenAI providers.

**Weather** — fetches current conditions from wttr.in for any city and logs results to `weather.txt`. Runs on a configurable schedule.

## Structure

```
src/
  agents/       # agent loops (calculator, weather)
  tools/        # tool implementations + schemas
  prompts/      # prompt templates
  utils/        # shared clients, scheduler
public/
  index.html    # markup
  styles.css    # terminal theme (black/green, CSS variables)
  app.js        # UI logic (weather, calculator, autocomplete)
```

## Usage

```bash
# Calculator agent
npm start                                    # Anthropic, default question
npm start -- --provider openai "What is 99 * 12?"

# Weather agent (runs hourly)
npm run weather

# Web console
npm run server   # → http://localhost:3000

# Tests
npm test
```

## Setup

Copy `.env.example` and fill in your keys:

```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```
