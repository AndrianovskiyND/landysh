"""
Views для управления папками подключений
"""
import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.db.models import Max
from .models import ServerConnection, ConnectionFolder
from users.models import UserGroup

logger = logging.getLogger(__name__)

@login_required
@csrf_exempt
def create_folder(request):
    """Создает новую папку для подключений"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            name = data.get('name', '').strip()
            
            if not name:
                return JsonResponse({'success': False, 'error': 'Название папки обязательно'}, json_dumps_params={'ensure_ascii': False})
            
            # Получаем группу пользователя
            user_groups = request.user.user_groups.all()
            if not user_groups.exists():
                return JsonResponse({'success': False, 'error': 'Пользователь не состоит ни в одной группе'}, json_dumps_params={'ensure_ascii': False})
            
            user_group = user_groups.first()
            
            # Проверяем уникальность имени папки в группе
            if ConnectionFolder.objects.filter(user_group=user_group, name=name).exists():
                return JsonResponse({'success': False, 'error': 'Папка с таким именем уже существует'}, json_dumps_params={'ensure_ascii': False})
            
            # Определяем порядок (максимальный + 1)
            max_order = ConnectionFolder.objects.filter(user_group=user_group).aggregate(Max('order'))['order__max'] or -1
            order = max_order + 1
            
            folder = ConnectionFolder.objects.create(
                user_group=user_group,
                name=name,
                order=order
            )
            
            return JsonResponse({
                'success': True,
                'folder': {
                    'id': folder.id,
                    'name': folder.name,
                    'order': folder.order,
                    'group_id': user_group.id,
                    'group_name': user_group.name,
                }
            }, json_dumps_params={'ensure_ascii': False})
            
        except Exception as e:
            logger.error(f'Ошибка создания папки: {e}')
            return JsonResponse({'success': False, 'error': str(e)}, json_dumps_params={'ensure_ascii': False})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'}, json_dumps_params={'ensure_ascii': False})

@login_required
@csrf_exempt
def update_folder(request, folder_id):
    """Обновляет название папки"""
    if request.method == 'POST':
        try:
            folder = ConnectionFolder.objects.get(id=folder_id, user_group__members=request.user)
            data = json.loads(request.body)
            name = data.get('name', '').strip()
            
            if not name:
                return JsonResponse({'success': False, 'error': 'Название папки обязательно'}, json_dumps_params={'ensure_ascii': False})
            
            # Проверяем уникальность имени папки в группе (исключая текущую папку)
            if ConnectionFolder.objects.filter(user_group=folder.user_group, name=name).exclude(id=folder_id).exists():
                return JsonResponse({'success': False, 'error': 'Папка с таким именем уже существует'}, json_dumps_params={'ensure_ascii': False})
            
            folder.name = name
            folder.save()
            
            return JsonResponse({
                'success': True,
                'folder': {
                    'id': folder.id,
                    'name': folder.name,
                    'order': folder.order,
                }
            }, json_dumps_params={'ensure_ascii': False})
            
        except ConnectionFolder.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Папка не найдена или нет доступа'}, json_dumps_params={'ensure_ascii': False})
        except Exception as e:
            logger.error(f'Ошибка обновления папки: {e}')
            return JsonResponse({'success': False, 'error': str(e)}, json_dumps_params={'ensure_ascii': False})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'}, json_dumps_params={'ensure_ascii': False})

@login_required
@csrf_exempt
def delete_folder(request, folder_id):
    """Удаляет папку (подключения остаются, но теряют привязку к папке)"""
    if request.method == 'POST':
        try:
            folder = ConnectionFolder.objects.get(id=folder_id, user_group__members=request.user)
            
            # Удаляем папку (подключения останутся, но folder станет NULL)
            folder_name = folder.name
            folder.delete()
            
            return JsonResponse({
                'success': True,
                'message': f'Папка "{folder_name}" удалена. Подключения сохранены.'
            }, json_dumps_params={'ensure_ascii': False})
            
        except ConnectionFolder.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Папка не найдена или нет доступа'}, json_dumps_params={'ensure_ascii': False})
        except Exception as e:
            logger.error(f'Ошибка удаления папки: {e}')
            return JsonResponse({'success': False, 'error': str(e)}, json_dumps_params={'ensure_ascii': False})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'}, json_dumps_params={'ensure_ascii': False})

@login_required
@csrf_exempt
def move_folder(request, folder_id):
    """Перемещает папку (изменяет порядок)"""
    if request.method == 'POST':
        try:
            folder = ConnectionFolder.objects.get(id=folder_id, user_group__members=request.user)
            data = json.loads(request.body)
            new_order = data.get('order')
            
            if new_order is None:
                return JsonResponse({'success': False, 'error': 'Порядок не указан'}, json_dumps_params={'ensure_ascii': False})
            
            # Обновляем порядок всех папок в группе
            user_group = folder.user_group
            folders = list(ConnectionFolder.objects.filter(user_group=user_group).order_by('order'))
            
            # Удаляем текущую папку из списка
            folders = [f for f in folders if f.id != folder_id]
            
            # Вставляем папку на новую позицию
            new_order = max(0, min(new_order, len(folders)))
            folders.insert(new_order, folder)
            
            # Обновляем порядок всех папок
            for index, f in enumerate(folders):
                f.order = index
                f.save()
            
            return JsonResponse({
                'success': True,
                'folder': {
                    'id': folder.id,
                    'order': folder.order,
                }
            }, json_dumps_params={'ensure_ascii': False})
            
        except ConnectionFolder.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Папка не найдена или нет доступа'}, json_dumps_params={'ensure_ascii': False})
        except Exception as e:
            logger.error(f'Ошибка перемещения папки: {e}')
            return JsonResponse({'success': False, 'error': str(e)}, json_dumps_params={'ensure_ascii': False})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'}, json_dumps_params={'ensure_ascii': False})

@login_required
@csrf_exempt
def move_connection(request, connection_id):
    """Перемещает подключение между папками или изменяет порядок"""
    if request.method == 'POST':
        try:
            connection = ServerConnection.objects.get(id=connection_id, user_group__members=request.user)
            data = json.loads(request.body)
            folder_id = data.get('folder_id')  # null для перемещения вне папки
            new_order = data.get('order')
            
            # Обновляем папку
            if folder_id is None:
                connection.folder = None
            else:
                folder = ConnectionFolder.objects.get(id=folder_id, user_group__members=request.user)
                connection.folder = folder
            
            # Обновляем порядок
            if new_order is not None:
                connection.order = new_order
                
                # Обновляем порядок других подключений в той же папке (или без папки)
                user_group = connection.user_group
                connections_in_folder = ServerConnection.objects.filter(
                    user_group=user_group,
                    folder=connection.folder
                ).exclude(id=connection_id).order_by('order')
                
                connections_list = list(connections_in_folder)
                new_order = max(0, min(new_order, len(connections_list)))
                connections_list.insert(new_order, connection)
                
                # Обновляем порядок всех подключений
                for index, conn in enumerate(connections_list):
                    conn.order = index
                    conn.save()
            else:
                connection.save()
            
            return JsonResponse({
                'success': True,
                'connection': {
                    'id': connection.id,
                    'folder_id': connection.folder.id if connection.folder else None,
                    'order': connection.order,
                }
            }, json_dumps_params={'ensure_ascii': False})
            
        except ServerConnection.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Подключение не найдено или нет доступа'}, json_dumps_params={'ensure_ascii': False})
        except ConnectionFolder.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Папка не найдена или нет доступа'}, json_dumps_params={'ensure_ascii': False})
        except Exception as e:
            logger.error(f'Ошибка перемещения подключения: {e}')
            return JsonResponse({'success': False, 'error': str(e)}, json_dumps_params={'ensure_ascii': False})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'}, json_dumps_params={'ensure_ascii': False})

