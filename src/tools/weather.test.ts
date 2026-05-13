import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// ---------------------------------------------------------------------------
// appendWeather() — file I/O test using a temp file
// ---------------------------------------------------------------------------
// appendWeather() calls appendFileSync with a hardcoded path ('weather.txt').
// We intercept it by mocking the 'fs' module so no real file is written.

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    // appendFileSync stays as a spy wrapping the real implementation during
    // the "real file" tests and is overridden per-test for the mock tests.
    appendFileSync: vi.fn(actual.appendFileSync),
  };
});

// We need to import AFTER the mock is in place.
const { appendWeather, weatherTools } = await import('./weather.js');
const { appendFileSync } = await import('fs');

describe('appendWeather()', () => {
  const tmpFile = join(tmpdir(), `weather-test-${process.pid}.txt`);

  afterEach(() => {
    vi.mocked(appendFileSync).mockReset();
    if (existsSync(tmpFile)) unlinkSync(tmpFile);
  });

  it('returns "Saved."', () => {
    const result = appendWeather('Burlingame, CA: Sunny, 72°F');
    expect(result).toBe('Saved.');
  });

  it('calls appendFileSync exactly once with the right content shape', () => {
    const summary = 'San Francisco, CA: Foggy, 58°F';
    appendWeather(summary);

    expect(vi.mocked(appendFileSync)).toHaveBeenCalledTimes(1);

    const [, content] = vi.mocked(appendFileSync).mock.calls[0] as [string, string];
    // Must contain the summary
    expect(content).toContain(summary);
    // Must be prefixed with an ISO-8601 timestamp in square brackets
    expect(content).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\]/);
    // Must end with a newline
    expect(content).toMatch(/\n$/);
  });

  it('writes to "weather.txt" (the hardcoded path)', () => {
    appendWeather('Any summary');
    const [filePath] = vi.mocked(appendFileSync).mock.calls[0] as [string, ...unknown[]];
    expect(filePath).toBe('weather.txt');
  });

  it('appends multiple entries independently', () => {
    appendWeather('First entry');
    appendWeather('Second entry');
    expect(vi.mocked(appendFileSync)).toHaveBeenCalledTimes(2);
  });

  it('handles an empty summary string without throwing', () => {
    expect(() => appendWeather('')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getWeather() — mocking global fetch
// ---------------------------------------------------------------------------

const { getWeather } = await import('./weather.js');

const mockWttrResponse = {
  current_condition: [
    {
      temp_F: '72',
      FeelsLikeF: '70',
      humidity: '55',
      windspeedMiles: '10',
      weatherDesc: [{ value: 'Sunny' }],
    },
  ],
  nearest_area: [
    {
      areaName: [{ value: 'Burlingame' }],
      region: [{ value: 'California' }],
    },
  ],
};

describe('getWeather()', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a JSON string with expected weather fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockWttrResponse,
    } as Response);

    const result = await getWeather('Burlingame, CA');
    const parsed = JSON.parse(result);

    expect(parsed.location).toBe('Burlingame, California');
    expect(parsed.condition).toBe('Sunny');
    expect(parsed.temp_F).toBe('72');
    expect(parsed.feels_like_F).toBe('70');
    expect(parsed.humidity_pct).toBe('55');
    expect(parsed.wind_mph).toBe('10');
  });

  it('encodes the city in the URL (spaces → %20)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockWttrResponse,
    } as Response);

    await getWeather('New York, NY');

    const calledUrl = (vi.mocked(fetch).mock.calls[0][0] as string);
    expect(calledUrl).toContain('New%20York%2C%20NY');
  });

  it('sets a User-Agent header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockWttrResponse,
    } as Response);

    await getWeather('London');

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('weather-agent/1.0');
  });

  it('throws when the HTTP response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    await expect(getWeather('UnknownCity')).rejects.toThrowError('wttr.in returned 404');
  });

  it('propagates network-level errors', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));
    await expect(getWeather('Tokyo')).rejects.toThrowError('Network error');
  });
});

// ---------------------------------------------------------------------------
// weatherTools schema — smoke tests
// ---------------------------------------------------------------------------

describe('weatherTools schema', () => {
  it('exports exactly two tools', () => {
    expect(weatherTools).toHaveLength(2);
  });

  it('first tool is "get_weather"', () => {
    expect(weatherTools[0].function.name).toBe('get_weather');
  });

  it('second tool is "append_weather"', () => {
    expect(weatherTools[1].function.name).toBe('append_weather');
  });

  it('get_weather requires a "city" parameter', () => {
    expect(weatherTools[0].function.parameters?.required).toContain('city');
  });

  it('append_weather requires a "summary" parameter', () => {
    expect(weatherTools[1].function.parameters?.required).toContain('summary');
  });

  it('all tools have type "function"', () => {
    weatherTools.forEach((t) => expect(t.type).toBe('function'));
  });
});
