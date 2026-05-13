import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { runWeatherAgent } from './agents/weather.js';
import { runCalculatorAgent, type Provider } from './agents/calculator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEATHER_FILE = join(__dirname, '../weather.txt');
const PUBLIC_DIR = join(__dirname, '../public');

const app = express();
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.get('/api/weather/history', (_req, res) => {
  if (!existsSync(WEATHER_FILE)) return res.json({ lines: [] });
  const lines = readFileSync(WEATHER_FILE, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .reverse();
  res.json({ lines });
});

app.post('/api/weather/check', async (req, res) => {
  const { city = 'Burlingame, CA' } = req.body as { city?: string };
  try {
    await runWeatherAgent(city);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

app.post('/api/calculator', async (req, res) => {
  const { question, provider = 'openai' } = req.body as { question: string; provider: Provider };
  if (!question?.trim()) return res.status(400).json({ error: 'question is required' });
  try {
    const answer = await runCalculatorAgent(question, provider);
    res.json({ answer });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Agent console → http://localhost:${PORT}`));
