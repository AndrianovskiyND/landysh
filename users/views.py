import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth import update_session_auth_hash
from core.models import Profile
from .models import UserGroup

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
    """Возвращает список всех пользователей (только для админов)"""
    try:
        profile = Profile.objects.get(user=request.user)
        if not profile.is_admin():
            return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
    except Profile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
    
    users = User.objects.all()
    user_data = []
    
    for user in users:
        try:
            user_profile = Profile.objects.get(user=user)
            role = user_profile.role
            last_login_at = user_profile.last_login_at.isoformat() if user_profile.last_login_at else None
        except Profile.DoesNotExist:
            role = 'user'
            last_login_at = None
        
        user_data.append({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_active': user.is_active,
            'role': role,
            'last_login': user.last_login.isoformat() if user.last_login else None,
            'last_login_at': last_login_at,
            'date_joined': user.date_joined.isoformat(),
        })
    
    return JsonResponse({'success': True, 'users': user_data})

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
            Profile.objects.create(user=user, role=role)
            
            return JsonResponse({'success': True, 'user_id': user.id})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
def all_groups(request):
    """Возвращает список всех групп (только для админов)"""
    try:
        profile = Profile.objects.get(user=request.user)
        if not profile.is_admin():
            return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
    except Profile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
    
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
    """Обновляет данные пользователя"""
    if request.method == 'POST':
        try:
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
            
            data = json.loads(request.body)
            user_id = data.get('user_id')
            first_name = data.get('first_name')
            last_name = data.get('last_name')
            email = data.get('email')
            
            user = User.objects.get(id=user_id)
            
            if first_name is not None:
                user.first_name = first_name
            if last_name is not None:
                user.last_name = last_name
            if email is not None:
                user.email = email
            
            user.save()
            
            return JsonResponse({'success': True})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

@login_required
@csrf_exempt
def change_password(request):
    """Изменяет пароль пользователя"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_id = data.get('user_id')
            new_password = data.get('new_password')
            require_change = data.get('require_change', False)
            
            # Админ может менять пароль любому пользователю
            profile = Profile.objects.get(user=request.user)
            if not profile.is_admin():
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
            
            user = User.objects.get(id=user_id)
            user.set_password(new_password)
            
            # Здесь можно добавить логику для принудительной смены пароля
            user_profile = Profile.objects.get(user=user)
            user_profile.force_password_change = require_change
            user_profile.save()
            
            user.save()
            
            # Если админ меняет свой пароль, обновляем сессию
            if user.id == request.user.id:
                update_session_auth_hash(request, user)
            
            return JsonResponse({'success': True})
            
        except Exception as e:
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
            
            user.is_active = is_active
            user.save()
            
            action = "разблокирован" if is_active else "заблокирован"
            return JsonResponse({'success': True, 'message': f'Пользователь {action}'})
            
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
                return JsonResponse({'success': False, 'error': 'Доступ запрещен'})
            
            data = json.loads(request.body)
            group_id = data.get('group_id')
            new_name = data.get('new_name')
            
            group = UserGroup.objects.get(id=group_id)
            group.name = new_name
            group.save()
            
            return JsonResponse({'success': True})
            
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Only POST allowed'})

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