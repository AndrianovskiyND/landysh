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

def _parse_infobase_list(output):
    """Парсит вывод команды infobase summary list и извлекает информацию об информационных базах"""
    infobases = []
    if not output:
        return infobases
    
    lines = output.strip().split('\n')
    current_infobase = None
    
    for line in lines:
        line = line.strip()
        if not line:
            if current_infobase:
                infobases.append(current_infobase)
                current_infobase = None
            continue
        
        if ':' in line:
            parts = line.split(':', 1)
            key = parts[0].strip()
            value = parts[1].strip() if len(parts) > 1 else ''
            
            if key == 'infobase':
                if current_infobase:
                    infobases.append(current_infobase)
                current_infobase = {
                    'uuid': value,
                    'name': '',
                    'data': {}
                }
            elif current_infobase:
                current_infobase['data'][key] = value
                if key == 'name':
                    current_infobase['name'] = value.strip('"')
    
    if current_infobase:
        infobases.append(current_infobase)
    
    return infobases

def _parse_session_list(output):
    """Парсит вывод команды session list и извлекает информацию о сеансах"""
    sessions = []
    if not output:
        return sessions
    
    lines = output.strip().split('\n')
    current_session = None
    
    for line in lines:
        line = line.strip()
        if not line:
            # Пустая строка - разделитель между сеансами
            if current_session:
                sessions.append(current_session)
                current_session = None
            continue
        
        if ':' in line:
            parts = line.split(':', 1)
            key = parts[0].strip()
            value = parts[1].strip() if len(parts) > 1 else ''
            
            if key == 'session':
                # Начало нового сеанса
                if current_session:
                    sessions.append(current_session)
                current_session = {
                    'uuid': value,
                    'data': {}
                }
            elif current_session:
                # Сохраняем все данные сеанса
                current_session['data'][key] = value
    
    # Добавляем последний сеанс
    if current_session:
        sessions.append(current_session)
    
    return sessions

def _parse_infobase_info(output):
    """Парсит вывод команды infobase info и извлекает информацию об одной информационной базе"""
    infobase = None
    if not output:
        return infobase
    
    lines = output.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        if ':' in line:
            parts = line.split(':', 1)
            key = parts[0].strip()
            value = parts[1].strip() if len(parts) > 1 else ''
            
            if key == 'infobase':
                # Начало новой информационной базы - если уже есть, значит это вторая, игнорируем
                if infobase is None:
                    infobase = {
                        'uuid': value,
                        'name': '',
                        'data': {}
                    }
            elif infobase:
                # Сохраняем все данные информационной базы
                # Убираем кавычки из значения если есть
                clean_value = value.strip('"').strip()
                infobase['data'][key] = clean_value
                
                # Извлекаем важные поля
                if key == 'name':
                    infobase['name'] = clean_value
                elif key == 'descr' or key == 'description':
                    # Сохраняем описание под ключом 'descr' для единообразия
                    infobase['data']['descr'] = clean_value
                    # Также сохраняем под оригинальным ключом
                    if key == 'description':
                        infobase['data']['description'] = clean_value
    
    return infobase

def _parse_server_list(output):
    """Парсит вывод команды server list и извлекает информацию о рабочих серверах"""
    servers = []
    if not output:
        return servers
    
    lines = output.strip().split('\n')
    current_server = None
    
    for line in lines:
        line = line.strip()
        if not line:
            if current_server:
                servers.append(current_server)
                current_server = None
            continue
        
        if ':' in line:
            parts = line.split(':', 1)
            key = parts[0].strip()
            value = parts[1].strip() if len(parts) > 1 else ''
            
            if key == 'server':
                if current_server:
                    servers.append(current_server)
                current_server = {
                    'uuid': value,
                    'name': '',
                    'host': '',
                    'data': {}
                }
            elif current_server:
                current_server['data'][key] = value
                if key == 'name':
                    current_server['name'] = value.strip('"')
                elif key == 'host' or key == 'agent-host':
                    # Сохраняем host для отображения
                    current_server['host'] = value.strip('"')
    
    if current_server:
        servers.append(current_server)
    
    return servers

