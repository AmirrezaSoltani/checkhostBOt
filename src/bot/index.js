import { Bot, Keyboard } from 'grammy';
import { Target, Subscription, Event } from '../db/index.js';
import { config } from '../config/env.js';
import { setNotifyBot } from '../utils/notifier.js';
import { escapeMdSimple } from '../utils/escapeMd.js';

const ADMIN_IDS = new Set((config.ADMIN_CHAT_IDS || []).map(String));

function isAdmin(chatId) {
  return ADMIN_IDS.size === 0 || ADMIN_IDS.has(String(chatId));
}

const BTN_REPORT = '📊 گزارش جامع';
const BTN_STATUS = '📋 وضعیت هدف\u200cها';
const BTN_ADD = '➕ افزودن هدف';
const BTN_NOTIFY_ON = '🔔 اعلان روشن';
const BTN_NOTIFY_OFF = '🔕 اعلان خاموش';
const BTN_PAUSE_ALL = '⏸ توقف چک همه';
const BTN_RESUME_ALL = '▶️ شروع چک همه';
const BTN_CHECK_LIST = '📋 لیست چک هدف\u200cها';

function replyKeyboard() {
  const kb = new Keyboard()
    .text(BTN_REPORT)
    .text(BTN_STATUS).row()
    .text(BTN_ADD).row()
    .text(BTN_NOTIFY_ON)
    .text(BTN_NOTIFY_OFF).row()
    .text(BTN_PAUSE_ALL)
    .text(BTN_RESUME_ALL).row()
    .text(BTN_CHECK_LIST)
    .resized()
    .persistent();
  return kb;
}

