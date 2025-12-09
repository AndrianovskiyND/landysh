import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth import update_session_auth_hash
from core.models import Profile
from .models import UserGroup

logger = logging.getLogger(__name__)

# ============================================
# Вспомогательные функции
# ============================================

def check_last_admin_protection(user_to_modify, exclude_user=None):
    """
    Проверяет, останется ли хотя бы один активный администратор после операции.
    
    Args:
        user_to_modify: Пользователь, которого планируется удалить/заблокировать/изменить роль
        exclude_user: Пользователь, которого нужно исключить из проверки (опционально)
    
    Returns:
        tuple: (is_protected, message)
        - is_protected: True если операция заблокирована (последний админ)
        - message: Сообщение об ошибке или None
    """
    try:
        user_profile = Profile.objects.get(user=user_to_modify)
        
        # Если пользователь не администратор, защита не нужна
        if not user_profile.is_admin():
            return (False, None)
        
        # Подсчитываем активных администраторов
        admin_profiles = Profile.objects.filter(role='admin')
        active_admins = [p for p in admin_profiles if p.user.is_active]
        
        # Исключаем пользователя, которого планируется изменить
        active_admins = [p for p in active_admins if p.user.id != user_to_modify.id]
        
        # Исключаем дополнительного пользователя, если указан
        if exclude_user:
            active_admins = [p for p in active_admins if p.user.id != exclude_user.id]
        
        # Если не осталось активных администраторов - блокируем операцию
        if len(active_admins) == 0:
            return (True, 'Невозможно выполнить операцию: в системе должен остаться хотя бы один активный администратор.')
        
        return (False, None)
        
    except Profile.DoesNotExist:
        # Если профиля нет, пользователь не администратор
        return (False, None)

@login_required
def user_groups(request):
    """Возвращает список групп пользователя"""
    user_groups = request.user.user_groups.all()
    groups_data = []
    
    for group in user_groups:
        groups_data.append({
            'id': group.id,
            'name': group.name,
            'created_by': group.created_by.username,
            'created_at': group.created_at.isoformat(),
            'members_count': group.members.count(),
        })
    
    return JsonResponse({'groups': groups_data})

