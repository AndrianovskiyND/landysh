import json
import os
from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.contrib.auth import update_session_auth_hash
from .models import SystemSettings, Profile
from .forms import ForcePasswordChangeForm

@login_required
def system_settings(request):
    """Возвращает настройки системы (только для админов)"""
    try:
        profile = Profile.objects.get(user=request.user)
        if not profile.is_admin():
            return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
    except Profile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
    
    settings_data = {
        'rac_path': SystemSettings.get_setting('rac_path', '/opt/1cv8/x86_64/8.3.27.1860/rac'),
        'session_timeout': SystemSettings.get_setting('session_timeout', '30'),
        'max_connections': SystemSettings.get_setting('max_connections', '10'),
        'log_level': SystemSettings.get_setting('log_level', 'INFO'),
        'backup_enabled': SystemSettings.get_setting('backup_enabled', 'false'),
        'smtp_server': SystemSettings.get_setting('smtp_server', ''),
        'smtp_port': SystemSettings.get_setting('smtp_port', '587'),
        'notification_email': SystemSettings.get_setting('notification_email', ''),
    }
    
    return JsonResponse({'success': True, 'settings': settings_data})

@login_required
@csrf_exempt
def update_setting(request):
    """Обновляет настройку системы (только для админов)"""
    if request.method == 'POST':
        try:
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
            
            data = json.loads(request.body)
            key = data.get('key')
            value = data.get('value')
            
            if not key:
                return JsonResponse({'success': False, 'error': 'Ключ настройки обязателен'})
            
            # Валидация путей
            if key == 'rac_path' and value:
                if not os.path.exists(value):
                    return JsonResponse({'success': False, 'error': 'Файл RAC не найден по указанному пути'})
            
            SystemSettings.set_setting(key, value, f"Обновлено пользователем {request.user.username}")
            
            return JsonResponse({'success': True})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})


@login_required
def force_password_change(request):
    """Страница принудительной смены пароля"""
    
    # Проверяем нужна ли смена пароля
    try:
        profile = Profile.objects.get(user=request.user)
        if not profile.force_password_change:
            return redirect('/')
    except Profile.DoesNotExist:
        return redirect('/')
    
    if request.method == 'POST':
        form = ForcePasswordChangeForm(request.POST)
        if form.is_valid():
            # Устанавливаем новый пароль
            new_password = form.cleaned_data['new_password1']
            request.user.set_password(new_password)
            request.user.save()
            
            # Сбрасываем флаг
            profile.force_password_change = False
            profile.save()
            
            # Обновляем сессию
            update_session_auth_hash(request, request.user)
            
            return redirect('/')
    else:
        form = ForcePasswordChangeForm()
    
    return render(request, 'registration/force_password_change.html', {'form': form})