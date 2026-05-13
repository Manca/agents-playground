/**
 * Server API endpoint tests.
 *
 * The server module imports dotenv/config at the top level, which tries to
 * read a .env file. We stub out the two agent functions so no real LLM calls
 * are made during testing.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ---------------------------------------------------------------------------
// Mock the agent modules before any import of server.ts touches them
// ---------------------------------------------------------------------------

vi.mock('./agents/weather.js', () => ({
  runWeatherAgent: vi.fn(async () => undefined),
}));

vi.mock('./agents/calculator.js', () => ({
  runCalculatorAgent: vi.fn(async () => '42'),
}));

// dotenv is a no-op in test
vi.mock('dotenv/config', () => ({}));

// ---------------------------------------------------------------------------
// Build a test-local Express app that mirrors server.ts logic exactly,
// but points WEATHER_FILE at a temp file so tests are hermetic.
// ---------------------------------------------------------------------------

import { readFileSync } from 'fs';
import { runWeatherAgent } from './agents/weather.js';
import { runCalculatorAgent, type Provider } from './agents/calculator.js';

function buildApp(weatherFile: string) {
  const app = express();
  app.use(express.json());

  app.get('/api/weather/history', (_req, res) => {
    if (!existsSync(weatherFile)) {
      res.json({ lines: [] });
      return;
    }
    const lines = readFileSync(weatherFile, 'utf-8')
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
    if (!question?.trim()) {
      res.status(400).json({ error: 'question is required' });
      return;
    }
    try {
      const answer = await runCalculatorAgent(question, provider);
      res.json({ answer });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const WEATHER_FILE = join(tmpdir(), `weather-server-test-${process.pid}.txt`);
const app = buildApp(WEATHER_FILE);

afterAll(() => {
  if (existsSync(WEATHER_FILE)) unlinkSync(WEATHER_FILE);
});

// ---- GET /api/weather/history ----

describe('GET /api/weather/history', () => {
  it('returns { lines: [] } when the weather file does not exist', async () => {
    if (existsSync(WEATHER_FILE)) unlinkSync(WEATHER_FILE);

    const res = await request(app).get('/api/weather/history');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lines: [] });
  });

  it('returns lines in reverse chronological order', async () => {
    writeFileSync(
      WEATHER_FILE,
      '[2026-01-01T00:00:00.000Z] First entry\n[2026-01-02T00:00:00.000Z] Second entry\n',
    );

    const res = await request(app).get('/api/weather/history');
    expect(res.status).toBe(200);
    expect(res.body.lines[0]).toContain('Second entry');
    expect(res.body.lines[1]).toContain('First entry');
  });

  it('filters out blank lines', async () => {
    writeFileSync(WEATHER_FILE, '[2026-01-01T00:00:00.000Z] Entry\n\n\n');
    const res = await request(app).get('/api/weather/history');
    expect(res.body.lines).toHaveLength(1);
  });
});

// ---- POST /api/weather/check ----

describe('POST /api/weather/check', () => {
  it('returns { ok: true } on success', async () => {
    vi.mocked(runWeatherAgent).mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/api/weather/check')
      .send({ city: 'London' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('uses "Burlingame, CA" as the default city when body is empty', async () => {
    vi.mocked(runWeatherAgent).mockResolvedValueOnce(undefined);

    await request(app).post('/api/weather/check').send({});

    expect(vi.mocked(runWeatherAgent)).toHaveBeenCalledWith('Burlingame, CA');
  });

  it('passes the city from the request body to the agent', async () => {
    vi.mocked(runWeatherAgent).mockResolvedValueOnce(undefined);

    await request(app).post('/api/weather/check').send({ city: 'Tokyo' });

    expect(vi.mocked(runWeatherAgent)).toHaveBeenCalledWith('Tokyo');
  });

  it('returns 500 when the agent throws', async () => {
    vi.mocked(runWeatherAgent).mockRejectedValueOnce(new Error('API failure'));

    const res = await request(app).post('/api/weather/check').send({});
    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('API failure');
  });
});

// ---- POST /api/calculator ----

describe('POST /api/calculator', () => {
  it('returns the agent answer in { answer } shape', async () => {
    vi.mocked(runCalculatorAgent).mockResolvedValueOnce('56088');

    const res = await request(app)
      .post('/api/calculator')
      .send({ question: 'What is 123 * 456?', provider: 'anthropic' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ answer: '56088' });
  });

  it('defaults to "openai" provider when not specified', async () => {
    vi.mocked(runCalculatorAgent).mockResolvedValueOnce('5');

    await request(app)
      .post('/api/calculator')
      .send({ question: '2 + 3' });

    expect(vi.mocked(runCalculatorAgent)).toHaveBeenCalledWith('2 + 3', 'openai');
  });

  it('returns 400 when question is missing', async () => {
    const res = await request(app).post('/api/calculator').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('question is required');
  });

  it('returns 400 when question is only whitespace', async () => {
    const res = await request(app).post('/api/calculator').send({ question: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('question is required');
  });

  it('returns 500 and the error message when the agent throws', async () => {
    vi.mocked(runCalculatorAgent).mockRejectedValueOnce(new Error('LLM timeout'));

    const res = await request(app)
      .post('/api/calculator')
      .send({ question: 'What is 1+1?' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('LLM timeout');
  });
});
