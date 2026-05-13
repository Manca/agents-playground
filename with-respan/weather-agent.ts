import 'dotenv/config';
import { appendFileSync } from 'fs';
import OpenAI from 'openai';
import cron from 'node-cron';
import { Respan, withWorkflow, withAgent, withTool } from '@respan/respan';
import { OpenAIInstrumentor } from '@respan/instrumentation-openai';

const respan = new Respan({
  apiKey: process.env.RESPAN_API_KEY,
  instrumentations: [new OpenAIInstrumentor()],
});
await respan.initialize();

const client = new OpenAI();

// --- tools ---

async function getWeather(city: string): Promise<string> {
  const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {
    headers: { 'User-Agent': 'weather-agent/1.0' },
  });
  if (!res.ok) throw new Error(`wttr.in returned ${res.status}`);
  const data = await res.json() as {
    current_condition: Array<{
      temp_F: string; FeelsLikeF: string; humidity: string;
      windspeedMiles: string; weatherDesc: Array<{ value: string }>;
    }>;
    nearest_area: Array<{
      areaName: Array<{ value: string }>; region: Array<{ value: string }>;
    }>;
  };
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

function appendWeather(summary: string): string {
  appendFileSync('weather.txt', `[${new Date().toISOString()}] ${summary}\n`);
  return 'Saved.';
}

const tools: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Fetch current weather data for a city from wttr.in',
      parameters: {
        type: 'object',
        properties: { city: { type: 'string', description: 'City and region, e.g. "Burlingame, CA"' } },
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
        properties: { summary: { type: 'string', description: 'Concise one-line summary' } },
        required: ['summary'],
      },
    },
  },
];

// --- agent ---

async function runWeatherAgent(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Running weather check...`);
  try {
    await withWorkflow({ name: 'weather_check' }, () =>
      withAgent({ name: 'weather_agent' }, async () => {
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          {
            role: 'user',
            content: 'Check the current weather for Burlingame, CA. Append a concise one-line summary — include condition, temperature (°F), feels-like, humidity, and wind speed.',
          },
        ];

        while (true) {
          const response = await client.chat.completions.create({ model: 'gpt-4o-mini', tools, messages });
          const message = response.choices[0].message;
          messages.push(message);

          if (!message.tool_calls?.length) break;

          for (const toolCall of message.tool_calls) {
            const args = JSON.parse(toolCall.function.arguments) as Record<string, string>;
            const result = await withTool({ name: toolCall.function.name }, async () => {
              if (toolCall.function.name === 'get_weather') return getWeather(args.city);
              if (toolCall.function.name === 'append_weather') return appendWeather(args.summary);
              throw new Error(`Unknown tool: ${toolCall.function.name}`);
            });
            messages.push({ role: 'tool', tool_call_id: toolCall.id, content: String(result) });
          }
        }
      })
    );
    await respan.flush();
    console.log(`[${new Date().toISOString()}] Done. Check weather.txt`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error:`, (err as Error).message);
  }
}

// --- scheduler ---

await runWeatherAgent();
cron.schedule('0 * * * *', runWeatherAgent);
console.log('Weather agent running — checks every hour. Press Ctrl+C to stop.');
