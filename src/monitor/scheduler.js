import { Target, Event } from '../db/index.js';
import { runCheck } from './checker.js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { notifySubscriptionsOnChange } from '../utils/notifier.js';

const INTERVAL_SECONDS = config.CHECK_INTERVAL_SECONDS;
let intervalId = null;

async function checkAllTargets() {
  const targets = await Target.find({ enabled: true }).lean();
  if (!targets.length) return;

  for (const target of targets) {
    const interval = target.intervalSeconds ?? INTERVAL_SECONDS;
    const lastChecked = target.lastCheckedAt ? new Date(target.lastCheckedAt).getTime() : 0;
    const now = Date.now();
    if (now - lastChecked < interval * 1000) continue;

    try {
      const result = await runCheck(target);
      const currentStatus = result.status;
      const lastStatus = target.lastStatus || 'unknown';

      const update = {
        lastStatus: currentStatus,
        lastCheckedAt: new Date(),
        lastLatencyMs: result.latencyMs ?? undefined,
        lastHttpStatus: result.httpStatus ?? undefined,
        lastError: result.error ?? undefined,
      };

      if (currentStatus !== lastStatus) {
        update.lastChangeAt = new Date();
        await Target.updateOne({ _id: target._id }, update);

        await Event.create({
          targetId: target._id,
          fromStatus: lastStatus,
          toStatus: currentStatus,
          at: new Date(),
          latencyMs: result.latencyMs,
          httpStatus: result.httpStatus,
          error: result.error,
        });

        await notifySubscriptionsOnChange({
          target: { ...target, ...update },
          fromStatus: lastStatus,
          toStatus: currentStatus,
          result,
        });
      } else {
        await Target.updateOne({ _id: target._id }, update);
      }
    } catch (err) {
      logger.warn({ err, targetId: target._id, address: target.address }, 'Check failed');
      await Target.updateOne(
        { _id: target._id },
        {
          lastCheckedAt: new Date(),
          lastError: err.message || String(err),
        }
      );
    }
  }
}

export function startScheduler() {
  if (intervalId) return;
  const ms = Math.max(1000, INTERVAL_SECONDS * 1000);
  intervalId = setInterval(() => {
    checkAllTargets().catch((err) => logger.error({ err }, 'Scheduler run failed'));
  }, ms);
  setImmediate(() => checkAllTargets().catch((err) => logger.error({ err }, 'Initial check failed')));
  logger.info({ intervalSeconds: INTERVAL_SECONDS }, 'Scheduler started');
}

export function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Scheduler stopped');
  }
}
