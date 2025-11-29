from django.urls import path
from . import views

urlpatterns = [
    path('connections/', views.server_connections, name='server_connections'),
    path('connections/create/', views.create_connection, name='create_connection'),
    path('clusters/<int:connection_id>/', views.get_clusters, name='get_clusters'),
    path('sessions/<int:connection_id>/', views.get_sessions, name='get_sessions'),
    path('sessions/terminate/', views.terminate_sessions, name='terminate_sessions'),
    path('infobases/<int:connection_id>/', views.get_infobases, name='get_infobases'),
    path('servers/<int:connection_id>/', views.get_servers, name='get_servers'),
]