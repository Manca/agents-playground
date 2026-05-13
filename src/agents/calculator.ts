import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';
import { anthropic, openai } from '../utils/clients.js';
import { calculate, calculatorToolAnthropic, calculatorToolOpenAI } from '../tools/calculator.js';

export type Provider = 'anthropic' | 'openai';

export async function runCalculatorAgent(question: string, provider: Provider): Promise<string> {
  return provider === 'anthropic'
    ? runWithAnthropic(question)
    : runWithOpenAI(question);
}

async function runWithAnthropic(question: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: question }];

  while (true) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      tools: [calculatorToolAnthropic],
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      const text = response.content.find((b) => b.type === 'text');
      return text?.text ?? '';
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = response.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map((b) => {
        const { operation, a, b: operand } = b.input as { operation: string; a: number; b: number };
        return { type: 'tool_result', tool_use_id: b.id, content: String(calculate(operation, a, operand)) };
      });

    messages.push({ role: 'user', content: toolResults });
  }
}

async function runWithOpenAI(question: string): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: 'user', content: question }];

  while (true) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      tools: [calculatorToolOpenAI],
      messages,
    });

    const message = response.choices[0].message;
    messages.push(message);

    if (!message.tool_calls?.length) return message.content ?? '';

    for (const tc of message.tool_calls) {
      const { operation, a, b } = JSON.parse(tc.function.arguments) as { operation: string; a: number; b: number };
      messages.push({ role: 'tool', tool_call_id: tc.id, content: String(calculate(operation, a, b)) });
    }
  }
}
