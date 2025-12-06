/**
 * Управление пользователями - Ландыш
 * CRUD операции для пользователей системы
 */

// ============================================
// Отображение списка пользователей
// ============================================

/**
 * Показать раздел управления пользователями
 */
async function showUserManagement() {
    currentView = 'users';
    if (typeof saveCurrentView === 'function') {
        saveCurrentView('users');
    }
    updateNavigation();
    
    try {
        const response = await fetch('/api/users/list/');
        const data = await response.json();
        
        if (data.success) {
            renderUserManagement(data.users);
        } else {
            showNotification('Ошибка загрузки пользователей: ' + data.error, true);
        }
    } catch (error) {
        showNotification('Ошибка загрузки пользователей: ' + error.message, true);
    }
}

/**
 * Отрисовать таблицу пользователей
 * @param {Array} users - Массив пользователей
 */
function renderUserManagement(users) {
    const contentArea = document.getElementById('contentArea');
    
    let html = `
        <div style="margin-bottom: 2rem;">
            <h2 style="margin-bottom: 0.5rem;">👥 Управление пользователями</h2>
            <button class="btn btn-primary" onclick="showCreateUserForm()">+ Создать пользователя</button>
        </div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>Логин</th>
                    <th>Имя</th>
                    <th>Фамилия</th>
                    <th>Email</th>
                    <th>Роль</th>
                    <th>Статус</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    users.forEach(user => {
        const roleBadge = user.role === 'admin' ? 'badge-admin' : 'badge-user';
        const statusBadge = user.is_active ? 'badge-success' : 'badge-danger';
        const statusText = user.is_active ? 'Активен' : 'Заблокирован';
        
        html += `
            <tr>
                <td><strong>${user.username}</strong></td>
                <td>${user.first_name || '—'}</td>
                <td>${user.last_name || '—'}</td>
                <td>${user.email || '—'}</td>
                <td><span class="badge ${roleBadge}">${user.role === 'admin' ? 'Администратор' : 'Пользователь'}</span></td>
                <td><span class="badge ${statusBadge}">${statusText}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="showUserProperties(${user.id})">Свойства</button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    contentArea.innerHTML = html;
}

// ============================================
// Свойства пользователя (модальное окно)
// ============================================

/**
 * Показать свойства пользователя
 * @param {number} userId - ID пользователя
 */
async function showUserProperties(userId) {
    try {
        const [usersResponse, groupsResponse] = await Promise.all([
            fetch('/api/users/list/'),
            fetch('/api/users/groups/all/')
        ]);
        
        const usersData = await usersResponse.json();
        const groupsData = await groupsResponse.json();
        
        if (usersData.success) {
            const user = usersData.users.find(u => u.id === userId);
            if (user) {
                const allGroups = groupsData.success ? groupsData.groups : [];
                renderUserPropertiesModal(user, allGroups);
            }
        }
    } catch (error) {
        showNotification('Ошибка загрузки данных пользователя: ' + error.message, true);
    }
}

/**
 * Отрисовать модальное окно свойств пользователя
 * @param {Object} user - Данные пользователя
 * @param {Array} allGroups - Все группы системы
 */