@login_required
@csrf_exempt
def create_group(request):
    """Создает новую группу"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            name = data.get('name')
            
            if not name:
                return JsonResponse({'success': False, 'error': 'Введите название группы'})
            
            group = UserGroup.objects.create(name=name, created_by=request.user)
            group.members.add(request.user)
            
            return JsonResponse({'success': True, 'group_id': group.id})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
def user_list(request):
    """Возвращает список всех пользователей (для админов) или данные текущего пользователя (для обычных пользователей)"""
    try:
        profile = Profile.objects.get(user=request.user)
        is_admin = profile.is_admin()
        
        # Если не админ, возвращаем только данные текущего пользователя
        if not is_admin:
            user = request.user
            try:
                user_profile = Profile.objects.get(user=user)
                role = user_profile.role
                last_login_at = user_profile.last_login_at.isoformat() if user_profile.last_login_at else None
                subject_to_password_policy = user_profile.subject_to_password_policy
            except Profile.DoesNotExist:
                role = 'user'
                last_login_at = None
                subject_to_password_policy = True
            
            user_data = [{
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_active': user.is_active,
                'role': role,
                'subject_to_password_policy': subject_to_password_policy,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'last_login_at': last_login_at,
                'date_joined': user.date_joined.isoformat(),
            }]
            
            return JsonResponse({'success': True, 'users': user_data})
        
        # Админ видит всех пользователей
        users = User.objects.all()
        user_data = []
        
        for user in users:
            try:
                user_profile = Profile.objects.get(user=user)
                role = user_profile.role
                last_login_at = user_profile.last_login_at.isoformat() if user_profile.last_login_at else None
                subject_to_password_policy = user_profile.subject_to_password_policy
            except Profile.DoesNotExist:
                role = 'user'
                last_login_at = None
                subject_to_password_policy = True
            
            user_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_active': user.is_active,
                'role': role,
                'subject_to_password_policy': subject_to_password_policy,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'last_login_at': last_login_at,
                'date_joined': user.date_joined.isoformat(),
            })
        
        return JsonResponse({'success': True, 'users': user_data})
        
    except Profile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Доступ запрещен'})

@login_required
@csrf_exempt
def create_user(request):
    """Создает нового пользователя (только для админов)"""
    if request.method == 'POST':
        try:
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
            
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            role = data.get('role', 'user')
            
            if not username or not password:
                return JsonResponse({'success': False, 'error': 'Заполните имя пользователя и пароль'})
            
            if User.objects.filter(username=username).exists():
                return JsonResponse({'success': False, 'error': 'Пользователь уже существует'})
            
            # Создаем пользователя
            user = User.objects.create_user(
                username=username,
                password=password,
                email=data.get('email', ''),
                first_name=data.get('first_name', ''),
                last_name=data.get('last_name', '')
            )
            
            # Создаем профиль
            subject_to_password_policy = data.get('subject_to_password_policy', True)
            Profile.objects.create(
                user=user, 
                role=role,
                subject_to_password_policy=subject_to_password_policy
            )
            
            return JsonResponse({'success': True, 'user_id': user.id})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
def all_groups(request):
    """Возвращает список всех групп (для админов) или группы текущего пользователя (для обычных пользователей)"""
    try:
        profile = Profile.objects.get(user=request.user)
        is_admin = profile.is_admin()
    except Profile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
    
    # Админы видят все группы, обычные пользователи - все группы (для отображения в модальном окне)
    groups = UserGroup.objects.all()
    group_data = []
    
    for group in groups:
        group_data.append({
            'id': group.id,
            'name': group.name,
            'created_by': group.created_by.username,
            'created_at': group.created_at.isoformat(),
            'members_count': group.members.count(),
            'members': [{'id': m.id, 'username': m.username} for m in group.members.all()]
        })
    
    return JsonResponse({'success': True, 'groups': group_data})

@login_required
@csrf_exempt
def assign_user_to_group(request):
    """Назначает пользователя в группу (только для админов)"""
    if request.method == 'POST':
        try:
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
            
            data = json.loads(request.body)
            user_id = data.get('user_id')
            group_id = data.get('group_id')
            action = data.get('action', 'add')  # 'add' или 'remove'
            
            user = User.objects.get(id=user_id)
            group = UserGroup.objects.get(id=group_id)
            
            if action == 'add':
                group.members.add(user)
            else:
                group.members.remove(user)
            
            return JsonResponse({'success': True})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
@csrf_exempt
def update_user(request):
    """Обновляет данные пользователя (только для админов)"""
    if request.method == 'POST':
        try:
            # Только администратор может изменять данные пользователей
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен. Только администратор может изменять свойства пользователей.'})
            
            data = json.loads(request.body)
            user_id = data.get('user_id')
            first_name = data.get('first_name')
            last_name = data.get('last_name')
            email = data.get('email')
            subject_to_password_policy = data.get('subject_to_password_policy')
            
            user = User.objects.get(id=user_id)
            
            # Админ может изменять все данные
            if first_name is not None:
                user.first_name = first_name
            if last_name is not None:
                user.last_name = last_name
            if email is not None:
                user.email = email
            
            user.save()
            
            # Обновляем профиль
            try:
                user_profile = Profile.objects.get(user=user)
                if subject_to_password_policy is not None:
                    user_profile.subject_to_password_policy = subject_to_password_policy
                    user_profile.save()
            except Profile.DoesNotExist:
                pass
            
            return JsonResponse({'success': True})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
@csrf_exempt
def change_password(request):
    """Изменяет пароль пользователя (только для админов)
    
    ВАЖНО: При смене пароля администратором флаг force_password_change НЕ сбрасывается.
    Флаг сбрасывается только когда пользователь сам меняет пароль через страницу
    принудительной смены пароля (core/views.py:force_password_change).
    """
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_id = data.get('user_id')
            new_password = data.get('new_password')
            
            # Админ может менять пароль любому пользователю
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
            
            user = User.objects.get(id=user_id)
            user.set_password(new_password)
            user.save()
            
            # НЕ изменяем force_password_change - флаг должен оставаться как был
            # Флаг сбрасывается только когда пользователь сам меняет пароль
            # через страницу принудительной смены пароля (core/views.py:force_password_change)
            
            # Если админ меняет свой пароль, обновляем сессию
            if user.id == request.user.id:
                update_session_auth_hash(request, user)
            
            return JsonResponse({'success': True})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
@csrf_exempt
def change_own_password(request):
    """Изменяет пароль текущего пользователя (для обычных пользователей)"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            current_password = data.get('current_password')
            new_password1 = data.get('new_password1')
            new_password2 = data.get('new_password2')
            
            if not current_password:
                return JsonResponse({'success': False, 'error': 'Введите текущий пароль'})
            
            if not new_password1 or not new_password2:
                return JsonResponse({'success': False, 'error': 'Заполните все поля для нового пароля'})
            
            if new_password1 != new_password2:
                return JsonResponse({'success': False, 'error': 'Новые пароли не совпадают'})
            
            # Проверяем текущий пароль
            if not request.user.check_password(current_password):
                return JsonResponse({'success': False, 'error': 'Неверный текущий пароль'})
            
            # Устанавливаем новый пароль
            request.user.set_password(new_password1)
            request.user.save()
            
            # Обновляем сессию
            update_session_auth_hash(request, request.user)
            
            # Сбрасываем флаг принудительной смены пароля, если он был установлен
            try:
                profile = Profile.objects.get(user=request.user)
                profile.force_password_change = False
                profile.save()
            except Profile.DoesNotExist:
                pass
            
            return JsonResponse({'success': True})
            
        except Exception as e:
            logger.error(f"Ошибка при смене пароля: {e}")
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
@csrf_exempt
def toggle_active(request):
    """Блокирует/разблокирует пользователя"""
    if request.method == 'POST':
        try:
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
            
            data = json.loads(request.body)
            user_id = data.get('user_id')
            is_active = data.get('is_active')
            
            user = User.objects.get(id=user_id)
            
            # Нельзя заблокировать себя
            if user.id == request.user.id:
                return JsonResponse({'success': False, 'error': 'Нельзя заблокировать себя'})
            
            # Если блокируем администратора, проверяем защиту последнего админа
            if not is_active:
                is_protected, error_message = check_last_admin_protection(user)
                if is_protected:
                    return JsonResponse({'success': False, 'error': error_message})
            
            user.is_active = is_active
            user.save()
            
            action = "разблокирован" if is_active else "заблокирован"
            return JsonResponse({'success': True, 'message': f'Пользователь {action}'})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
