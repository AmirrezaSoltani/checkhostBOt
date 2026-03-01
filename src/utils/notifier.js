import { Subscription } from '../db/index.js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';
import { createRateLimiter } from './rateLimiter.js';
import { escapeMdSimple } from './escapeMd.js';

const RATE_LIMIT_MS = config.NOTIFY_RATE_LIMIT_MS;
const QUIET_TZ = config.QUIET_HOURS_TIMEZONE;

let sendMessageFn = null;

export function setNotifyBot(sendFn) {
  sendMessageFn = sendFn;
}

function isInQuietHours(sub) {
  if (!sub.quietHours?.enabled) return false;
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: QUIET_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const t = formatter.format(now);
    const [h, m] = t.split(':').map(Number);
    const currentMinutes = h * 60 + m;
    const [startH, startM] = (sub.quietHours.start || '23:00').split(':').map(Number);
    const [endH, endM] = (sub.quietHours.end || '07:00').split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    if (endMinutes > startMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } catch {
    return false;
  }
}

function shouldNotify(sub, targetId, toStatus) {
  if (!sub.enabled) return false;
  if (sub.targetFilter?.mode === 'selected') {
    const ids = sub.targetFilter.targetIds || [];
    if (ids.length && !ids.some((id) => String(id) === String(targetId))) return false;
  }
  if (toStatus === 'up' && !sub.notifyOnUp) return false;
  if (toStatus === 'down' && !sub.notifyOnDown) return false;
  if (isInQuietHours(sub)) return false;
  return true;
}

function formatNotification(target, fromStatus, toStatus, result, includeLatency) {
  const name = escapeMdSimple(target.name || target.address);
  const checkedAt = new Date().toISOString();
  if (toStatus === 'down') {
    let text = `🔴 *DOWN*: \`${name}\`\n`;
    text += `Reason: ${escapeMdSimple(result.error || 'Unknown')}\n`;
    if (target.lastChangeAt) text += `Last ok: ${new Date(target.lastChangeAt).toISOString()}\n`;
    text += `Checked at: ${checkedAt}`;
    return text;
  }
  let text = `🟢 *UP*: \`${name}\`\n`;
  if (includeLatency !== false && result.latencyMs != null) text += `Latency: ${result.latencyMs}ms\n`;
  if (result.httpStatus != null) text += `HTTP: ${result.httpStatus}\n`;
  text += `Checked at: ${checkedAt}`;
  return text;
}

const limiter = createRateLimiter(RATE_LIMIT_MS);

export async function notifySubscriptionsOnChange({ target, fromStatus, toStatus, result }) {
  if (!sendMessageFn) {
    logger.warn('Notify bot not set, skipping notifications');
    return;
  }

  const subs = await Subscription.find({ enabled: true }).lean();
  const toNotify = subs.filter((s) => shouldNotify(s, target._id, toStatus));

  for (const sub of toNotify) {
    const includeLatency = sub.includeLatency !== false;
    const text = formatNotification(target, fromStatus, toStatus, result, includeLatency);
    await limiter.push(async () => {
      try {
        await sendMessageFn(sub.chatId, text);
      } catch (err) {
        logger.warn({ err, chatId: sub.chatId }, 'Failed to send notification');
      }
    });
  }
}
