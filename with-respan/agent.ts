import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { Respan, withWorkflow, withAgent, withTool } from '@respan/respan';
import { AnthropicInstrumentor } from '@respan/instrumentation-anthropic';
import { OpenAIInstrumentor } from '@respan/instrumentation-openai';

const respan = new Respan({
  apiKey: process.env.RESPAN_API_KEY,
  instrumentations: [new AnthropicInstrumentor(), new OpenAIInstrumentor()],
});
await respan.initialize();

// --- tool ---

function calculate(operation: string, a: number, b: number): number {
  switch (operation) {
    case 'add':      return a + b;
    case 'subtract': return a - b;
    case 'multiply': return a * b;
    case 'divide':   return a / b;
    default: throw new Error(`Unknown operation: ${operation}`);
  }
}

const toolSchema = {
  name: 'calculate',
  description: 'Perform basic arithmetic: add, subtract, multiply, divide',
  parameters: {
    type: 'object' as const,
    properties: {
      operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
      a: { type: 'number', description: 'First operand' },
      b: { type: 'number', description: 'Second operand' },
    },
    required: ['operation', 'a', 'b'],
  },
};

// --- Anthropic agent ---

async function runAnthropicAgent(question: string): Promise<string> {
  const client = new Anthropic();

  return withWorkflow({ name: 'answer_question' }, () =>
    withAgent({ name: 'calculator_agent' }, async () => {
      const messages: Anthropic.MessageParam[] = [{ role: 'user', content: question }];
      const tools: Anthropic.Tool[] = [
        {
          name: toolSchema.name,
          description: toolSchema.description,
          input_schema: {
            type: 'object',
            properties: toolSchema.parameters.properties,
            required: toolSchema.parameters.required,
          },
        },
      ];

      while (true) {
        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          tools,
          messages,
        });

        messages.push({ role: 'assistant', content: response.content });

        if (response.stop_reason === 'end_turn') {
          const text = response.content.find((b) => b.type === 'text');
          return text?.text ?? '';
        }

        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolUse of toolUseBlocks) {
          const result = await withTool({ name: toolUse.name }, () => {
            const { operation, a, b } = toolUse.input as { operation: string; a: number; b: number };
            return calculate(operation, a, b);
          });
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: String(result) });
        }
        messages.push({ role: 'user', content: toolResults });
      }
    })
  );
}

// --- OpenAI agent ---

async function runOpenAIAgent(question: string): Promise<string> {
  const client = new OpenAI();

  return withWorkflow({ name: 'answer_question' }, () =>
    withAgent({ name: 'calculator_agent' }, async () => {
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: 'user', content: question }];
      const tools: OpenAI.Chat.ChatCompletionTool[] = [{ type: 'function', function: toolSchema }];

      while (true) {
        const response = await client.chat.completions.create({ model: 'gpt-4o-mini', tools, messages });
        const message = response.choices[0].message;
        messages.push(message);

        if (!message.tool_calls?.length) return message.content ?? '';

        for (const toolCall of message.tool_calls) {
          const result = await withTool({ name: toolCall.function.name }, () => {
            const { operation, a, b } = JSON.parse(toolCall.function.arguments) as {
              operation: string; a: number; b: number;
            };
            return calculate(operation, a, b);
          });
          messages.push({ role: 'tool', tool_call_id: toolCall.id, content: String(result) });
        }
      }
    })
  );
}

// --- main ---

const args = process.argv.slice(2);
const providerFlag = args.indexOf('--provider');
const provider = providerFlag !== -1 ? args[providerFlag + 1] : 'anthropic';
const question = args.filter((_, i) => i !== providerFlag && i !== providerFlag + 1)[0]
  ?? 'What is (123 * 456) + 789?';

if (provider !== 'anthropic' && provider !== 'openai') {
  console.error('--provider must be "anthropic" or "openai"');
  process.exit(1);
}

console.log(`Provider: ${provider}`);
console.log(`Question: ${question}`);
const answer = provider === 'anthropic' ? await runAnthropicAgent(question) : await runOpenAIAgent(question);
console.log(`Answer:   ${answer}`);

await respan.flush();
