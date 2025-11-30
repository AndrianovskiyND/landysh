from django.urls import path
from . import views

urlpatterns = [
    path('groups/', views.user_groups, name='user_groups'),
    path('groups/create/', views.create_group, name='create_group'),
    path('list/', views.user_list, name='user_list'),
    path('create/', views.create_user, name='create_user'),
    path('groups/all/', views.all_groups, name='all_groups'),
    path('groups/assign/', views.assign_user_to_group, name='assign_user_to_group'),
    # Новые endpoints
    path('update/', views.update_user, name='update_user'),
    path('change-password/', views.change_password, name='change_password'),
    path('toggle-active/', views.toggle_active, name='toggle_active'),
    path('groups/update/', views.update_group, name='update_group'),
    path('groups/delete/', views.delete_group, name='delete_group'),
    path('request-password-change/', views.request_password_change, name='request_password_change'),
]