def _parse_server_info(output):
    """Парсит вывод команды server info и извлекает информацию об одном рабочем сервере"""
    server = None
    if not output:
        return server
    
    lines = output.strip().split('\n')
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        if ':' in line:
            parts = line.split(':', 1)
            key = parts[0].strip()
            value = parts[1].strip() if len(parts) > 1 else ''
            
            if key == 'server':
                # Начало нового сервера - если уже есть, значит это второй сервер, игнорируем
                if server is None:
                    server = {
                        'uuid': value,
                        'name': '',
                        'host': '',
                        'data': {}
                    }
            elif server:
                # Сохраняем все данные сервера
                server['data'][key] = value
                
                # Извлекаем важные поля
                if key == 'name':
                    server['name'] = value.strip('"')
                elif key == 'host' or key == 'agent-host':
                    server['host'] = value.strip('"')
    
    return server

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
        infobase_uuid = request.GET.get('infobase')  # Опционально - для фильтрации по информационной базе
        include_licenses = request.GET.get('licenses', 'false').lower() == 'true'
        
        if not cluster_uuid:
            return JsonResponse({'success': False, 'error': 'Cluster UUID required'})
        
        rac_client = RACClient(connection)
        result = rac_client.get_session_list(cluster_uuid, infobase_uuid, include_licenses)
        
        if result['success']:
            sessions = _parse_session_list(result['output'])
            return JsonResponse({
                'success': True,
                'sessions': sessions,
                'output': result['output']
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({'success': False, 'error': result['error']}, json_dumps_params={'ensure_ascii': False})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
@csrf_exempt
def terminate_sessions(request):
    """Принудительно завершает сеансы"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            connection_id = data['connection_id']
            session_uuids = data['session_uuids']
            cluster_uuid = data['cluster_uuid']
            error_message = data.get('error_message')
            
            connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
            rac_client = RACClient(connection)
            
            results = []
            for session_uuid in session_uuids:
                result = rac_client.terminate_session(cluster_uuid, session_uuid, error_message)
                results.append({
                    'session_uuid': session_uuid,
                    'success': result['success'],
                    'error': result.get('error')
                })
            
            return JsonResponse({'success': True, 'results': results}, json_dumps_params={'ensure_ascii': False})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
@csrf_exempt
def interrupt_server_calls(request):
    """Прерывает текущие серверные вызовы"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            connection_id = data['connection_id']
            session_uuids = data['session_uuids']
            cluster_uuid = data['cluster_uuid']
            error_message = data.get('error_message')
            
            connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
            rac_client = RACClient(connection)
            
            results = []
            for session_uuid in session_uuids:
                result = rac_client.interrupt_server_call(cluster_uuid, session_uuid, error_message)
                results.append({
                    'session_uuid': session_uuid,
                    'success': result['success'],
                    'error': result.get('error')
                })
            
            return JsonResponse({'success': True, 'results': results}, json_dumps_params={'ensure_ascii': False})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
def get_infobases(request, connection_id):
    """Получает список информационных баз для подключения"""
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        cluster_uuid = request.GET.get('cluster')
        
        if not cluster_uuid:
            return JsonResponse({'success': False, 'error': 'Cluster UUID required'})
        
        rac_client = RACClient(connection)
        result = rac_client.get_infobase_summary_list(cluster_uuid)
        
        if result['success']:
            infobases = _parse_infobase_list(result['output'])
            return JsonResponse({
                'success': True, 
                'infobases': infobases,
                'output': result['output']
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({'success': False, 'error': result['error']}, json_dumps_params={'ensure_ascii': False})
            
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
        
        if not cluster_uuid:
            return JsonResponse({'success': False, 'error': 'Cluster UUID required'})
        
        rac_client = RACClient(connection)
        result = rac_client.get_server_list(cluster_uuid)
        
        if result['success']:
            servers = _parse_server_list(result['output'])
            return JsonResponse({
                'success': True, 
                'servers': servers,
                'output': result['output']
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({'success': False, 'error': result['error']}, json_dumps_params={'ensure_ascii': False})
            
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

# ============================================
# Endpoints для работы с информационными базами
# ============================================

@login_required
def get_infobase_info(request, connection_id, cluster_uuid):
    """Получает информацию об информационной базе"""
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        infobase_uuid = request.GET.get('infobase')
        infobase_name = request.GET.get('name')
        
        rac_client = RACClient(connection)
        result = rac_client.get_infobase_info(cluster_uuid, infobase_uuid, infobase_name)
        
        if result['success']:
            # Парсим вывод и извлекаем структурированные данные (только первая информационная база)
            infobase = _parse_infobase_info(result['output'])
            
            return JsonResponse({
                'success': True,
                'output': result['output'],  # Оставляем для обратной совместимости
                'infobase': infobase  # Структурированные данные
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Ошибка получения информации')
            }, json_dumps_params={'ensure_ascii': False})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
@csrf_exempt
def create_infobase(request, connection_id, cluster_uuid):
    """Создаёт новую информационную базу"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST allowed'})
    
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        rac_client = RACClient(connection)
        
        data = json.loads(request.body)
        
        # Обязательные поля
        name = data.get('name')
        dbms = data.get('dbms')
        db_server = data.get('db_server')
        db_name = data.get('db_name')
        # locale всегда по умолчанию ru_RU, если не указан
        locale = data.get('locale', 'ru_RU').strip() or 'ru_RU'
        
        if not all([name, dbms, db_server, db_name]):
            return JsonResponse({'success': False, 'error': 'Missing required fields'})
        
        # Дополнительные параметры
        kwargs = {}
        if 'create_database' in data:
            # Преобразуем строку 'true'/'false' в булево значение
            create_db_value = data['create_database']
            if isinstance(create_db_value, str):
                kwargs['create_database'] = create_db_value.lower() == 'true'
            else:
                kwargs['create_database'] = bool(create_db_value)
        if 'db_user' in data:
            kwargs['db_user'] = data['db_user']
        if 'db_pwd' in data:
            kwargs['db_pwd'] = data['db_pwd']
        if 'descr' in data:
            kwargs['descr'] = data['descr']
        if 'date_offset' in data:
            kwargs['date_offset'] = data['date_offset']
        if 'security_level' in data:
            kwargs['security_level'] = data['security_level']
        if 'scheduled_jobs_deny' in data:
            kwargs['scheduled_jobs_deny'] = data['scheduled_jobs_deny']
        if 'license_distribution' in data:
            kwargs['license_distribution'] = data['license_distribution']
        
        result = rac_client.create_infobase(cluster_uuid, name, dbms, db_server, db_name, locale, **kwargs)
        
        if result['success']:
            return JsonResponse({
                'success': True,
                'message': 'Информационная база успешно создана'
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Ошибка создания информационной базы')
            }, json_dumps_params={'ensure_ascii': False})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
@csrf_exempt
def update_infobase(request, connection_id, cluster_uuid):
    """Обновляет информацию об информационной базе"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST allowed'})
    
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        rac_client = RACClient(connection)
        
        data = json.loads(request.body)
        infobase_uuid = data.get('infobase_uuid')
        infobase_name = data.get('infobase_name')
        
        if not infobase_uuid and not infobase_name:
            return JsonResponse({'success': False, 'error': 'infobase_uuid or infobase_name required'})
        
        # Собираем параметры для обновления
        kwargs = {}
        for key in ['infobase_user', 'infobase_pwd', 'dbms', 'db_server', 'db_name', 'db_user', 'db_pwd',
                    'descr', 'denied_from', 'denied_message', 'denied_parameter', 'denied_to', 'permission_code',
                    'sessions_deny', 'scheduled_jobs_deny', 'license_distribution',
                    'external_session_manager_connection_string', 'external_session_manager_required',
                    'reserve_working_processes', 'security_profile_name', 'safe_mode_security_profile_name',
                    'disable_local_speech_to_text', 'configuration_unload_delay_by_working_process_without_active_users',
                    'minimum_scheduled_jobs_start_period_without_active_users',
                    'maximum_scheduled_jobs_start_shift_without_active_users']:
            if key in data:
                kwargs[key] = data[key]
        
        result = rac_client.update_infobase(cluster_uuid, infobase_uuid, infobase_name, **kwargs)
        
        if result['success']:
            return JsonResponse({
                'success': True,
                'message': 'Информационная база успешно обновлена'
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Ошибка обновления информационной базы')
            }, json_dumps_params={'ensure_ascii': False})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
@csrf_exempt
def drop_infobase(request, connection_id, cluster_uuid):
    """Удаляет информационную базу"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST allowed'})
    
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        rac_client = RACClient(connection)
        
        data = json.loads(request.body)
        infobase_uuid = data.get('infobase_uuid')
        infobase_name = data.get('infobase_name')
        
        if not infobase_uuid and not infobase_name:
            return JsonResponse({'success': False, 'error': 'infobase_uuid or infobase_name required'})
        
        result = rac_client.drop_infobase(
            cluster_uuid,
            infobase_uuid,
            infobase_name,
            data.get('infobase_user'),
            data.get('infobase_pwd'),
            data.get('drop_database', False),
            data.get('clear_database', False)
        )
        
        if result['success']:
            return JsonResponse({
                'success': True,
                'message': 'Информационная база успешно удалена'
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Ошибка удаления информационной базы')
            }, json_dumps_params={'ensure_ascii': False})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

# ============================================
# Endpoints для работы с рабочими серверами
# ============================================

@login_required
def get_server_info(request, connection_id, cluster_uuid, server_uuid):
    """Получает информацию о рабочем сервере"""
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        rac_client = RACClient(connection)
        
        result = rac_client.get_server_info(cluster_uuid, server_uuid)
        
        if result['success']:
            # Парсим вывод и извлекаем структурированные данные (только первый сервер)
            server = _parse_server_info(result['output'])
            
            return JsonResponse({
                'success': True,
                'output': result['output'],  # Оставляем для обратной совместимости
                'server': server  # Структурированные данные
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Ошибка получения информации')
            }, json_dumps_params={'ensure_ascii': False})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
@csrf_exempt
def insert_server(request, connection_id, cluster_uuid):
    """Регистрирует новый рабочий сервер"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST allowed'})
    
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        rac_client = RACClient(connection)
        
        data = json.loads(request.body)
        
        # Обязательные поля
        agent_host = data.get('agent_host')
        agent_port = data.get('agent_port')
        port_range = data.get('port_range')
        
        if not all([agent_host, agent_port, port_range]):
            return JsonResponse({'success': False, 'error': 'Missing required fields: agent_host, agent_port, port_range'})
        
        # Дополнительные параметры
        kwargs = {}
        for key in ['name', 'using', 'infobases_limit', 'memory_limit', 'connections_limit', 'cluster_port',
                    'dedicate_managers', 'safe_working_processes_memory_limit', 'safe_call_memory_limit',
                    'critical_total_memory', 'temporary_allowed_total_memory',
                    'temporary_allowed_total_memory_time_limit', 'service_principal_name',
                    'restart_schedule', 'add_prohibiting_assignment_rule']:
            if key in data:
                kwargs[key] = data[key]
        
        result = rac_client.insert_server(cluster_uuid, agent_host, agent_port, port_range, **kwargs)
        
        if result['success']:
            return JsonResponse({
                'success': True,
                'message': 'Рабочий сервер успешно зарегистрирован'
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Ошибка регистрации рабочего сервера')
            }, json_dumps_params={'ensure_ascii': False})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
@csrf_exempt
def update_server(request, connection_id, cluster_uuid, server_uuid):
    """Обновляет параметры рабочего сервера"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST allowed'})
    
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        rac_client = RACClient(connection)
        
        data = json.loads(request.body)
        
        # Собираем параметры для обновления
        kwargs = {}
        for key in ['port_range', 'using', 'infobases_limit', 'memory_limit', 'connections_limit',
                    'dedicate_managers', 'safe_working_processes_memory_limit', 'safe_call_memory_limit',
                    'critical_total_memory', 'temporary_allowed_total_memory',
                    'temporary_allowed_total_memory_time_limit', 'service_principal_name',
                    'restart_schedule']:
            if key in data:
                kwargs[key] = data[key]
        
        result = rac_client.update_server(cluster_uuid, server_uuid, **kwargs)
        
        if result['success']:
            return JsonResponse({
                'success': True,
                'message': 'Рабочий сервер успешно обновлён'
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Ошибка обновления рабочего сервера')
            }, json_dumps_params={'ensure_ascii': False})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})

@login_required
@csrf_exempt
def remove_server(request, connection_id, cluster_uuid, server_uuid):
    """Удаляет рабочий сервер"""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST allowed'})
    
    try:
        connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
        rac_client = RACClient(connection)
        
        result = rac_client.remove_server(cluster_uuid, server_uuid)
        
        if result['success']:
            return JsonResponse({
                'success': True,
                'message': 'Рабочий сервер успешно удалён'
            }, json_dumps_params={'ensure_ascii': False})
        else:
            return JsonResponse({
                'success': False,
                'error': result.get('error', 'Ошибка удаления рабочего сервера')
            }, json_dumps_params={'ensure_ascii': False})
            
    except ServerConnection.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Connection not found'})
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)})