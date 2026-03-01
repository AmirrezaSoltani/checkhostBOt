/**
 * Simple rate-limited queue: run async tasks with a minimum delay between them.
 */
const DEFAULT_DELAY_MS = 500;

export function createRateLimiter(delayMs = DEFAULT_DELAY_MS) {
  let lastRun = 0;
  const queue = [];
  let processing = false;

  async function processQueue() {
    if (processing || queue.length === 0) return;
    processing = true;
    while (queue.length > 0) {
      const now = Date.now();
      const wait = Math.max(0, lastRun + delayMs - now);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const { fn, resolve, reject } = queue.shift();
      lastRun = Date.now();
      try {
        const result = await fn();
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }
    processing = false;
  }

  return {
    async push(fn) {
      return new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject });
        processQueue();
      });
    },
  };
}
