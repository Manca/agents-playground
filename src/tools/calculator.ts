import type Anthropic from '@anthropic-ai/sdk';
import type OpenAI from 'openai';

export function calculate(operation: string, a: number, b: number): number {
  switch (operation) {
    case 'add':      return a + b;
    case 'subtract': return a - b;
    case 'multiply': return a * b;
    case 'divide':   return a / b;
    default: throw new Error(`Unknown operation: ${operation}`);
  }
}

const schema = {
  name: 'calculate',
  description: 'Perform basic arithmetic: add, subtract, multiply, divide',
  properties: {
    operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
    a: { type: 'number', description: 'First operand' },
    b: { type: 'number', description: 'Second operand' },
  },
  required: ['operation', 'a', 'b'],
} as const;

export const calculatorToolOpenAI: OpenAI.Chat.ChatCompletionTool = {
  type: 'function',
  function: {
    name: schema.name,
    description: schema.description,
    parameters: { type: 'object', properties: schema.properties, required: [...schema.required] },
  },
};

export const calculatorToolAnthropic: Anthropic.Tool = {
  name: schema.name,
  description: schema.description,
  input_schema: { type: 'object', properties: schema.properties, required: [...schema.required] },
};
