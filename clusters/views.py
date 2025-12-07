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
    """
    Удаляет подключение из группы.
    
    Важно: Подключения принадлежат группе, а не отдельным пользователям.
    При удалении подключения оно удаляется для ВСЕХ участников группы.
    
    ЗАЩИТА ОТ САБОТАЖА:
    Если пользователь пытается удалить последнее подключение в группе с 2+ участниками:
    - Подключение НЕ удаляется (остаётся для других участников)
    - Пользователь исключается из группы
    
    Логика:
    - Если это НЕ последнее подключение → удалить подключение
    - Если это последнее подключение:
      - Если в группе 1 участник → удалить подключение и группу
      - Если в группе 2+ участников → НЕ удалять подключение, только исключить пользователя
    """
    if request.method == 'POST':
        try:
            # Проверяем доступ к подключению
            connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
            group = connection.user_group
            group_name = group.name
            
            # Подсчитываем количество пользователей в группе ДО удаления
            members_count = group.members.count()
            
            # Подсчитываем количество подключений в группе ДО удаления
            connections_count_before = ServerConnection.objects.filter(
                user_group=group
            ).count()
            
            # Сохраняем имя подключения для сообщения
            connection_display_name = connection.display_name
            
            result_message = f'Подключение "{connection_display_name}" удалено.'
            group_action = None
            connection_deleted = False
            
            # Сценарий 1: Группа из 1 пользователя → удалить подключение и группу
            if members_count == 1:
                # Удаляем подключение
                connection.delete()
                connection_deleted = True
                # Удаляем группу (каскадно удалятся все подключения, но их уже нет)
                group.delete()
                group_action = 'deleted'
                result_message = f'Подключение "{connection_display_name}" удалено. Группа "{group_name}" удалена, так как вы были единственным участником.'
            
            # Сценарий 2: Группа из 2+ пользователей и это последнее подключение → НЕ удалять подключение, только исключить пользователя
            elif members_count > 1 and connections_count_before == 1:
                # НЕ удаляем подключение - оно остаётся для других участников
                # Только исключаем пользователя из группы
                group.members.remove(request.user)
                group_action = 'removed'
                remaining_members = members_count - 1
                result_message = f'Вы пытаетесь удалить последнее подключение группы "{group_name}". Подключение сохранено для других участников. Вы исключены из группы. В группе останется {remaining_members} участников.'
            
            # Сценарий 3: В группе есть другие подключения → удалить подключение как обычно
            else:
                # Удаляем подключение (оно удалится для ВСЕХ участников группы)
                connection.delete()
                connection_deleted = True
                group_action = 'kept'
                
                # Проверяем, сколько подключений осталось
                remaining_connections_in_group = ServerConnection.objects.filter(
                    user_group=group
                ).count()
                
                if remaining_connections_in_group > 0:
                    result_message = f'Подключение "{connection_display_name}" удалено. В группе "{group_name}" осталось {remaining_connections_in_group} подключений.'
            
            return JsonResponse({
                'success': True,
                'message': result_message,
                'group_action': group_action,
                'group_name': group_name if group_action != 'deleted' else None,
                'remaining_members': members_count - 1 if group_action == 'removed' else members_count,
                'connection_deleted': connection_deleted
            })
            
        except ServerConnection.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Подключение не найдено или нет доступа'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

def _parse_cluster_list(output):
    """Парсит вывод команды cluster list и извлекает информацию о кластерах"""
    clusters = []
    if not output:
        return clusters
    
    lines = output.strip().split('\n')
    current_cluster = None
    
    for line in lines:
        line = line.strip()
        if not line:
            # Пустая строка - разделитель между кластерами
            if current_cluster:
                clusters.append(current_cluster)
                current_cluster = None
            continue
        
        # Парсим строку вида "key : value"
        if ':' in line:
            parts = line.split(':', 1)
            key = parts[0].strip()
            value = parts[1].strip() if len(parts) > 1 else ''
            
            if key == 'cluster':
                # Начало нового кластера
                if current_cluster:
                    clusters.append(current_cluster)
                current_cluster = {
                    'uuid': value,
                    'name': '',
                    'host': '',
                    'port': '',
                    'data': {}
                }
            elif current_cluster:
                # Сохраняем все данные кластера
                current_cluster['data'][key] = value
                
                # Извлекаем важные поля
                if key == 'name':
                    # Убираем кавычки если есть
                    current_cluster['name'] = value.strip('"')
                elif key == 'host':
                    current_cluster['host'] = value
                elif key == 'port':
                    current_cluster['port'] = value
    
    # Добавляем последний кластер
    if current_cluster:
        clusters.append(current_cluster)
    
    return clusters

@login_required
def get_clusters(request, connection_id):
    """Получает список кластеров для подключения (выполняет команду cluster list)"""
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        rac_client = RACClient(connection)
        result = rac_client.get_cluster_list()
        
        if result['success']:
            # Парсим вывод и извлекаем структурированные данные
            clusters = _parse_cluster_list(result['output'])
            
            return JsonResponse({
                'success': True, 
                'output': result['output'],  # Оставляем для обратной совместимости
                'clusters': clusters,  # Структурированные данные
                'rac_path': rac_client.rac_path
            }, json_dumps_params={'ensure_ascii': False})
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
            }, json_dumps_params={'ensure_ascii': False})
            
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

