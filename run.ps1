Write-Host "🚀 Запуск Django проекта..." -ForegroundColor Cyan
Write-Host "─" * 50 -ForegroundColor DarkGray

# Проверяем, существует ли виртуальное окружение
if (-Not (Test-Path "venv")) {
    Write-Host "❌ Папка venv не найдена!" -ForegroundColor Red
    Write-Host "Создайте виртуальное окружение: python -m venv venv" -ForegroundColor Yellow
    exit 1
}

# Проверяем, существует ли manage.py
if (-Not (Test-Path "manage.py")) {
    Write-Host "❌ Файл manage.py не найден!" -ForegroundColor Red
    Write-Host "Убедитесь, что вы находитесь в корневой папке проекта" -ForegroundColor Yellow
    exit 1
}

Write-Host "1. Активирую виртуальное окружение..." -ForegroundColor Yellow
& "venv\Scripts\activate.ps1"

Write-Host "2. Запускаю сервер Django..." -ForegroundColor Yellow
Write-Host "   Сервер будет доступен по адресу: http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "─" * 50 -ForegroundColor DarkGray

python manage.py runserver