@csrf_exempt
def delete_user(request):
    """Удаляет пользователя, сохраняя его группу и подключения"""
    if request.method == 'POST':
        try:
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
            
            data = json.loads(request.body)
            user_id = data.get('user_id')
            
            # Нельзя удалить себя
            if user_id == request.user.id:
                return JsonResponse({'success': False, 'error': 'Нельзя удалить себя'})
            
            user = User.objects.get(id=user_id)
            username = user.username
            
            # Проверяем защиту последнего администратора
            is_protected, error_message = check_last_admin_protection(user)
            if is_protected:
                return JsonResponse({'success': False, 'error': error_message})
            
            # Получаем все группы пользователя
            user_groups = user.user_groups.all()
            
            # Получаем все группы, созданные этим пользователем
            created_groups = UserGroup.objects.filter(created_by=user)
            
            # Если пользователь был создателем группы, передаём создателя текущему админу
            # Это предотвратит удаление группы при удалении пользователя
            for group in created_groups:
                group.created_by = request.user
            group.save()
            
            # Удаляем пользователя из всех групп (ManyToMany связь)
            # Это не удалит сами группы, так как это ManyToMany
            for group in user_groups:
                group.members.remove(user)
            
            # Удаляем Profile пользователя
            try:
                user_profile = Profile.objects.get(user=user)
                user_profile.delete()
            except Profile.DoesNotExist:
                pass
            
            # Удаляем самого пользователя
            user.delete()
            
            return JsonResponse({
                'success': True, 
                'message': f'Пользователь {username} удалён. Группы и подключения сохранены.'
            })
            
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Пользователь не найден'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
@csrf_exempt
def update_group(request):
    """Изменяет название группы"""
    if request.method == 'POST':
        try:
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'}, json_dumps_params={'ensure_ascii': False})
            
            data = json.loads(request.body)
            group_id = data.get('group_id')
            new_name = data.get('new_name')
            
            # Валидация данных
            if not group_id:
                return JsonResponse({'success': False, 'error': 'group_id не указан'}, json_dumps_params={'ensure_ascii': False})
            
            if not new_name or not new_name.strip():
                return JsonResponse({'success': False, 'error': 'Название группы не может быть пустым'}, json_dumps_params={'ensure_ascii': False})
            
            # Преобразуем group_id в int, если это строка
            try:
                group_id = int(group_id)
            except (ValueError, TypeError):
                return JsonResponse({'success': False, 'error': 'Неверный формат group_id'}, json_dumps_params={'ensure_ascii': False})
            
            # Получаем группу
            try:
                group = UserGroup.objects.get(id=group_id)
            except UserGroup.DoesNotExist:
                return JsonResponse({'success': False, 'error': 'Группа не найдена'}, json_dumps_params={'ensure_ascii': False})
            
            # Обновляем название
            new_name = new_name.strip()
            group.name = new_name
            group.save()
            
            return JsonResponse({'success': True}, json_dumps_params={'ensure_ascii': False})
            
        except Exception as e:
            import traceback
            logger.error(f"Error updating group: {e}\n{traceback.format_exc()}")
            return JsonResponse({'success': False, 'error': str(e)}, json_dumps_params={'ensure_ascii': False})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'}, json_dumps_params={'ensure_ascii': False})

