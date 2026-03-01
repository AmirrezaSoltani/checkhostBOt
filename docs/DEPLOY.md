# راهنمای نصب روی سرور و دیپلوی

## پیش‌نیازهای سرور (۱۹۲.۱۶۸.۱۷۸.۳۷)

روی سرور فقط **Docker** و **Docker Compose** لازم است (بدون نصب Node یا MongoDB جدا؛ همه چیز داخل کانتینر اجرا می‌شود).

### نصب Docker و Docker Compose (اوبونتو/دبیان)

اگر هنوز نصب نکردی:

```bash
# به سرور SSH بزن
ssh root@192.168.178.37

# نصب Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# اضافه کردن کاربر فعلی به گروه docker (اختیاری، برای اجرا بدون root)
usermod -aG docker $USER
```

**Docker Compose (پلاگین رسمی):** در اسکریپت نصب بالا معمولاً همراه Docker نصب می‌شود. اگر دستور `docker compose` (با فاصله، بدون خط تیره) کار نکرد:

```bash
apt-get update && apt-get install -y docker-compose-plugin
```

بررسی:

```bash
docker --version
docker compose version
```

### دسترسی SSH

از **همان ماشینی که پروژه را داری** باید با SSH به سرور وصل شوی:

- یا با **کلید SSH** (پیشنهادی):
  ```bash
  ssh-copy-id root@192.168.178.37
  ```
- یا با **پسورد** (در هر اجرای `deploy.sh` پسورد را می‌خواهد).

---

## نحوه دیپلوی

۱. در **همان پوشه پروژه** (روی لپ‌تاپ/ماشین محلی) فایل `.env` را در صورت نیاز برای تست محلی پر کن؛ برای سرور می‌توانی بعد از اولین دیپلوی روی سرور ویرایشش کنی.

۲. اسکریپت را اجرا کن:

```bash
chmod +x deploy.sh
./deploy.sh
```

۳. **اولین بار** روی سرور فایل `.env` را ویرایش کن و `BOT_TOKEN` و در صورت تمایل `ADMIN_CHAT_IDS` را بگذار:

```bash
ssh root@192.168.178.37
nano /opt/checkhost-bot/.env
# BOT_TOKEN=...
# ADMIN_CHAT_IDS=123456789
```

سپس کانتینرها را یک بار دیگر بالا بیاور:

```bash
cd /opt/checkhost-bot && docker compose up -d
```

---

## تنظیمات اختیاری اسکریپت

با متغیر محیطی می‌توانی آدرس سرور، کاربر و مسیر را عوض کنی:

```bash
export DEPLOY_HOST=192.168.178.37
export DEPLOY_USER=ubuntu
export DEPLOY_DIR=/home/ubuntu/checkhost-bot
./deploy.sh
```

یا در یک خط:

```bash
DEPLOY_USER=ubuntu DEPLOY_DIR=/opt/checkhost-bot ./deploy.sh
```

---

## دستورات مفید روی سرور

| کار | دستور |
|-----|--------|
| مشاهده لاگ ربات | `docker logs -f checkhost-bot` |
| وضعیت سرویس‌ها | `cd /opt/checkhost-bot && docker compose ps` |
| ری‌استارت | `cd /opt/checkhost-bot && docker compose restart bot` |
| قطع همه | `cd /opt/checkhost-bot && docker compose down` |
