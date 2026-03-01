#!/usr/bin/env bash
set -e

# ============ تنظیمات (در صورت نیاز تغییر بده) ============
SERVER="${DEPLOY_HOST:-192.168.178.37}"
USER="${DEPLOY_USER:-liana}"
REMOTE_DIR="${DEPLOY_DIR:-/opt/checkhost-bot}"
SSH_OPTS="${DEPLOY_SSH_OPTS:--o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new}"
# ==========================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}>>> دیپلوی روی ${USER}@${SERVER}:${REMOTE_DIR}${NC}"

# بررسی اتصال SSH
if ! ssh $SSH_OPTS "${USER}@${SERVER}" "echo ok" &>/dev/null; then
  echo -e "${RED}اتصال SSH به ${USER}@${SERVER} برقرار نشد. کلید SSH یا پسورد را چک کن.${NC}"
  echo "  مثال با کاربر دیگر: DEPLOY_USER=ubuntu ./deploy.sh"
  exit 1
fi

# ساخت پوشه روی سرور
ssh $SSH_OPTS "${USER}@${SERVER}" "mkdir -p ${REMOTE_DIR}"

# کپی فایل‌ها (بدون node_modules و .git و .env)
echo -e "${YELLOW}>>> کپی فایل‌ها با rsync...${NC}"
rsync -avz --delete \
  -e "ssh $SSH_OPTS" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  . "${USER}@${SERVER}:${REMOTE_DIR}/"

# اگر .env روی سرور نیست، از .env.example کپی کن
ssh $SSH_OPTS "${USER}@${SERVER}" "cd ${REMOTE_DIR} && if [ ! -f .env ]; then cp .env.example .env 2>/dev/null || true; echo -e \"${YELLOW}فایل .env روی سرور نبود؛ از .env.example کپی شد. حتماً مقادیر (مثل BOT_TOKEN) را ویرایش کن.${NC}\"; fi"

# اجرای Docker
echo -e "${YELLOW}>>> اجرای docker compose...${NC}"
ssh $SSH_OPTS "${USER}@${SERVER}" "cd ${REMOTE_DIR} && docker compose up -d --build"

echo -e "${GREEN}>>> دیپلوی تمام شد.${NC}"
echo "  لاگ ربات: ssh ${USER}@${SERVER} 'docker logs -f checkhost-bot'"
echo "  وضعیت:   ssh ${USER}@${SERVER} 'docker compose -f ${REMOTE_DIR}/docker-compose.yml ps'"
