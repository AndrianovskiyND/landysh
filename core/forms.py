from django import forms
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth import authenticate
from django.core.exceptions import ValidationError


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
    """
    new_password1 = forms.CharField(
        label='Новый пароль',
        widget=forms.PasswordInput(attrs={
            'placeholder': 'Введите новый пароль',
            'class': 'form-control'
        }),
        min_length=6
    )
    new_password2 = forms.CharField(
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
        
        return cleaned_data

