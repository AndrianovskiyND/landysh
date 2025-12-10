from django.db import models
from django.contrib.auth.models import User
from django_cryptography.fields import encrypt
from users.models import UserGroup

class ConnectionFolder(models.Model):
    """Папка для организации подключений"""
    user_group = models.ForeignKey(UserGroup, on_delete=models.CASCADE, verbose_name='Группа')
    name = models.CharField(max_length=255, verbose_name='Название папки')
    order = models.IntegerField(default=0, verbose_name='Порядок сортировки')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Папка подключений'
        verbose_name_plural = 'Папки подключений'
        ordering = ['order', 'name']
        unique_together = [['user_group', 'name']]  # Уникальное имя папки в рамках группы

    def __str__(self):
        return self.name

class ServerConnection(models.Model):
    user_group = models.ForeignKey(UserGroup, on_delete=models.CASCADE, verbose_name='Группа')
    folder = models.ForeignKey(ConnectionFolder, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='Папка')
    display_name = models.CharField(max_length=255, verbose_name='Отображаемое имя')
    server_host = models.CharField(max_length=255, verbose_name='Сервер')
    ras_port = models.IntegerField(verbose_name='Порт RAS')
    cluster_admin = models.CharField(max_length=255, blank=True, null=True, verbose_name='Логин кластера')
    cluster_password = encrypt(models.CharField(max_length=255, blank=True, null=True, verbose_name='Пароль кластера'))
    agent_user = models.CharField(max_length=255, blank=True, null=True, verbose_name='Логин агента кластера')
    agent_password = encrypt(models.CharField(max_length=255, blank=True, null=True, verbose_name='Пароль агента кластера'))
    order = models.IntegerField(default=0, verbose_name='Порядок сортировки')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Подключение к серверу'
        verbose_name_plural = 'Подключения к серверам'
        ordering = ['order', 'display_name']

    def __str__(self):
        return self.display_name

    def get_connection_string(self):
        return f"{self.server_host}:{self.ras_port}"