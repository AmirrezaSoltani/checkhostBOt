# CheckHost Bot

A Telegram bot that monitors the **reachability of websites and IP addresses** and sends a notification **only when the status changes** (Up ↔ Down).

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

## Features

- **URL/Domain checks** over HTTP(S) (HEAD/GET) with configurable timeout
- **IP checks** via TCP connect on a given port (80 / 443 / 22 or custom)
- Last known status persisted in **MongoDB**
- Telegram alerts **only on state changes** (no spam)
- Per-chat notification settings: on/off, quiet hours, Up/Down filters
- Optional **REST API** (Express) for managing targets and reading event history
- Ready to deploy with **Docker + docker-compose**

## Requirements

- Node.js 20+ (or just Docker)
- MongoDB
- A bot token from [@BotFather](https://t.me/BotFather)

## Run with Docker (recommended)

1. Create a `.env` file in the project root:

```env
BOT_TOKEN=123456:ABC...
ADMIN_CHAT_IDS=123456789,987654321
CHECK_INTERVAL_SECONDS=60
API_TOKEN=optional-secret-for-api
```

2. Start the stack:

```bash
docker compose up -d
```

3. Open the bot in Telegram and send `/start`. Admin chats can add targets with `/add url https://example.com` or `/add ip 8.8.8.8`.

## Run without Docker

```bash
npm install
export BOT_TOKEN=...
export MONGO_URI=mongodb://localhost:27017/checkhostbot
npm start
```

## Bot commands

| Command | Description |
|--------|--------|
| `/start` | Register the chat and show help |
| `/help` | List all commands |
| `/status` | Status of all targets |
| `/status <name\|id>` | Status of a single target |
| `/notify on \| off` | Enable / disable notifications |
| `/notify up on \| off` | Notify when a target goes Up |
| `/notify down on \| off` | Notify when a target goes Down |
| `/notify changes on \| off` | Notify on state changes only |
| `/quiet on 23:00 07:00` | Set quiet hours |
| `/quiet off` | Disable quiet hours |

**Admin commands** (only when `ADMIN_CHAT_IDS` is set):

| Command | Description |
|--------|--------|
| `/list` | List all targets |
| `/add url <address>` | Add a URL target |
| `/add ip <address>` | Add an IP target |
| `/remove <id>` | Remove a target |
| `/enable <id>` | Enable a target |
| `/disable <id>` | Disable a target |

## REST API (optional)

Enabled when `API_PORT` (and optionally `API_TOKEN`) is set:

- `GET /health` — service health check
- `GET /targets` — list targets
- `POST /targets` — create a target (body: `type, address, name?, checkMethod?, tcpPort?, intervalSeconds?, enabled?`)
- `PATCH /targets/:id` — update a target
- `DELETE /targets/:id` — delete a target
- `GET /events?targetId=...&limit=50` — event history

Authentication: `Authorization: Bearer <API_TOKEN>` header or `?token=<API_TOKEN>`.

## Environment variables

| Variable | Default | Description |
|--------|---------|--------|
| `BOT_TOKEN` | — | Telegram bot token (required) |
| `MONGO_URI` | `mongodb://localhost:27017/checkhostbot` | MongoDB connection string |
| `CHECK_INTERVAL_SECONDS` | 60 | Check interval (seconds) |
| `HTTP_TIMEOUT_MS` | 5000 | HTTP timeout |
| `TCP_TIMEOUT_MS` | 3000 | TCP timeout |
| `ADMIN_CHAT_IDS` | — | Admin chat IDs (comma-separated) |
| `API_PORT` | 3000 | API port |
| `API_TOKEN` | — | Optional API token |
| `QUIET_HOURS_TIMEZONE` | Europe/Berlin | Time zone for quiet hours |
| `LOG_LEVEL` | info | Log level |

## Project structure

```
src/
├── bot/        Telegram bot (grammY)
├── monitor/    Checks and scheduling
├── db/         MongoDB models
├── config/     Env config and logger
├── utils/      Notifier, rate limiter
└── api/        Express API
Dockerfile
docker-compose.yml
```

## License

MIT
