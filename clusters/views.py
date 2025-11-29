import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from .models import ServerConnection
from users.models import UserGroup
from .rac_client import RACClient

@login_required
def server_connections(request):
    """Возвращает список подключений пользователя"""
    user_groups = request.user.user_groups.all()
    connections = ServerConnection.objects.filter(user_group__in=user_groups)
    
    data = []
    for conn in connections:
        data.append({
            'id': conn.id,
            'display_name': conn.display_name,
            'server_host': conn.server_host,
            'ras_port': conn.ras_port,
            'created_at': conn.created_at.isoformat(),
        })
    
    return JsonResponse({'connections': data})

@login_required
@csrf_exempt
def create_connection(request):
    """Создает новое подключение"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            # Автоматически создаем группу для пользователя, если нет
            user_groups = request.user.user_groups.all()
            if not user_groups.exists():
                group_name = f"Группа {request.user.username}"
                user_group = UserGroup.objects.create(name=group_name, created_by=request.user)
                user_group.members.add(request.user)
            else:
                user_group = user_groups.first()
            
            connection = ServerConnection.objects.create(
                user_group=user_group,
                display_name=data['display_name'],
                server_host=data['server_host'],
                ras_port=data['ras_port'],
                cluster_admin=data.get('cluster_admin', ''),
                cluster_password=data.get('cluster_password', '')
            )
            
            return JsonResponse({'success': True, 'connection_id': connection.id})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
def get_clusters(request, connection_id):
    """Получает список кластеров для подключения"""
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        rac_client = RACClient(connection)
        result = rac_client.get_cluster_list()
        
        if result['success']:
            # Здесь нужно будет парсить вывод rac cluster list
            return JsonResponse({'success': True, 'clusters': []})
        else:
            return JsonResponse({'success': False, 'error': result['error']})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
def get_sessions(request, connection_id):
    """Получает список сеансов для подключения"""
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        cluster_uuid = request.GET.get('cluster')
        
        rac_client = RACClient(connection)
        result = rac_client.get_session_list(cluster_uuid=cluster_uuid)
        
        if result['success']:
            # Здесь нужно будет парсить вывод rac session list
            return JsonResponse({'success': True, 'sessions': []})
        else:
            return JsonResponse({'success': False, 'error': result['error']})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
@csrf_exempt
def terminate_sessions(request):
    """Завершает сеансы"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            connection_id = data['connection_id']
            session_uuids = data['session_uuids']
            cluster_uuid = data['cluster_uuid']
            
            connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
            rac_client = RACClient(connection)
            
            results = []
            for session_uuid in session_uuids:
                result = rac_client.terminate_session(session_uuid, cluster_uuid)
                results.append({
                    'session_uuid': session_uuid,
                    'success': result['success'],
                    'error': result.get('error')
                })
            
            return JsonResponse({'success': True, 'results': results})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
def get_infobases(request, connection_id):
    """Получает список информационных баз для подключения"""
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        cluster_uuid = request.GET.get('cluster')
        
        rac_client = RACClient(connection)
        result = rac_client.get_infobase_summary_list(cluster_uuid)
        
        if result['success']:
            # Здесь нужно будет парсить вывод rac infobase summary list
            return JsonResponse({'success': True, 'infobases': []})
        else:
            return JsonResponse({'success': False, 'error': result['error']})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
def get_servers(request, connection_id):
    """Получает список рабочих серверов для подключения"""
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        cluster_uuid = request.GET.get('cluster')
        
        rac_client = RACClient(connection)
        result = rac_client.get_server_list(cluster_uuid)
        
        if result['success']:
            # Здесь нужно будет парсить вывод rac server list
            return JsonResponse({'success': True, 'servers': []})
        else:
            return JsonResponse({'success': False, 'error': result['error']})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})