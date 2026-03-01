import { Bot } from 'grammy';
import { Target, Subscription } from '../db/index.js';
import { config } from '../config/env.js';
import { setNotifyBot } from '../utils/notifier.js';
import { escapeMdSimple } from '../utils/escapeMd.js';

const ADMIN_IDS = new Set((config.ADMIN_CHAT_IDS || []).map(String));

function isAdmin(chatId) {
  return ADMIN_IDS.size === 0 || ADMIN_IDS.has(String(chatId));
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
      'سلام. ربات مانیتورینگ دسترسی (CheckHost) آماده است.\n' +
        'از /help برای مشاهده دستورات استفاده کنید.\n' +
        'با /status وضعیت همه هدف‌ها را ببینید.'
    );
  });

  bot.command('help', async (ctx) => {
    const text =
      '*دستورات:*\n' +
      '/status - وضعیت همه هدف‌ها\n' +
      '/status <name|id> - وضعیت یک هدف\n' +
      '/notify on | off - روشن/خاموش اعلان\n' +
      '/notify up on | off\n' +
      '/notify down on | off\n' +
      '/notify changes on | off\n' +
      '/quiet on 23:00 07:00 - ساعات سکوت\n' +
      '/quiet off\n' +
      (isAdmin(ctx.chat.id)
        ? '*ادمین:*\n/list\n/add url <آدرس>\n/add ip <آدرس>\n/remove <id>\n/enable <id>\n/disable <id>'
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
    const name = escapeMdSimple(t.name || t.address);
    const addr = escapeMdSimple(t.address);
    const emoji = t.lastStatus === 'up' ? '🟢' : t.lastStatus === 'down' ? '🔴' : '⚪';
    let s = `${emoji} *${name}* - \`${addr}\`\n`;
    s += `وضعیت: ${t.lastStatus || 'unknown'}`;
    if (t.lastCheckedAt) s += ` | چک: ${new Date(t.lastCheckedAt).toISOString()}`;
    if (t.lastLatencyMs != null) s += ` | ${t.lastLatencyMs}ms`;
    if (t.lastHttpStatus != null) s += ` | HTTP ${t.lastHttpStatus}`;
    if (t.lastError) s += `\nخطا: ${escapeMdSimple(t.lastError)}`;
    return s;
  }

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

  return bot;
}
