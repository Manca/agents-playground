import cron from 'node-cron';

export function scheduleHourly(fn: () => Promise<void>): void {
  cron.schedule('0 * * * *', fn);
}
