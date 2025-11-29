from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from core.models import Profile
import os

class Command(BaseCommand):
    help = 'Создает администратора по умолчанию'

    def handle(self, *args, **options):
        username = os.getenv('DEFAULT_ADMIN_USERNAME', 'Администратор')
        password = os.getenv('DEFAULT_ADMIN_PASSWORD', '123')
        
        if User.objects.filter(username=username).exists():
            self.stdout.write(self.style.WARNING(f'Пользователь {username} уже существует'))
            return
            
        user = User.objects.create_user(username=username, password=password)
        Profile.objects.create(user=user, role='admin')
        
        self.stdout.write(
            self.style.SUCCESS(f'Создан администратор: {username}/{password}')
        )