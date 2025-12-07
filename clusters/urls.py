from django.urls import path
from . import views

urlpatterns = [
    path('connections/', views.server_connections, name='server_connections'),
    path('connections/create/', views.create_connection, name='create_connection'),
    path('connections/update/<int:connection_id>/', views.update_connection, name='update_connection'),
    path('connections/delete/<int:connection_id>/', views.delete_connection, name='delete_connection'),
    path('clusters/<int:connection_id>/', views.get_clusters, name='get_clusters'),
    path('clusters/<int:connection_id>/insert/', views.insert_cluster, name='insert_cluster'),
    path('clusters/<int:connection_id>/<str:cluster_uuid>/', views.get_cluster_details, name='get_cluster_details'),
    path('clusters/<int:connection_id>/<str:cluster_uuid>/update/', views.update_cluster, name='update_cluster'),
    path('clusters/<int:connection_id>/<str:cluster_uuid>/remove/', views.remove_cluster, name='remove_cluster'),
    path('sessions/<int:connection_id>/', views.get_sessions, name='get_sessions'),
    path('sessions/terminate/', views.terminate_sessions, name='terminate_sessions'),
    path('infobases/<int:connection_id>/', views.get_infobases, name='get_infobases'),
    path('servers/<int:connection_id>/', views.get_servers, name='get_servers'),
]