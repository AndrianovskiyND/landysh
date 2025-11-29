from django.db import models
from django.contrib.auth.models import User
from django_cryptography.fields import encrypt

class UserGroup(models.Model):
    name = models.CharField(max_length=255, verbose_name='Название группы')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name='Создатель')
    created_at = models.DateTimeField(auto_now_add=True)
    members = models.ManyToManyField(User, related_name='user_groups', verbose_name='Участники')
    
    class Meta:
        verbose_name = 'Группа пользователей'
        verbose_name_plural = 'Группы пользователей'

    def __str__(self):
        return self.name