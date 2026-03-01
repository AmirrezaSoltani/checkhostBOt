/**
 * Environment and config. All values from process.env with defaults.
 */
function parseAdminChatIds(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.includes('-') ? s : Number(s)));
}

export const config = {
  // Telegram
  BOT_TOKEN: process.env.BOT_TOKEN || '',
  ADMIN_CHAT_IDS: parseAdminChatIds(process.env.ADMIN_CHAT_IDS),

  // MongoDB
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/checkhostbot',

  // Check intervals (seconds)
  CHECK_INTERVAL_SECONDS: Number(process.env.CHECK_INTERVAL_SECONDS) || 60,

  // Timeouts (ms)
  HTTP_TIMEOUT_MS: Number(process.env.HTTP_TIMEOUT_MS) || 5000,
  PING_TIMEOUT_MS: Number(process.env.PING_TIMEOUT_MS) || 2000,
  TCP_TIMEOUT_MS: Number(process.env.TCP_TIMEOUT_MS) || 3000,

  // Retries
  CHECK_RETRIES: Number(process.env.CHECK_RETRIES) || 2,
  RETRY_DELAY_MS: Number(process.env.RETRY_DELAY_MS) || 1000,

  // Notifications
  NOTIFY_RATE_LIMIT_MS: Number(process.env.NOTIFY_RATE_LIMIT_MS) || 500,
  QUIET_HOURS_TIMEZONE: process.env.QUIET_HOURS_TIMEZONE || 'Europe/Berlin',

  // API (optional)
  API_PORT: Number(process.env.API_PORT) || 3000,
  API_TOKEN: process.env.API_TOKEN || '',
};