@login_required
@csrf_exempt
def delete_group(request):
    """Удаляет группу"""
    if request.method == 'POST':
        try:
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
            
            data = json.loads(request.body)
            group_id = data.get('group_id')
            
            group = UserGroup.objects.get(id=group_id)
            group_name = group.name
            group.delete()
            
            return JsonResponse({'success': True, 'message': f'Группа "{group_name}" удалена'})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})


@login_required
@csrf_exempt
def change_user_role(request):
    """Изменяет роль пользователя (Администратор ↔ Пользователь)"""
    if request.method == 'POST':
        try:
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
            
            data = json.loads(request.body)
            user_id = data.get('user_id')
            new_role = data.get('role')
            
            if new_role not in ['admin', 'user']:
                return JsonResponse({'success': False, 'error': 'Неверная роль'})
            
            user = User.objects.get(id=user_id)
            user_profile = Profile.objects.get(user=user)
            old_role = user_profile.role
            
            # Нельзя изменить роль себе
            if user.id == request.user.id:
                return JsonResponse({'success': False, 'error': 'Нельзя изменить свою роль'})
            
            # Если меняем роль с администратора на пользователя, проверяем защиту
            if old_role == 'admin' and new_role == 'user':
                is_protected, error_message = check_last_admin_protection(user)
                if is_protected:
                    return JsonResponse({'success': False, 'error': error_message})
            
            # Меняем роль
            user_profile.role = new_role
            user_profile.save()
            
            role_display = 'Администратор' if new_role == 'admin' else 'Пользователь'
            return JsonResponse({
                'success': True, 
                'message': f'Роль пользователя изменена на "{role_display}"'
            })
            
        except User.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Пользователь не найден'})
        except Profile.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Профиль пользователя не найден'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
@csrf_exempt
def request_password_change(request):
    """Отправляет запрос на смену пароля пользователю"""
    if request.method == 'POST':
        try:
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
            
            data = json.loads(request.body)
            user_id = data.get('user_id')
            
            user = User.objects.get(id=user_id)
            user_profile = Profile.objects.get(user=user)
            
            # Устанавливаем флаг принудительной смены пароля
            user_profile.force_password_change = True
            user_profile.save()
            
            return JsonResponse({'success': True, 'message': f'Пользователю {user.username} отправлен запрос на смену пароля'})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})


