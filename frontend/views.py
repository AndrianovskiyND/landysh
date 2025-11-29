from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from core.models import Profile

@login_required
def dashboard(request):
    """Основная панель управления"""
    try:
        profile = Profile.objects.get(user=request.user)
        is_admin = profile.is_admin()
    except Profile.DoesNotExist:
        # Если профиля нет, создаем его с ролью пользователя по умолчанию
        profile = Profile.objects.create(user=request.user, role='user')
        is_admin = False
    
    print(f"DEBUG: User {request.user.username}, is_admin: {is_admin}")  # Для отладки
    
    context = {
        'is_admin': is_admin,
        'username': request.user.username,
    }
    return render(request, 'frontend/index.html', context)