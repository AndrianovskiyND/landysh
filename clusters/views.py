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
        group = conn.user_group
        members_count = group.members.count()
        # Подсчитываем все подключения в группе (все участники имеют доступ ко всем подключениям)
        connections_in_group = ServerConnection.objects.filter(
            user_group=group
        ).count()
        
        data.append({
            'id': conn.id,
            'display_name': conn.display_name,
            'server_host': conn.server_host,
            'ras_port': conn.ras_port,
            'cluster_admin': conn.cluster_admin or '',
            'created_at': conn.created_at.isoformat(),
            'group_id': group.id,
            'group_name': group.name,
            'group_members_count': members_count,
            'user_connections_in_group': connections_in_group,  # Все подключения в группе
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
@csrf_exempt
def update_connection(request, connection_id):
    """Обновляет существующее подключение"""
    if request.method == 'POST':
        try:
            # Проверяем доступ к подключению
            connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
            
            data = json.loads(request.body)
            
            # Обновляем поля
            connection.display_name = data.get('display_name', connection.display_name)
            connection.server_host = data.get('server_host', connection.server_host)
            connection.ras_port = data.get('ras_port', connection.ras_port)
            connection.cluster_admin = data.get('cluster_admin', connection.cluster_admin)
            
            # Пароль обновляем только если указан новый
            if data.get('cluster_password'):
                connection.cluster_password = data.get('cluster_password')
            
            connection.save()
            
            return JsonResponse({'success': True, 'connection_id': connection.id})
            
        except ServerConnection.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Подключение не найдено или нет доступа'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
@csrf_exempt
def delete_connection(request, connection_id):
    """Удаляет подключение с проверкой количества пользователей в группе"""
    if request.method == 'POST':
        try:
            # Проверяем доступ к подключению
            connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
            group = connection.user_group
            group_name = group.name
            
            # Подсчитываем количество пользователей в группе
            members_count = group.members.count()
            
            # Подсчитываем количество подключений пользователя в этой группе
            # (до удаления текущего подключения)
            # Все подключения в группе доступны всем участникам группы, поэтому
            # считаем все подключения группы, которые принадлежат этой группе
            user_connections_in_group = ServerConnection.objects.filter(
                user_group=group
            ).count()
            
            # Сохраняем имя подключения для сообщения
            connection_display_name = connection.display_name
            
            # Удаляем подключение
            connection.delete()
            
            # Проверяем, остались ли подключения в группе после удаления
            remaining_connections_in_group = ServerConnection.objects.filter(
                user_group=group
            ).count()
            
            # Проверяем, остались ли у пользователя подключения в этой группе
            # (пользователь имеет доступ ко всем подключениям группы, если он в группе)
            remaining_user_connections = remaining_connections_in_group
            
            result_message = f'Подключение "{connection_display_name}" удалено.'
            group_action = None
            
            # Сценарий 1: Группа из 1 пользователя и удалены все подключения → удалить группу
            if members_count == 1 and remaining_connections_in_group == 0:
                group.delete()
                group_action = 'deleted'
                result_message = f'Подключение "{connection_display_name}" удалено. Группа "{group_name}" удалена, так как вы были единственным участником.'
            
            # Сценарий 2: Группа из 2+ пользователей и удалены все подключения → исключить пользователя из группы
            elif members_count > 1 and remaining_connections_in_group == 0:
                group.members.remove(request.user)
                group_action = 'removed'
                remaining_members = members_count - 1
                result_message = f'Подключение "{connection_display_name}" удалено. Вы удаляете все подключения и будете исключены из группы "{group_name}", в которой останется {remaining_members} участников.'
            
            # Сценарий 3: В группе остались подключения → ничего не делать с группой
            else:
                group_action = 'kept'
            
            return JsonResponse({
                'success': True,
                'message': result_message,
                'group_action': group_action,
                'group_name': group_name if group_action != 'deleted' else None,
                'remaining_members': members_count - 1 if group_action == 'removed' else None
            })
            
        except ServerConnection.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Подключение не найдено или нет доступа'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
def get_clusters(request, connection_id):
    """Получает список кластеров для подключения (выполняет команду cluster list)"""
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        rac_client = RACClient(connection)
        result = rac_client.get_cluster_list()
        
        if result['success']:
            return JsonResponse({
                'success': True, 
                'output': result['output'],
                'rac_path': rac_client.rac_path
            })
        else:
            # Обработка ошибок
            error = result.get('error', 'Неизвестная ошибка')
            
            # Проверяем, не связана ли ошибка с путём к RAC
            import os
            if not os.path.exists(rac_client.rac_path):
                error = f'Путь к RAC не найден: {rac_client.rac_path}'
            
            return JsonResponse({
                'success': False, 
                'error': error,
                'rac_path': rac_client.rac_path
            })
            
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