@login_required
@csrf_exempt
def copy_group(request):
    """Копирует группу с подключениями (без пользователей)"""
    if request.method == 'POST':
        try:
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
            
            data = json.loads(request.body)
            group_id = data.get('group_id')
            
            from datetime import datetime
            from clusters.models import ServerConnection
            
            original_group = UserGroup.objects.get(id=group_id)
            
            # Создаём копию с новым названием
            date_str = datetime.now().strftime('%d.%m.%Y')
            new_name = f"{original_group.name} (копия {date_str})"
            
            new_group = UserGroup.objects.create(
                name=new_name,
                created_by=request.user
            )
            
            # Копируем все подключения к серверам 1С
            connections_copied = 0
            connections = ServerConnection.objects.filter(user_group=original_group)
            for conn in connections:
                ServerConnection.objects.create(
                    user_group=new_group,
                    display_name=conn.display_name,
                    server_host=conn.server_host,
                    ras_port=conn.ras_port,
                    cluster_admin=conn.cluster_admin,
                    cluster_password=conn.cluster_password
                )
                connections_copied += 1
            
            # Пользователей НЕ копируем согласно ТЗ
            
            message = f'Группа скопирована как "{new_name}"'
            if connections_copied > 0:
                message += f' ({connections_copied} подключений)'
            
            return JsonResponse({
                'success': True, 
                'group_id': new_group.id,
                'message': message
            })
            
        except UserGroup.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Группа не найдена'})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})


@login_required
@csrf_exempt
def merge_groups(request):
    """Объединяет несколько групп в одну с сохранением подключений"""
    if request.method == 'POST':
        try:
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
            
            data = json.loads(request.body)
            group_ids = data.get('group_ids', [])
            new_name = data.get('new_name')
            transfer_users = data.get('transfer_users', True)
            delete_old_groups = data.get('delete_old_groups', False)
            
            if len(group_ids) < 2:
                return JsonResponse({'success': False, 'error': 'Выберите минимум 2 группы для объединения'})
            
            if not new_name:
                return JsonResponse({'success': False, 'error': 'Введите название новой группы'})
            
            # Импортируем модель подключений
            from clusters.models import ServerConnection
            
            # Получаем группы
            groups = UserGroup.objects.filter(id__in=group_ids)
            
            if groups.count() != len(group_ids):
                return JsonResponse({'success': False, 'error': 'Некоторые группы не найдены'})
            
            # Создаём новую группу
            new_group = UserGroup.objects.create(
                name=new_name,
                created_by=request.user
            )
            
            # Переносим/копируем подключения к серверам 1С
            connections_copied = 0
            existing_connections = set()  # Для избежания дубликатов
            
            for group in groups:
                connections = ServerConnection.objects.filter(user_group=group)
                for conn in connections:
                    # Проверяем на дубликаты по host:port
                    conn_key = f"{conn.server_host}:{conn.ras_port}"
                    if conn_key not in existing_connections:
                        existing_connections.add(conn_key)
                        
                        if delete_old_groups:
                            # Переносим подключение (меняем группу)
                            conn.user_group = new_group
                            conn.save()
                        else:
                            # Копируем подключение
                            ServerConnection.objects.create(
                                user_group=new_group,
                                display_name=conn.display_name,
                                server_host=conn.server_host,
                                ras_port=conn.ras_port,
                                cluster_admin=conn.cluster_admin,
                                cluster_password=conn.cluster_password
                            )
                        connections_copied += 1
            
            # Переносим пользователей если нужно
            users_count = 0
            if transfer_users:
                all_users = set()
                for group in groups:
                    all_users.update(group.members.all())
                
                for user in all_users:
                    new_group.members.add(user)
                users_count = len(all_users)
            
            # Удаляем старые группы если нужно
            if delete_old_groups:
                for group in groups:
                    group.delete()
            
            message_parts = [f'Создана группа "{new_name}"']
            if connections_copied > 0:
                message_parts.append(f'{connections_copied} подключений')
            if users_count > 0:
                message_parts.append(f'{users_count} участников')
            if delete_old_groups:
                message_parts.append('старые группы удалены')
            
            return JsonResponse({
                'success': True,
                'group_id': new_group.id,
                'message': ' | '.join(message_parts)
            })
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})