export function createBot() {
  const bot = new Bot(config.BOT_TOKEN);

  const sendForNotify = (chatId, text) =>
    bot.api.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  setNotifyBot(sendForNotify);

  bot.command('start', async (ctx) => {
    const chatId = String(ctx.chat.id);
    await Subscription.findOneAndUpdate(
      { chatId },
      { $setOnInsert: { chatId, enabled: true } },
      { upsert: true, new: true }
    );
    await ctx.reply(
      'سلام. ربات مانیتورینگ دسترسی (CheckHost) آماده است.\nاز دکمه‌های زیر استفاده کنید.',
      { reply_markup: replyKeyboard() }
    );
  });

  bot.command('help', async (ctx) => {
    const text =
      '*دستورات:*\n' +
      '/status - وضعیت هدف\u200cها\n' +
      '/notify on | off - اعلان\n' +
      '/quiet on 23:00 07:00 - ساعات سکوت\n' +
      (isAdmin(ctx.chat.id)
        ? '\n*ادمین:*\n/add url | /add ip - افزودن هدف\n/disable <id> | /enable <id> - توقف یا شروع چک هر هدف\n/remove <id> | /list'
        : '');
    await ctx.reply(text, { parse_mode: 'Markdown' });
  });

  bot.command('status', async (ctx) => {
    const match = ctx.message?.text?.trim().split(/\s+/);
    const arg = match?.[1];
    if (arg) {
      const byId = /^[a-f0-9]{24}$/i.test(arg)
        ? await Target.findById(arg).lean()
        : null;
      const byName = byId ? null : await Target.findOne({ $or: [{ name: arg }, { address: arg }] }).lean();
      const t = byId || byName;
      if (!t) {
        await ctx.reply('هدف یافت نشد.');
        return;
      }
      const line = formatTargetLine(t);
      await ctx.reply(line, { parse_mode: 'Markdown' });
      return;
    }
    const targets = await Target.find({}).lean().sort({ createdAt: 1 });
    if (!targets.length) {
      await ctx.reply('هنوز هدفی ثبت نشده.');
      return;
    }
    const lines = targets.map((t) => formatTargetLine(t));
    await ctx.reply(lines.join('\n\n'), { parse_mode: 'Markdown' });
  });

  function formatTargetLine(t) {
    const addr = escapeMdSimple(t.address);
    const emoji = t.lastStatus === 'up' ? '🟢' : t.lastStatus === 'down' ? '🔴' : '⚪';
    const statusText = t.lastStatus === 'unknown' && !t.lastCheckedAt
      ? 'unknown (هنوز چک نشده)'
      : (t.lastStatus || 'unknown');
    const title = t.name && t.name.trim() && t.name !== t.address
      ? `${escapeMdSimple(t.name)} - \`${addr}\``
      : `\`${addr}\``;
    let s = `${emoji} *${title}*\n`;
    s += `وضعیت: ${statusText}`;
    if (t.lastCheckedAt) s += ` | چک: ${new Date(t.lastCheckedAt).toISOString()}`;
    if (t.lastLatencyMs != null) s += ` | ${t.lastLatencyMs}ms`;
    if (t.lastHttpStatus != null) s += ` | HTTP ${t.lastHttpStatus}`;
    if (t.lastError) s += `\nخطا: ${escapeMdSimple(t.lastError)}`;
    return s;
  }

  async function buildReport() {
    const targets = await Target.find({}).lean().sort({ createdAt: 1 });
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const events24h = await Event.countDocuments({ at: { $gte: dayAgo } });
    const downEvents24h = await Event.countDocuments({ at: { $gte: dayAgo }, toStatus: 'down' });
    const upCount = targets.filter((t) => t.lastStatus === 'up').length;
    const downCount = targets.filter((t) => t.lastStatus === 'down').length;
    const unknownCount = targets.length - upCount - downCount;

    const MAX_LEN = 4000;
    let text = '📊 *گزارش جامع*\n\n';
    text += `📌 جمع هدف\u200cها: ${targets.length}\n`;
    text += `🟢 Up: ${upCount} | 🔴 Down: ${downCount} | ⚪ Unknown: ${unknownCount}\n\n`;
    text += `📅 رویدادهای ۲۴ ساعت گذشته: ${events24h} (از جمله Down: ${downEvents24h})\n\n`;
    if (targets.length) {
      text += '_وضعیت آخر هر هدف:_\n\n';
      for (const t of targets) {
        if (text.length > MAX_LEN) break;
        const emoji = t.lastStatus === 'up' ? '🟢' : t.lastStatus === 'down' ? '🔴' : '⚪';
        const name = escapeMdSimple(t.name || t.address);
        const last = t.lastCheckedAt ? new Date(t.lastCheckedAt).toLocaleString('fa-IR') : 'هنوز چک نشده';
        text += `${emoji} ${name}\n   Last Check: ${last}\n\n`;
      }
      if (text.length > MAX_LEN) text += '…\n\n';
    }
    text += `_بروز: ${now.toLocaleString('fa-IR')}_`;
    return text;
  }

  bot.hears(BTN_REPORT, async (ctx) => {
    const text = await buildReport();
    await ctx.reply(text, { parse_mode: 'Markdown' });
  });

  bot.hears(BTN_STATUS, async (ctx) => {
    const targets = await Target.find({}).lean().sort({ createdAt: 1 });
    if (!targets.length) {
      await ctx.reply('هنوز هدفی ثبت نشده.');
      return;
    }
    const lines = targets.map((t) => formatTargetLine(t));
    let text = lines.join('\n\n');
    if (text.length > 4000) text = text.slice(0, 3997) + '…';
    await ctx.reply(text, { parse_mode: 'Markdown' });
  });

  bot.hears(BTN_ADD, async (ctx) => {
    if (!isAdmin(ctx.chat.id)) {
      await ctx.reply('دسترسی مجاز نیست.');
      return;
    }
    await ctx.reply(
      '➕ *افزودن هدف*\n\n' +
        '• URL: `/add url https://example.com`\n' +
        '• IP: `/add ip 8.8.8.8`',
      { parse_mode: 'Markdown' }
    );
  });

  bot.hears(BTN_NOTIFY_ON, async (ctx) => {
    await Subscription.findOneAndUpdate(
      { chatId: String(ctx.chat.id) },
      { $set: { enabled: true }, $setOnInsert: { chatId: String(ctx.chat.id) } },
      { upsert: true }
    );
    await ctx.reply('🔔 اعلان‌ها روشن شد.');
  });

  bot.hears(BTN_NOTIFY_OFF, async (ctx) => {
    await Subscription.findOneAndUpdate(
      { chatId: String(ctx.chat.id) },
      { $set: { enabled: false }, $setOnInsert: { chatId: String(ctx.chat.id) } },
      { upsert: true }
    );
    await ctx.reply('🔕 اعلان‌ها خاموش شد.');
  });

  bot.hears(BTN_PAUSE_ALL, async (ctx) => {
    if (!isAdmin(ctx.chat.id)) {
      await ctx.reply('دسترسی مجاز نیست.');
      return;
    }
    const result = await Target.updateMany({}, { $set: { enabled: false } });
    await ctx.reply(`⏸ چک همهٔ هدف‌ها متوقف شد. (${result.modifiedCount} هدف)`);
  });

  bot.hears(BTN_RESUME_ALL, async (ctx) => {
    if (!isAdmin(ctx.chat.id)) {
      await ctx.reply('دسترسی مجاز نیست.');
      return;
    }
    const result = await Target.updateMany({}, { $set: { enabled: true } });
    await ctx.reply(`▶️ چک همهٔ هدف‌ها فعال شد. (${result.modifiedCount} هدف)`);
  });

  bot.hears(BTN_CHECK_LIST, async (ctx) => {
    const targets = await Target.find({}).lean().sort({ createdAt: 1 });
    if (!targets.length) {
      await ctx.reply('هنوز هدفی ثبت نشده.');
      return;
    }
    let text = '📋 *وضعیت چک هدف\u200cها*\n\n';
    for (const t of targets) {
      const name = escapeMdSimple((t.name || t.address).slice(0, 50));
      const checkState = t.enabled ? '✅ فعال' : '⏸ متوقف';
      if (isAdmin(ctx.chat.id)) {
        const cmd = t.enabled ? `/disable ${t._id}` : `/enable ${t._id}`;
        text += `${checkState} ${name}\n   ${cmd}\n\n`;
      } else {
        text += `${checkState} ${name}\n\n`;
      }
    }
    if (isAdmin(ctx.chat.id)) text += '_برای تغییر: روی دستور بالا بزنید یا کپی کنید._';
    await ctx.reply(text, { parse_mode: 'Markdown' });
  });

  bot.command('notify', async (ctx) => {
    const parts = ctx.message?.text?.trim().split(/\s+/) || [];
    const sub = await Subscription.findOne({ chatId: String(ctx.chat.id) });
    if (!sub) {
      await ctx.reply('اول /start بزنید.');
      return;
    }
    const action = (parts[1] || '').toLowerCase();
    const value = (parts[2] || '').toLowerCase();
    if (action === 'on') {
      sub.enabled = true;
      await sub.save();
      await ctx.reply('اعلان‌ها روشن شد.');
      return;
    }
    if (action === 'off') {
      sub.enabled = false;
      await sub.save();
      await ctx.reply('اعلان‌ها خاموش شد.');
      return;
    }
    if (action === 'up') {
      sub.notifyOnUp = value === 'on';
      await sub.save();
      await ctx.reply(`اعلان برای Up: ${sub.notifyOnUp ? 'روشن' : 'خاموش'}`);
      return;
    }
    if (action === 'down') {
      sub.notifyOnDown = value === 'on';
      await sub.save();
      await ctx.reply(`اعلان برای Down: ${sub.notifyOnDown ? 'روشن' : 'خاموش'}`);
      return;
    }
    if (action === 'changes') {
      sub.onlyChanges = value === 'on';
      await sub.save();
      await ctx.reply(`اعلان فقط روی تغییر: ${sub.onlyChanges ? 'روشن' : 'خاموش'}`);
      return;
    }
    await ctx.reply('استفاده: /notify on | off | up on|off | down on|off | changes on|off');
  });

  bot.command('quiet', async (ctx) => {
    const parts = ctx.message?.text?.trim().split(/\s+/) || [];
    const sub = await Subscription.findOne({ chatId: String(ctx.chat.id) });
    if (!sub) {
      await ctx.reply('اول /start بزنید.');
      return;
    }
    const action = (parts[1] || '').toLowerCase();
    if (action === 'off') {
      if (!sub.quietHours) sub.quietHours = {};
      sub.quietHours.enabled = false;
      await sub.save();
      await ctx.reply('ساعات سکوت خاموش شد.');
      return;
    }
    if (action === 'on') {
      const start = parts[2] || '23:00';
      const end = parts[3] || '07:00';
      if (!sub.quietHours) sub.quietHours = {};
      sub.quietHours.enabled = true;
      sub.quietHours.start = start;
      sub.quietHours.end = end;
      await sub.save();
      await ctx.reply(`ساعات سکوت: ${start} تا ${end}`);
      return;
    }
    await ctx.reply('استفاده: /quiet on 23:00 07:00 یا /quiet off');
  });

  bot.command('list', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) {
      await ctx.reply('دسترسی مجاز نیست.');
      return;
    }
    const targets = await Target.find({}).lean().sort({ createdAt: 1 });
    if (!targets.length) {
      await ctx.reply('هدفی ثبت نشده.');
      return;
    }
    const lines = targets.map((t) => `${t._id} | ${t.type} | ${t.address} | ${t.enabled ? 'فعال' : 'غیرفعال'}`);
    await ctx.reply(lines.join('\n'));
  });

  bot.command('add', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) {
      await ctx.reply('دسترسی مجاز نیست.');
      return;
    }
    const parts = ctx.message?.text?.trim().split(/\s+/) || [];
    const type = (parts[1] || '').toLowerCase();
    const address = parts.slice(2).join(' ').trim();
    if (type !== 'url' && type !== 'ip') {
      await ctx.reply('استفاده: /add url <آدرس> یا /add ip <آدرس>');
      return;
    }
    if (!address) {
      await ctx.reply('آدرس را وارد کنید.');
      return;
    }
    try {
      const t = await Target.create({
        type,
        address,
        checkMethod: type === 'url' ? 'http' : 'tcp',
        tcpPort: type === 'ip' ? 80 : undefined,
        enabled: true,
      });
      await ctx.reply(`هدف اضافه شد: ${t._id}`);
    } catch (err) {
      if (err.code === 11000) await ctx.reply('این آدرس قبلاً ثبت شده.');
      else await ctx.reply('خطا: ' + (err.message || String(err)));
    }
  });

  bot.command('remove', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) {
      await ctx.reply('دسترسی مجاز نیست.');
      return;
    }
    const id = ctx.message?.text?.trim().split(/\s+/)[1];
    if (!id) {
      await ctx.reply('استفاده: /remove <id>');
      return;
    }
    const deleted = await Target.findByIdAndDelete(id);
    if (deleted) await ctx.reply('حذف شد.');
    else await ctx.reply('هدف یافت نشد.');
  });

  bot.command('enable', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) {
      await ctx.reply('دسترسی مجاز نیست.');
      return;
    }
    const id = ctx.message?.text?.trim().split(/\s+/)[1];
    if (!id) {
      await ctx.reply('استفاده: /enable <id>');
      return;
    }
    const t = await Target.findByIdAndUpdate(id, { enabled: true }, { new: true });
    if (t) await ctx.reply('فعال شد.');
    else await ctx.reply('هدف یافت نشد.');
  });

  bot.command('disable', async (ctx) => {
    if (!isAdmin(ctx.chat.id)) {
      await ctx.reply('دسترسی مجاز نیست.');
      return;
    }
    const id = ctx.message?.text?.trim().split(/\s+/)[1];
    if (!id) {
      await ctx.reply('استفاده: /disable <id>');
      return;
    }
    const t = await Target.findByIdAndUpdate(id, { enabled: false }, { new: true });
    if (t) await ctx.reply('غیرفعال شد.');
    else await ctx.reply('هدف یافت نشد.');
  });

  bot.on('message:text', async (ctx) => {
    await ctx.reply(
      'دستور یا پیام شناخته\u200cشده نبود. از دکمه\u200cهای زیر یا /help استفاده کنید.',
      { reply_markup: replyKeyboard() }
    );
  });

  return bot;
}
