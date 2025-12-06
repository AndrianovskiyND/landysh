from django.shortcuts import redirect
from django.urls import reverse
from .models import Profile


class ForcePasswordChangeMiddleware:
    """
    Middleware для проверки требования смены пароля.
    Если у пользователя установлен флаг force_password_change,
    перенаправляет на страницу обязательной смены пароля.
    """
    
    EXEMPT_URLS = [
        '/accounts/logout/',
        '/accounts/force-password-change/',
        '/static/',
    ]
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Пропускаем неаутентифицированных пользователей
        if not request.user.is_authenticated:
            return self.get_response(request)
        
        # Пропускаем разрешённые URL
        path = request.path
        for exempt_url in self.EXEMPT_URLS:
            if path.startswith(exempt_url):
                return self.get_response(request)
        
        # Проверяем флаг force_password_change
        try:
            profile = Profile.objects.get(user=request.user)
            if profile.force_password_change:
                return redirect('force_password_change')
        except Profile.DoesNotExist:
            pass
        
        return self.get_response(request)

