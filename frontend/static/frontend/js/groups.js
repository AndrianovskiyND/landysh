/**
 * Управление группами - Ландыш
 * CRUD операции для групп пользователей
 */

// ============================================
// Отображение списка групп
// ============================================

/**
 * Показать раздел управления группами
 */
async function showGroupManagement() {
    currentView = 'groups';
    updateNavigation();
    
    try {
        const response = await fetch('/api/users/groups/all/');
        const data = await response.json();
        
        if (data.success) {
            renderGroupManagement(data.groups);
        } else {
            showNotification('Ошибка загрузки групп: ' + data.error, true);
        }
    } catch (error) {
        showNotification('Ошибка загрузки групп: ' + error.message, true);
    }
}

/**
 * Отрисовать таблицу групп
 * @param {Array} groups - Массив групп
 */
function renderGroupManagement(groups) {
    const contentArea = document.getElementById('contentArea');
    
    let html = `
        <div style="margin-bottom: 2rem;">
            <h2 style="margin-bottom: 0.5rem;">📁 Управление группами</h2>
        </div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Название</th>
                    <th>Создатель</th>
                    <th>Участников</th>
                    <th>Дата создания</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    groups.forEach(group => {
        html += `
            <tr>
                <td>${group.id}</td>
                <td>
                    <span id="groupName-${group.id}"><strong>${group.name}</strong></span>
                    <button class="btn btn-sm" onclick="editGroupName(${group.id}, '${group.name}')">✏️</button>
                </td>
                <td>${group.created_by}</td>
                <td>${group.members_count}</td>
                <td>${new Date(group.created_at).toLocaleDateString('ru-RU')}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteGroup(${group.id}, '${group.name}')">🗑️ Удалить</button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    contentArea.innerHTML = html;
}

// ============================================
// Редактирование группы
// ============================================

/**
 * Редактировать название группы
 * @param {number} groupId - ID группы
 * @param {string} currentName - Текущее название группы
 */
function editGroupName(groupId, currentName) {
    const newName = prompt('Введите новое название группы:', currentName);
    
    if (newName && newName !== currentName) {
        fetch('/api/users/groups/update/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                group_id: groupId,
                new_name: newName
            })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showNotification('✅ Название группы успешно изменено');
                showGroupManagement();
            } else {
                showNotification(`❌ Ошибка: ${result.error}`, true);
            }
        })
        .catch(error => {
            showNotification(`❌ Ошибка: ${error.message}`, true);
        });
    }
}

// ============================================
// Удаление группы
// ============================================

/**
 * Удалить группу
 * @param {number} groupId - ID группы
 * @param {string} groupName - Название группы
 */
async function deleteGroup(groupId, groupName) {
    if (!confirm(`Вы уверены, что хотите удалить группу "${groupName}"?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/users/groups/delete/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                group_id: groupId
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Группа успешно удалена');
            showGroupManagement();
        } else {
            showNotification(`❌ Ошибка: ${result.error}`, true);
        }
    } catch (error) {
        showNotification(`❌ Ошибка: ${error.message}`, true);
    }
}

// ============================================
// Управление членством в группах
// ============================================

/**
 * Управление группами пользователя
 * @param {number} userId - ID пользователя
 * @param {string} username - Логин пользователя
 */
async function manageUserGroups(userId, username) {
    try {
        const [groupsResponse, userGroupsResponse] = await Promise.all([
            fetch('/api/users/groups/all/'),
            fetch('/api/users/groups/')
        ]);
        
        const groupsData = await groupsResponse.json();
        const userGroupsData = await userGroupsResponse.json();
        
        if (!groupsData.success) {
            showNotification('Ошибка загрузки групп', true);
            return;
        }
        
        renderUserGroupsManagement(userId, username, groupsData.groups, userGroupsData.groups || []);
    } catch (error) {
        showNotification('Ошибка: ' + error.message, true);
    }
}

/**
 * Отрисовать интерфейс управления группами пользователя
 * @param {number} userId - ID пользователя
 * @param {string} username - Логин пользователя
 * @param {Array} allGroups - Все группы
 * @param {Array} userGroups - Группы пользователя
 */
function renderUserGroupsManagement(userId, username, allGroups, userGroups) {
    const contentArea = document.getElementById('contentArea');
    
    const userGroupIds = userGroups.map(g => g.id);
    
    let html = `
        <div style="margin-bottom: 1rem;">
            <button class="btn" onclick="showUserManagement()">← Назад к пользователям</button>
        </div>
        <h2>👥 Группы пользователя: ${username}</h2>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem;">
            <div>
                <h4>Доступные группы</h4>
                <div style="max-height: 400px; overflow-y: auto;">
    `;
    
    allGroups.forEach(group => {
        if (!userGroupIds.includes(group.id)) {
            html += `
                <div class="tree-node" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${group.name}</strong>
                        <div style="font-size: 0.8rem; color: #666;">Участников: ${group.members_count}</div>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="toggleGroupMembership(${userId}, ${group.id}, 'add')">✅ Добавить</button>
                </div>
            `;
        }
    });
    
    html += `
                </div>
            </div>
            <div>
                <h4>Группы пользователя</h4>
                <div style="max-height: 400px; overflow-y: auto;">
    `;
    
    allGroups.forEach(group => {
        if (userGroupIds.includes(group.id)) {
            html += `
                <div class="tree-node" style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${group.name}</strong>
                        <div style="font-size: 0.8rem; color: #666;">Участников: ${group.members_count}</div>
                    </div>
                    <button class="btn btn-sm btn-danger" onclick="toggleGroupMembership(${userId}, ${group.id}, 'remove')">❌ Удалить</button>
                </div>
            `;
        }
    });
    
    html += `
                </div>
            </div>
        </div>
    `;
    
    contentArea.innerHTML = html;
}

/**
 * Переключить членство в группе
 * @param {number} userId - ID пользователя
 * @param {number} groupId - ID группы
 * @param {string} action - Действие ('add' или 'remove')
 */
async function toggleGroupMembership(userId, groupId, action) {
    try {
        const response = await fetch('/api/users/groups/assign/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                user_id: userId,
                group_id: groupId,
                action: action
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`✅ Пользователь ${action === 'add' ? 'добавлен в' : 'удален из'} группу`);
            
            // Обновляем интерфейс
            const userResponse = await fetch('/api/users/list/');
            const userData = await userResponse.json();
            
            if (userData.success) {
                const user = userData.users.find(u => u.id === userId);
                if (user) {
                    manageUserGroups(userId, user.username);
                }
            }
        } else {
            showNotification('❌ Ошибка: ' + result.error, true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