function renderUserPropertiesModal(user, allGroups = []) {
    const currentUserId = window.CURRENT_USER_ID || 0;
    const isOtherUser = user.id !== currentUserId;
    
    // Определяем текущую группу пользователя
    const userGroup = allGroups.find(g => g.members && g.members.some(m => m.id === user.id));
    const userGroupId = userGroup ? userGroup.id : '';
    
    // Сохраняем данные для сохранения
    window._editUserData = {
        userId: user.id,
        originalGroupId: userGroupId
    };
    
    // Генерируем опции для select группы
    const groupOptions = allGroups.map(g => 
        `<option value="${g.id}" ${g.id === userGroupId ? 'selected' : ''}>${g.name}</option>`
    ).join('');
    
    // Иконки и статусы
    const roleIcon = user.role === 'admin' ? '👑' : '👤';
    const statusIcon = user.is_active ? '🟢' : '🔴';
    const statusClass = user.is_active ? 'active' : 'blocked';
    
    const modalHtml = `
        <div class="modal-overlay" id="userPropertiesModal" onclick="closeModalOnOverlay(event)">
            <div class="modal" style="max-width: 620px;">
                <div class="modal-header">
                    <h3>👤 ${user.username}</h3>
                    <button class="modal-close-btn" onclick="closeUserProperties()">×</button>
                </div>
                <div class="modal-body">
                    <!-- Информационные карточки -->
                    <div class="info-cards-grid">
                        <div class="info-card">
                            <h4>📊 Основная информация</h4>
                            <div class="info-row">
                                <span class="info-label">Логин</span>
                                <span class="info-value"><strong>${user.username}</strong></span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Роль</span>
                                <span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}">
                                    ${roleIcon} ${user.role === 'admin' ? 'Администратор' : 'Пользователь'}
                                </span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Статус</span>
                                <span class="status-icon ${statusClass}">
                                    <span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">
                                        ${user.is_active ? 'Активен' : 'Заблокирован'}
                                    </span>
                                </span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Группа</span>
                                <span class="info-value">${userGroup ? userGroup.name : '—'}</span>
                            </div>
                        </div>
                        
                        <div class="info-card">
                            <h4>📅 Даты и активность</h4>
                            <div class="info-row">
                                <span class="info-label">Регистрация</span>
                                <span class="info-value">${new Date(user.date_joined).toLocaleDateString('ru-RU')}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Последний вход</span>
                                <span class="info-value">${user.last_login ? new Date(user.last_login).toLocaleString('ru-RU') : '—'}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Email</span>
                                <span class="info-value">${user.email || '—'}</span>
                            </div>
                            <div class="info-row">
                                <span class="info-label">Полное имя</span>
                                <span class="info-value">${user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '—'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Блок редактирования -->
                    <div class="info-card" style="margin-bottom: 1rem;">
                        <h4 style="border-bottom-color: var(--secondary-color);">✏️ Редактирование данных</h4>
                        <div class="edit-form">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                                <div class="form-row">
                                    <label for="editFirstName">Имя</label>
                                    <input type="text" id="editFirstName" value="${user.first_name || ''}" placeholder="Иван">
                                </div>
                                <div class="form-row">
                                    <label for="editLastName">Фамилия</label>
                                    <input type="text" id="editLastName" value="${user.last_name || ''}" placeholder="Иванов">
                                </div>
                            </div>
                            <div class="form-row">
                                <label for="editEmail">Email</label>
                                <input type="email" id="editEmail" value="${user.email || ''}" placeholder="email@example.com">
                            </div>
                            <div class="form-row">
                                <label for="editGroup">Группа доступа</label>
                                <select id="editGroup">
                                    <option value="">— Без группы —</option>
                                    ${groupOptions}
                                </select>
                            </div>
                        </div>
                        <button class="btn btn-primary" onclick="saveUserChanges(${user.id})" style="margin-top: 1.25rem; width: 100%;">
                            💾 Сохранить изменения
                        </button>
                    </div>
                    
                    <!-- Блок действий -->
                    <div class="info-card">
                        <h4>⚡ Действия</h4>
                        <div class="actions-grid">
                            <button class="btn btn-secondary" onclick="openChangePasswordModal(${user.id}, '${user.username}')">
                                🔑 Сменить пароль
                            </button>
                            ${isOtherUser ? `
                                <button class="btn btn-warning" onclick="requirePasswordChange(${user.id}, '${user.username}')">
                                    🔄 Требовать смену
                                </button>
                                <button class="btn ${user.is_active ? 'btn-danger' : 'btn-success'}" 
                                        onclick="toggleUserActive(${user.id}, ${!user.is_active})">
                                    ${user.is_active ? '🚫 Заблокировать' : '✅ Разблокировать'}
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="closeUserProperties()" style="background: #6c757d; color: white;">Закрыть</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('modal-container').innerHTML = modalHtml;
}

/**
 * Сохранить изменения пользователя
 */
async function saveUserChanges(userId) {
    const firstName = document.getElementById('editFirstName').value;
    const lastName = document.getElementById('editLastName').value;
    const email = document.getElementById('editEmail').value;
    const groupId = document.getElementById('editGroup').value;
    
    const originalGroupId = window._editUserData?.originalGroupId || '';
    
    try {
        // Сохраняем основные данные
        const updateResponse = await fetch('/api/users/update/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                user_id: userId,
                first_name: firstName,
                last_name: lastName,
                email: email
            })
        });
        
        const updateResult = await updateResponse.json();
        
        if (!updateResult.success) {
            showNotification('❌ Ошибка сохранения: ' + updateResult.error, true);
            return;
        }
        
        // Обновляем группу если изменилась
        if (groupId !== String(originalGroupId)) {
            // Удаляем из старой группы
            if (originalGroupId) {
                await fetch('/api/users/groups/assign/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        group_id: parseInt(originalGroupId),
                        action: 'remove'
                    })
                });
            }
            
            // Добавляем в новую группу
            if (groupId) {
                await fetch('/api/users/groups/assign/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCSRFToken()
                    },
                    body: JSON.stringify({
                        user_id: userId,
                        group_id: parseInt(groupId),
                        action: 'add'
                    })
                });
            }
        }
        
        showNotification('✅ Изменения сохранены');
        closeUserProperties();
        showUserManagement();
        
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

/**
 * Закрыть модальное окно при клике на overlay
 */
function closeModalOnOverlay(event) {
    if (event.target.classList.contains('modal-overlay')) {
        closeUserProperties();
    }
}

/**
 * Закрыть модальное окно свойств пользователя
 */
function closeUserProperties() {
    const modal = document.getElementById('userPropertiesModal');
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => modal.remove(), 200);
    }
}

// ============================================
// Модальное окно смены пароля
// ============================================

