from django.contrib import admin
from django.urls import path, include
from django.contrib.auth import views as auth_views
from core.forms import CustomAuthenticationForm
from core.views import force_password_change

urlpatterns = [
    path('admin/', admin.site.urls),
    # Аутентификация с кастомной формой
    path('accounts/login/', auth_views.LoginView.as_view(
        authentication_form=CustomAuthenticationForm
    ), name='login'),
    path('accounts/logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('accounts/force-password-change/', force_password_change, name='force_password_change'),
    # Приложения
    path('', include('frontend.urls')),
    path('api/users/', include('users.urls')),
    path('api/clusters/', include('clusters.urls')),
    path('api/system/', include('core.urls')),
]