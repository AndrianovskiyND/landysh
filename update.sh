#!/bin/bash

# Скрипт обновления Django приложения Ландыш на РЕД ОС
# Использование: sudo ./update.sh

set -e  # Остановка при ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Конфигурация
PROJECT_DIR="/data/landysh"
VENV_DIR="$PROJECT_DIR/venv"
SERVICE_NAME="django-landysh"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Обновление Django приложения Ландыш${NC}"
echo -e "${GREEN}========================================${NC}"

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Ошибка: Скрипт должен быть запущен с правами root (используйте sudo)${NC}"
    exit 1
fi

# Проверка наличия директории проекта
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Ошибка: Директория проекта $PROJECT_DIR не найдена${NC}"
    echo -e "${YELLOW}Сначала выполните первичное развертывание: ./deploy.sh${NC}"
    exit 1
fi

# Переход в директорию проекта
cd "$PROJECT_DIR"

# Проверка наличия manage.py
if [ ! -f "manage.py" ]; then
    echo -e "${RED}Ошибка: Файл manage.py не найден в $PROJECT_DIR${NC}"
    exit 1
fi

# Проверка наличия виртуального окружения
if [ ! -d "$VENV_DIR" ]; then
    echo -e "${RED}Ошибка: Виртуальное окружение не найдено${NC}"
    echo -e "${YELLOW}Сначала выполните первичное развертывание: ./deploy.sh${NC}"
    exit 1
fi

# Остановка сервиса перед обновлением
echo -e "${YELLOW}Остановка сервиса...${NC}"
if systemctl is-active --quiet "$SERVICE_NAME"; then
    systemctl stop "$SERVICE_NAME"
    echo -e "${GREEN}✓ Сервис остановлен${NC}"
else
    echo -e "${YELLOW}Сервис не был запущен${NC}"
fi

# Активация виртуального окружения
echo -e "${YELLOW}Активация виртуального окружения...${NC}"
source venv/bin/activate

# Обновление pip
echo -e "${YELLOW}Обновление pip...${NC}"
pip install --upgrade pip --quiet
echo -e "${GREEN}✓ pip обновлен${NC}"

# Обновление зависимостей
echo -e "${YELLOW}Обновление зависимостей из requirements.txt...${NC}"
if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}Ошибка: Файл requirements.txt не найден${NC}"
    exit 1
fi

pip install -r requirements.txt --upgrade --quiet
echo -e "${GREEN}✓ Зависимости обновлены${NC}"

# Выполнение миграций
echo -e "${YELLOW}Выполнение миграций базы данных...${NC}"
python manage.py makemigrations --noinput
python manage.py migrate --noinput
echo -e "${GREEN}✓ Миграции выполнены${NC}"

# Сбор статических файлов (если используется)
if python manage.py help collectstatic &> /dev/null; then
    echo -e "${YELLOW}Сбор статических файлов...${NC}"
    python manage.py collectstatic --noinput --clear || true
    echo -e "${GREEN}✓ Статические файлы собраны${NC}"
fi

# Перезагрузка systemd (на случай изменения конфигурации сервиса)
echo -e "${YELLOW}Перезагрузка systemd...${NC}"
systemctl daemon-reload
echo -e "${GREEN}✓ Systemd перезагружен${NC}"

# Запуск сервиса
echo -e "${YELLOW}Запуск сервиса...${NC}"
systemctl start "$SERVICE_NAME"

# Проверка статуса
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✓ Сервис успешно запущен${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Обновление завершено успешно!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${YELLOW}Приложение доступно по адресу: http://0.0.0.0:8000${NC}"
    echo -e "${YELLOW}Проверить статус: systemctl status $SERVICE_NAME${NC}"
    echo -e "${YELLOW}Просмотр логов: journalctl -u $SERVICE_NAME -f${NC}"
else
    echo -e "${RED}Ошибка: Сервис не запустился${NC}"
    echo -e "${YELLOW}Проверьте логи: journalctl -u $SERVICE_NAME${NC}"
    exit 1
fi

