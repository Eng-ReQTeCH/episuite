import { chromium } from 'playwright';
import { setTimeout } from 'node:timers/promises';

export { chromium };
export const browserOptions = {
  headless: true,
  executablePath: process.env.EPISUITE_BROWSER || process.env.LIFE_BROWSER || process.env.CALENDAR_BROWSER || undefined
};

export async function waitForCondition(predicate, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await setTimeout(50);
  }
  throw new Error('Timed out waiting for the browser operation to finish.');
}
