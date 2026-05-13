import 'dotenv/config';
import { runCalculatorAgent, type Provider } from './src/agents/calculator.js';

const args = process.argv.slice(2);
const providerFlag = args.indexOf('--provider');
const provider = (providerFlag !== -1 ? args[providerFlag + 1] : 'anthropic') as Provider;
const question = args.filter((_, i) => i !== providerFlag && i !== providerFlag + 1)[0]
  ?? 'What is (123 * 456) + 789?';

if (provider !== 'anthropic' && provider !== 'openai') {
  console.error('--provider must be "anthropic" or "openai"');
  process.exit(1);
}

console.log(`Provider: ${provider}`);
console.log(`Question: ${question}`);
const answer = await runCalculatorAgent(question, provider);
console.log(`Answer:   ${answer}`);
