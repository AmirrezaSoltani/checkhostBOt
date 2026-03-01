# CheckHost Bot

ربات تلگرام برای مانیتورینگ دسترسی (Reachability) سایت‌ها و IPها با اعلان **فقط هنگام تغییر وضعیت** (Up↔Down).

## قابلیت‌ها

- چک **URL/Domain** با HTTP(S) (HEAD/GET) و timeout
- چک **IP** با TCP connect روی پورت مشخص (۸۰/۴۴۳/۲۲ یا دلخواه)
- ذخیره آخرین وضعیت در **MongoDB**
- اعلان تلگرام فقط وقتی وضعیت عوض شد
- خاموش/روشن کردن اعلان‌ها، ساعات سکوت، فیلتر Up/Down
- Docker + docker-compose

## نیازمندی‌ها

- Node.js 20+ (یا فقط Docker)
- MongoDB
- توکن ربات از [@BotFather](https://t.me/BotFather)

## اجرا با Docker (پیشنهادی)

1. فایل `.env` در ریشه پروژه بسازید:

```env
BOT_TOKEN=123456:ABC...
ADMIN_CHAT_IDS=123456789,987654321
CHECK_INTERVAL_SECONDS=60
API_TOKEN=optional-secret-for-api
```

2. اجرا:

```bash
docker compose up -d
```

3. در تلگرام ربات را استارت کنید (`/start`) و در صورت نیاز با `/add url https://example.com` یا `/add ip 8.8.8.8` هدف اضافه کنید (فقط برای چت‌های ادمین).

## اجرا بدون Docker

```bash
npm install
export BOT_TOKEN=...
export MONGO_URI=mongodb://localhost:27017/checkhostbot
npm start
```

## دستورات ربات

| دستور | توضیح |
|--------|--------|
| `/start` | ثبت چت و راهنما |
| `/help` | لیست دستورات |
| `/status` | وضعیت همه هدف‌ها |
| `/status <name\|id>` | وضعیت یک هدف |
| `/notify on \| off` | روشن/خاموش اعلان |
| `/notify up on \| off` | اعلان وقتی Up شد |
| `/notify down on \| off` | اعلان وقتی Down شد |
| `/notify changes on \| off` | فقط روی تغییر |
| `/quiet on 23:00 07:00` | ساعات سکوت |
| `/quiet off` | خاموش کردن ساعات سکوت |

**ادمین (فقط اگر `ADMIN_CHAT_IDS` تنظیم شده باشد):**

| دستور | توضیح |
|--------|--------|
| `/list` | لیست همه هدف‌ها |
| `/add url <آدرس>` | اضافه کردن URL |
| `/add ip <آدرس>` | اضافه کردن IP |
| `/remove <id>` | حذف هدف |
| `/enable <id>` | فعال کردن |
| `/disable <id>` | غیرفعال کردن |

## API (اختیاری)

اگر `API_PORT` و در صورت نیاز `API_TOKEN` تنظیم شود:

- `GET /health` — سلامت سرویس
- `GET /targets` — لیست هدف‌ها
- `POST /targets` — ایجاد هدف (body: type, address, name?, checkMethod?, tcpPort?, intervalSeconds?, enabled?)
- `PATCH /targets/:id` — به‌روزرسانی
- `DELETE /targets/:id` — حذف
- `GET /events?targetId=...&limit=50` — تاریخچه رویدادها

احراز هویت: هدر `Authorization: Bearer <API_TOKEN>` یا `?token=<API_TOKEN>`.

## متغیرهای محیطی

| متغیر | پیش‌فرض | توضیح |
|--------|---------|--------|
| `BOT_TOKEN` | — | توکن ربات (الزامی) |
| `MONGO_URI` | `mongodb://localhost:27017/checkhostbot` | اتصال MongoDB |
| `CHECK_INTERVAL_SECONDS` | 60 | فاصله چک (ثانیه) |
| `HTTP_TIMEOUT_MS` | 5000 | تایم‌اوت HTTP |
| `TCP_TIMEOUT_MS` | 3000 | تایم‌اوت TCP |
| `ADMIN_CHAT_IDS` | — | چت‌آیدی ادمین‌ها (جداشده با کاما) |
| `API_PORT` | 3000 | پورت API |
| `API_TOKEN` | — | توکن اختیاری برای API |
| `QUIET_HOURS_TIMEZONE` | Europe/Berlin | منطقه زمانی ساعات سکوت |
| `LOG_LEVEL` | info | سطح لاگ |

## ساختار پروژه

```
src/
  bot/          ربات تلگرام (grammY)
  monitor/      چک و زمان‌بندی
  db/           مدل‌های MongoDB
  config/       env و logger
  utils/        notifier، rate limiter
  api/          Express API
Dockerfile
docker-compose.yml
```

## لایسنس

MIT
