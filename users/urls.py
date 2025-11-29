from django.urls import path
from . import views

urlpatterns = [
    path('groups/', views.user_groups, name='user_groups'),
    path('groups/create/', views.create_group, name='create_group'),
    path('list/', views.user_list, name='user_list'),
    path('create/', views.create_user, name='create_user'),
    path('groups/all/', views.all_groups, name='all_groups'),
    path('groups/assign/', views.assign_user_to_group, name='assign_user_to_group'),
]