import 'dotenv/config';
import { runWeatherAgent } from './src/agents/weather.js';
import { scheduleHourly } from './src/utils/scheduler.js';

const CITY = 'Burlingame, CA';

async function tick(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Checking weather...`);
  try {
    await runWeatherAgent(CITY);
    console.log(`[${new Date().toISOString()}] Done. See weather.txt`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Error:`, (err as Error).message);
  }
}

await tick();
scheduleHourly(tick);
console.log('Weather agent running — checks every hour. Ctrl+C to stop.');