@login_required
def get_cluster_details(request, connection_id, cluster_uuid):
    """Получает детальную информацию о кластере"""
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        rac_client = RACClient(connection)
        result = rac_client.get_cluster_info(cluster_uuid)
        
        if result['success']:
            # Парсим вывод
            cluster_data = {}
            if result['output']:
                lines = result['output'].strip().split('\n')
                for line in lines:
                    line = line.strip()
                    if ':' in line:
                        parts = line.split(':', 1)
                        key = parts[0].strip()
                        value = parts[1].strip() if len(parts) > 1 else ''
                        cluster_data[key] = value
            
            return JsonResponse({
                'success': True,
                'cluster': cluster_data,
                'raw_output': result['output']
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Неизвестная ошибка')
            }, json_dumps_params={'ensure_ascii': False})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
@csrf_exempt
def update_cluster(request, connection_id, cluster_uuid):
    """Обновляет параметры кластера"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST allowed'})
    
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        rac_client = RACClient(connection)
        
        # Получаем данные из запроса
        data = json.loads(request.body)
        
        # Подготавливаем параметры для обновления
        update_params = {}
        
        # Маппинг полей из формы в параметры RAC
        field_mapping = {
            'name': 'name',
            'expiration_timeout': 'expiration_timeout',
            'lifetime_limit': 'lifetime_limit',
            'max_memory_size': 'max_memory_size',
            'max_memory_time_limit': 'max_memory_time_limit',
            'security_level': 'security_level',
            'session_fault_tolerance_level': 'session_fault_tolerance_level',
            'load_balancing_mode': 'load_balancing_mode',
            'errors_count_threshold': 'errors_count_threshold',
            'kill_problem_processes': 'kill_problem_processes',
            'kill_by_memory_with_dump': 'kill_by_memory_with_dump',
            'allow_access_right_audit_events_recording': 'allow_access_right_audit_events_recording',
            'ping_period': 'ping_period',
            'ping_timeout': 'ping_timeout',
        }
        
        for form_field, rac_param in field_mapping.items():
            if form_field in data and data[form_field] != '':
                value = data[form_field]
                # Преобразуем строковые "yes"/"no" в булевы значения
                if value in ['yes', 'no']:
                    value = value == 'yes'
                # Преобразуем числовые строки в числа
                elif isinstance(value, str) and value.isdigit():
                    value = int(value)
                update_params[rac_param] = value
        
        # Выполняем обновление
        result = rac_client.update_cluster(cluster_uuid, **update_params)
        
        if result['success']:
            return JsonResponse({
                'success': True,
                'message': 'Параметры кластера успешно обновлены'
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Ошибка обновления кластера')
            }, json_dumps_params={'ensure_ascii': False})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
@csrf_exempt
def insert_cluster(request, connection_id):
    """Регистрирует новый кластер"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST allowed'})
    
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        rac_client = RACClient(connection)
        
        # Получаем данные из запроса
        data = json.loads(request.body)
        
        # Обязательные поля
        host = data.get('host')
        port = data.get('port')
        
        if not host or not port:
            return JsonResponse({'success': False, 'error': 'Host и Port обязательны'})
        
        # Подготавливаем параметры для регистрации
        insert_params = {}
        
        # Маппинг полей из формы в параметры RAC
        field_mapping = {
            'name': 'name',
            'expiration_timeout': 'expiration_timeout',
            'lifetime_limit': 'lifetime_limit',
            'max_memory_size': 'max_memory_size',
            'max_memory_time_limit': 'max_memory_time_limit',
            'security_level': 'security_level',
            'session_fault_tolerance_level': 'session_fault_tolerance_level',
            'load_balancing_mode': 'load_balancing_mode',
            'errors_count_threshold': 'errors_count_threshold',
            'kill_problem_processes': 'kill_problem_processes',
            'kill_by_memory_with_dump': 'kill_by_memory_with_dump',
            'allow_access_right_audit_events_recording': 'allow_access_right_audit_events_recording',
            'ping_period': 'ping_period',
            'ping_timeout': 'ping_timeout',
        }
        
        for form_field, rac_param in field_mapping.items():
            if form_field in data and data[form_field] != '':
                value = data[form_field]
                # Преобразуем строковые "yes"/"no" в булевы значения
                if value in ['yes', 'no']:
                    value = value == 'yes'
                # Преобразуем числовые строки в числа
                elif isinstance(value, str) and value.isdigit():
                    value = int(value)
                insert_params[rac_param] = value
        
        # Выполняем регистрацию
        result = rac_client.insert_cluster(host, port, **insert_params)
        
        if result['success']:
            return JsonResponse({
                'success': True,
                'message': 'Кластер успешно зарегистрирован'
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Ошибка регистрации кластера')
            }, json_dumps_params={'ensure_ascii': False})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
@csrf_exempt
def remove_cluster(request, connection_id, cluster_uuid):
    """Удаляет кластер"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST allowed'})
    
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        rac_client = RACClient(connection)
        
        # Выполняем удаление
        result = rac_client.remove_cluster(cluster_uuid)
        
        if result['success']:
            return JsonResponse({
                'success': True,
                'message': 'Кластер успешно удалён'
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Ошибка удаления кластера')
            }, json_dumps_params={'ensure_ascii': False})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})