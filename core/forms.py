from django import forms
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth import authenticate
from django.core.exceptions import ValidationError
from core.models import SystemSettings, Profile
import re


def validate_password_by_policy(password, user_profile):
    """
    Валидирует пароль согласно политике паролей, если пользователь подчиняется политике.
    
    Args:
        password: Пароль для проверки
        user_profile: Профиль пользователя (Profile)
    
    Returns:
        tuple: (is_valid, error_message)
        - is_valid: True если пароль валиден
        - error_message: Сообщение об ошибке или None
    """
    # Если пользователь не подчиняется политике - разрешаем любой пароль
    if not user_profile.subject_to_password_policy:
        return (True, None)
    
    # Получаем настройки политики
    min_length = int(SystemSettings.get_setting('password_min_length', '8'))
    complexity = SystemSettings.get_setting('password_complexity', 'medium')
    
    # Проверка минимальной длины
    if len(password) < min_length:
        return (False, f'Пароль должен содержать минимум {min_length} символов')
    
    # Проверка сложности
    if complexity == 'low':
        # Низкая: только буквы и цифры
        if not re.match(r'^[a-zA-Zа-яА-ЯёЁ0-9]+$', password):
            return (False, 'Пароль должен содержать только буквы и цифры')
    elif complexity == 'medium':
        # Средняя: буквы, цифры, спецсимволы
        has_letter = bool(re.search(r'[a-zA-Zа-яА-ЯёЁ]', password))
        has_digit = bool(re.search(r'[0-9]', password))
        has_special = bool(re.search(r'[^a-zA-Zа-яА-ЯёЁ0-9]', password))
        if not (has_letter and (has_digit or has_special)):
            return (False, 'Пароль должен содержать буквы и цифры или спецсимволы')
    elif complexity == 'high':
        # Высокая: обязательны буквы, цифры, спецсимволы, регистры
        has_upper = bool(re.search(r'[A-ZА-ЯЁ]', password))
        has_lower = bool(re.search(r'[a-zа-яё]', password))
        has_digit = bool(re.search(r'[0-9]', password))
        has_special = bool(re.search(r'[^a-zA-Zа-яА-ЯёЁ0-9]', password))
        if not (has_upper and has_lower and has_digit and has_special):
            return (False, 'Пароль должен содержать заглавные и строчные буквы, цифры и спецсимволы')
    
    return (True, None)


class CustomAuthenticationForm(AuthenticationForm):
    """
    Кастомная форма аутентификации с проверкой блокировки.
    """
    
    def clean(self):
        username = self.cleaned_data.get('username')
        password = self.cleaned_data.get('password')
        
        if username and password:
            # Сначала проверяем существует ли пользователь и активен ли он
            from django.contrib.auth.models import User
            try:
                user = User.objects.get(username=username)
                if not user.is_active:
                    raise ValidationError(
                        'Аккаунт заблокирован. Обратитесь к администратору.',
                        code='inactive'
                    )
            except User.DoesNotExist:
                pass
            
            # Стандартная аутентификация
            self.user_cache = authenticate(
                self.request, 
                username=username, 
                password=password
            )
            
            if self.user_cache is None:
                raise ValidationError(
                    'Неверное имя пользователя или пароль.',
                    code='invalid_login'
                )
            
            # Дополнительная проверка на случай если authenticate вернул пользователя
            if not self.user_cache.is_active:
                raise ValidationError(
                    'Аккаунт заблокирован. Обратитесь к администратору.',
                    code='inactive'
                )
        
        return self.cleaned_data


class ForcePasswordChangeForm(forms.Form):
    """
    Форма для принудительной смены пароля.
    Валидирует пароль согласно политике, если пользователь подчиняется политике.
    """
    def __init__(self, *args, **kwargs):
        self.user = kwargs.pop('user', None)
        super().__init__(*args, **kwargs)
        
        # Определяем минимальную длину в зависимости от политики
        if self.user:
            try:
                profile = Profile.objects.get(user=self.user)
                if profile.subject_to_password_policy:
                    min_length = int(SystemSettings.get_setting('password_min_length', '8'))
                else:
                    min_length = 1  # Если не подчиняется политике - любая длина
            except Profile.DoesNotExist:
                min_length = 8
        else:
            min_length = 8
        
        self.fields['new_password1'] = forms.CharField(
            label='Новый пароль',
            widget=forms.PasswordInput(attrs={
                'placeholder': 'Введите новый пароль',
                'class': 'form-control'
            }),
            min_length=min_length
        )
        self.fields['new_password2'] = forms.CharField(
            label='Подтверждение пароля',
            widget=forms.PasswordInput(attrs={
                'placeholder': 'Повторите пароль',
                'class': 'form-control'
            })
        )
    
    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get('new_password1')
        password2 = cleaned_data.get('new_password2')
        
        if password1 and password2:
            if password1 != password2:
                raise ValidationError('Пароли не совпадают')
            
            # Валидация по политике, если пользователь подчиняется политике
            if self.user:
                try:
                    profile = Profile.objects.get(user=self.user)
                    is_valid, error_message = validate_password_by_policy(password1, profile)
                    if not is_valid:
                        raise ValidationError(error_message)
                except Profile.DoesNotExist:
                    pass
        
        return cleaned_data

