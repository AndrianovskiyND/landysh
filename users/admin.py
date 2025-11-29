from django.contrib import admin
from .models import UserGroup

@admin.register(UserGroup)
class UserGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'created_by', 'created_at', 'get_members_count')
    filter_horizontal = ('members',)
    list_filter = ('created_by',)
    
    def get_members_count(self, obj):
        return obj.members.count()
    get_members_count.short_description = 'Количество участников'