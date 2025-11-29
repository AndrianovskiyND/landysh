from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.models import User
from .models import Profile

class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    verbose_name_plural = 'Профиль'

class CustomUserAdmin(UserAdmin):
    inlines = (ProfileInline,)
    list_display = ('username', 'email', 'first_name', 'last_name', 'get_role', 'is_staff')
    list_filter = ('profile__role', 'is_staff', 'is_superuser')

    def get_role(self, obj):
        return obj.profile.get_role_display()
    get_role.short_description = 'Роль'

admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)