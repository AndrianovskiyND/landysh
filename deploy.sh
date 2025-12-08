#!/bin/bash

# Скрипт первичного развертывания Django приложения Ландыш на РЕД ОС
# Использование: sudo ./deploy.sh

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
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
ADMIN_USERNAME="Администратор"
ADMIN_PASSWORD="123"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Развертывание Django приложения Ландыш${NC}"
echo -e "${GREEN}========================================${NC}"

# Проверка прав root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Ошибка: Скрипт должен быть запущен с правами root (используйте sudo)${NC}"
    exit 1
fi

# Проверка наличия необходимых инструментов
echo -e "${YELLOW}Проверка необходимых инструментов...${NC}"
for cmd in python3 pip3 systemctl; do
    if ! command -v $cmd &> /dev/null; then
        echo -e "${RED}Ошибка: $cmd не найден. Установите его: yum install -y python3 python3-pip${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✓ Все необходимые инструменты установлены${NC}"

# Создание директории проекта, если не существует
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${YELLOW}Создание директории проекта: $PROJECT_DIR${NC}"
    mkdir -p "$PROJECT_DIR"
fi

# Переход в директорию проекта
cd "$PROJECT_DIR"

# Проверка наличия manage.py
if [ ! -f "manage.py" ]; then
    echo -e "${RED}Ошибка: Файл manage.py не найден в $PROJECT_DIR${NC}"
    echo -e "${YELLOW}Убедитесь, что вы скопировали все файлы проекта в $PROJECT_DIR${NC}"
    exit 1
fi

# Создание виртуального окружения
echo -e "${YELLOW}Создание виртуального окружения...${NC}"
if [ -d "$VENV_DIR" ]; then
    echo -e "${YELLOW}Виртуальное окружение уже существует, пропускаем создание${NC}"
else
    python3 -m venv venv
    echo -e "${GREEN}✓ Виртуальное окружение создано${NC}"
fi

# Активация виртуального окружения
echo -e "${YELLOW}Активация виртуального окружения...${NC}"
source venv/bin/activate

# Обновление pip
echo -e "${YELLOW}Обновление pip...${NC}"
pip install --upgrade pip --quiet
echo -e "${GREEN}✓ pip обновлен${NC}"

# Установка зависимостей
echo -e "${YELLOW}Установка зависимостей из requirements.txt...${NC}"
if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}Ошибка: Файл requirements.txt не найден${NC}"
    exit 1
fi

pip install -r requirements.txt --quiet
echo -e "${GREEN}✓ Зависимости установлены${NC}"

# Выполнение миграций
echo -e "${YELLOW}Выполнение миграций базы данных...${NC}"
python manage.py makemigrations --noinput
python manage.py migrate --noinput
echo -e "${GREEN}✓ Миграции выполнены${NC}"

# Создание суперпользователя
echo -e "${YELLOW}Создание суперпользователя...${NC}"
# Проверяем, существует ли уже пользователь
if python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); print('EXISTS' if User.objects.filter(username='$ADMIN_USERNAME').exists() else 'NOT_EXISTS')" 2>/dev/null | grep -q "EXISTS"; then
    echo -e "${YELLOW}Пользователь '$ADMIN_USERNAME' уже существует, пропускаем создание${NC}"
else
    # Создаем суперпользователя через Django shell
    python manage.py shell << EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='$ADMIN_USERNAME').exists():
    User.objects.create_superuser('$ADMIN_USERNAME', '', '$ADMIN_PASSWORD')
    print('Суперпользователь создан')
else:
    print('Суперпользователь уже существует')
EOF
    echo -e "${GREEN}✓ Суперпользователь создан (логин: $ADMIN_USERNAME, пароль: $ADMIN_PASSWORD)${NC}"
fi

# Создание systemd сервиса
echo -e "${YELLOW}Создание systemd сервиса...${NC}"
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Django Landysh App
After=network.target

[Service]
Type=simple
User=root

# Явно указываем русскую локаль для systemd
Environment="LANG=ru_RU.UTF-8"
Environment="LC_ALL=ru_RU.UTF-8"
Environment="LC_CTYPE=ru_RU.UTF-8"
Environment="LC_MESSAGES=ru_RU.UTF-8"

# Для Python
Environment="PYTHONIOENCODING=utf-8"
Environment="PYTHONUTF8=1"

WorkingDirectory=$PROJECT_DIR
ExecStart=$VENV_DIR/bin/python manage.py runserver 0.0.0.0:8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ Systemd сервис создан${NC}"

# Перезагрузка systemd и включение сервиса
echo -e "${YELLOW}Настройка systemd...${NC}"
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
echo -e "${GREEN}✓ Сервис добавлен в автозагрузку${NC}"

# Запуск сервиса
echo -e "${YELLOW}Запуск сервиса...${NC}"
systemctl start "$SERVICE_NAME"

# Проверка статуса
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo -e "${GREEN}✓ Сервис успешно запущен${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Развертывание завершено успешно!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo -e "${YELLOW}Приложение доступно по адресу: http://0.0.0.0:8000${NC}"
    echo -e "${YELLOW}Логин администратора: $ADMIN_USERNAME${NC}"
    echo -e "${YELLOW}Пароль администратора: $ADMIN_PASSWORD${NC}"
    echo -e "${YELLOW}Проверить статус: systemctl status $SERVICE_NAME${NC}"
    echo -e "${YELLOW}Просмотр логов: journalctl -u $SERVICE_NAME -f${NC}"
else
    echo -e "${RED}Ошибка: Сервис не запустился${NC}"
    echo -e "${YELLOW}Проверьте логи: journalctl -u $SERVICE_NAME${NC}"
    exit 1
fi

