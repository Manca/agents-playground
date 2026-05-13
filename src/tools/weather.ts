import { appendFileSync } from 'fs';
import type OpenAI from 'openai';

interface WttrResponse {
  current_condition: Array<{
    temp_F: string;
    FeelsLikeF: string;
    humidity: string;
    windspeedMiles: string;
    weatherDesc: Array<{ value: string }>;
  }>;
  nearest_area: Array<{
    areaName: Array<{ value: string }>;
    region: Array<{ value: string }>;
  }>;
}

export async function getWeather(city: string): Promise<string> {
  const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {
    headers: { 'User-Agent': 'weather-agent/1.0' },
  });
  if (!res.ok) throw new Error(`wttr.in returned ${res.status}`);
  const data = await res.json() as WttrResponse;
  const c = data.current_condition[0];
  const area = data.nearest_area[0];
  return JSON.stringify({
    location: `${area.areaName[0].value}, ${area.region[0].value}`,
    condition: c.weatherDesc[0].value,
    temp_F: c.temp_F,
    feels_like_F: c.FeelsLikeF,
    humidity_pct: c.humidity,
    wind_mph: c.windspeedMiles,
  });
}

export function appendWeather(summary: string): string {
  appendFileSync('weather.txt', `[${new Date().toISOString()}] ${summary}\n`);
  return 'Saved.';
}

export const weatherTools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Fetch current weather for a city from wttr.in',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City and region, e.g. "Burlingame, CA"' },
        },
        required: ['city'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'append_weather',
      description: 'Append a one-line weather summary to weather.txt',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Concise one-line summary including condition, temp, humidity, wind' },
        },
        required: ['summary'],
      },
    },
  },
];
