param(
    [string]$message = $(Read-Host "Введите сообщение коммита")
)

if ([string]::IsNullOrWhiteSpace($message)) {
    Write-Host "❌ Сообщение не может быть пустым!" -ForegroundColor Red
    exit 1
}

Write-Host "`n🚀 Начинаю push..." -ForegroundColor Cyan
Write-Host "─" * 50 -ForegroundColor DarkGray

try {
    Write-Host "1. Добавляю файлы..." -ForegroundColor Yellow -NoNewline
    git add .
    Write-Host " ✓" -ForegroundColor Green
    
    Write-Host "2. Создаю коммит..." -ForegroundColor Yellow -NoNewline
    git commit -m $message
    Write-Host " ✓" -ForegroundColor Green
    
    Write-Host "3. Отправляю в репозиторий..." -ForegroundColor Yellow -NoNewline
    git push
    Write-Host " ✓" -ForegroundColor Green
    
    Write-Host "`n✅ Успешно выполнено!" -ForegroundColor Green
    Write-Host "Сообщение коммита: `"$message`"" -ForegroundColor Gray
    
    Write-Host "`n📋 Последние 5 коммитов:" -ForegroundColor Cyan
    Write-Host "─" * 50 -ForegroundColor DarkGray
    git log --oneline -5
    
    Write-Host "─" * 50 -ForegroundColor DarkGray
    Write-Host "✨ Готово! Все изменения отправлены." -ForegroundColor Green
}
catch {
    Write-Host "`n❌ Произошла ошибка!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}