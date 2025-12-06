param(
    [string]$message = $(Read-Host "Введите сообщение коммита")
)

if ([string]::IsNullOrWhiteSpace($message)) {
    Write-Host "Сообщение не может быть пустым!" -ForegroundColor Red
    exit 1
}

Write-Host "Выполняю: git add ." -ForegroundColor Green
git add .

Write-Host "Выполняю: git commit -m `"$message`"" -ForegroundColor Green
git commit -m $message

Write-Host "Выполняю: git push" -ForegroundColor Green
git push