/**
 * Открыть модальное окно смены пароля
 */
function openChangePasswordModal(userId, username) {
    const modalHtml = `
        <div class="modal-overlay" id="passwordModal" onclick="closePasswordModalOnOverlay(event)">
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>Смена пароля: ${username}</h3>
                    <button class="modal-close-btn" onclick="closePasswordModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="edit-form">
                        <div class="form-row">
                            <label for="newPassword">Новый пароль</label>
                            <input type="password" id="newPassword" placeholder="Введите новый пароль">
                        </div>
                        <div class="form-row">
                            <label for="confirmPassword">Подтверждение</label>
                            <input type="password" id="confirmPassword" placeholder="Повторите пароль">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="closePasswordModal()">Отмена</button>
                    <button class="btn btn-primary" onclick="saveNewPassword(${userId})">Сохранить</button>
                </div>
            </div>
        </div>
    `;
    
    // Добавляем поверх существующего модального окна
    const container = document.getElementById('modal-container');
    container.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Сохранить новый пароль
 */
async function saveNewPassword(userId) {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!newPassword) {
        showNotification('❌ Введите пароль', true);
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showNotification('❌ Пароли не совпадают', true);
        return;
    }
    
    try {
        const response = await fetch('/api/users/change-password/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                user_id: userId,
                new_password: newPassword,
                require_change: false
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Пароль успешно изменён');
            closePasswordModal();
        } else {
            showNotification('❌ Ошибка: ' + result.error, true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

function closePasswordModalOnOverlay(event) {
    if (event.target.id === 'passwordModal') {
        closePasswordModal();
    }
}

function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => modal.remove(), 200);
    }
}

/**
 * Требовать смену пароля при следующем входе
 */
async function requirePasswordChange(userId, username) {
    if (!confirm(`Пользователь "${username}" будет обязан сменить пароль при следующем входе. Продолжить?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/users/request-password-change/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ user_id: userId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Требование смены пароля установлено');
        } else {
            showNotification('❌ Ошибка: ' + result.error, true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

// ============================================
// Блокировка/разблокировка пользователя
// ============================================

/**
 * Переключить активность пользователя
 */
async function toggleUserActive(userId, isActive) {
    const action = isActive ? 'разблокировать' : 'заблокировать';
    
    if (!confirm(`Вы уверены, что хотите ${action} этого пользователя?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/users/toggle-active/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                user_id: userId,
                is_active: isActive
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`✅ Пользователь ${isActive ? 'разблокирован' : 'заблокирован'}`);
            closeUserProperties();
            showUserManagement();
        } else {
            showNotification('❌ Ошибка: ' + result.error, true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

// ============================================
// Создание пользователя
// ============================================

function showCreateUserForm() {
    const contentArea = document.getElementById('contentArea');
    
    contentArea.innerHTML = `
        <div style="max-width: 500px;">
            <h3>Создание пользователя</h3>
            <div class="edit-form" style="background: white; padding: 1.5rem; border-radius: 8px; border: 1px solid #e5e5e7;">
                <div class="form-row">
                    <label for="newUsername">Логин *</label>
                    <input type="text" id="newUsername" placeholder="Введите логин" required>
                </div>
                <div class="form-row">
                    <label for="newPassword">Пароль *</label>
                    <input type="password" id="newPassword" placeholder="Введите пароль" required>
                </div>
                <div class="form-row">
                    <label for="newUserRole">Роль</label>
                    <select id="newUserRole">
                        <option value="user">Пользователь</option>
                        <option value="admin">Администратор</option>
                    </select>
                </div>
                <div class="form-row">
                    <label for="newUserEmail">Email</label>
                    <input type="email" id="newUserEmail" placeholder="email@example.com">
                </div>
                <div class="form-row">
                    <label for="newUserFirstName">Имя</label>
                    <input type="text" id="newUserFirstName" placeholder="Иван">
                </div>
                <div class="form-row">
                    <label for="newUserLastName">Фамилия</label>
                    <input type="text" id="newUserLastName" placeholder="Иванов">
                </div>
                <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
                    <button class="btn btn-primary" onclick="createNewUser()">Создать</button>
                    <button class="btn" onclick="showUserManagement()">Отмена</button>
                </div>
            </div>
        </div>
    `;
}

async function createNewUser() {
    const userData = {
        username: document.getElementById('newUsername').value,
        password: document.getElementById('newPassword').value,
        role: document.getElementById('newUserRole').value,
        email: document.getElementById('newUserEmail').value,
        first_name: document.getElementById('newUserFirstName').value,
        last_name: document.getElementById('newUserLastName').value
    };
    
    if (!userData.username || !userData.password) {
        showNotification('❌ Заполните логин и пароль', true);
        return;
    }
    
    try {
        const response = await fetch('/api/users/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(userData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Пользователь успешно создан');
            showUserManagement();
        } else {
            showNotification('❌ Ошибка: ' + result.error, true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}
