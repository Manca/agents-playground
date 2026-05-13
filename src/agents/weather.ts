import type OpenAI from 'openai';
import { openai } from '../utils/clients.js';
import { getWeather, appendWeather, weatherTools } from '../tools/weather.js';
import { weatherPrompt } from '../prompts/index.js';

export async function runWeatherAgent(city: string): Promise<void> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'user', content: weatherPrompt(city) },
  ];

  while (true) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      tools: weatherTools,
      messages,
    });

    const message = response.choices[0].message;
    messages.push(message);

    if (!message.tool_calls?.length) break;

    for (const tc of message.tool_calls) {
      const args = JSON.parse(tc.function.arguments) as Record<string, string>;
      let result: string;

      if (tc.function.name === 'get_weather') result = await getWeather(args.city);
      else if (tc.function.name === 'append_weather') result = appendWeather(args.summary);
      else throw new Error(`Unknown tool: ${tc.function.name}`);

      messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }
  }
}
