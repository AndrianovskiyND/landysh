from django.urls import path
from . import views

urlpatterns = [
    path('settings/', views.system_settings, name='system_settings'),
    path('settings/update/', views.update_setting, name='update_setting'),
]