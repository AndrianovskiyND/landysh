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
                    <th>Активен</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    users.forEach(user => {
        const roleBadge = user.role === 'admin' ? 'badge-admin' : 'badge-user';
        const activeStatus = user.is_active ? '✅ Да' : '❌ Нет';
        
        html += `
            <tr>
                <td><strong>${user.username}</strong></td>
                <td>${user.first_name || '-'}</td>
                <td>${user.last_name || '-'}</td>
                <td>${user.email || '-'}</td>
                <td><span class="badge ${roleBadge}">${user.role === 'admin' ? 'Администратор' : 'Пользователь'}</span></td>
                <td>${activeStatus}</td>
                <td>
                    <div style="display: flex; gap: 0.25rem;">
                        <button class="btn btn-sm btn-primary" onclick="showUserProperties(${user.id})">📋 Свойства</button>
                        <button class="btn btn-sm" onclick="manageUserGroups(${user.id}, '${user.username}')">👥 Группы</button>
                    </div>
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
function showUserProperties(userId) {
    fetch('/api/users/list/')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const user = data.users.find(u => u.id === userId);
                if (user) {
                    renderUserPropertiesModal(user);
                }
            }
        })
        .catch(error => {
            showNotification('Ошибка загрузки данных пользователя: ' + error.message, true);
        });
}

/**
 * Отрисовать модальное окно свойств пользователя
 * @param {Object} user - Данные пользователя
 */
function renderUserPropertiesModal(user) {
    // Получаем ID текущего пользователя из глобальной переменной
    const currentUserId = window.CURRENT_USER_ID || 0;
    
    const modalHtml = `
        <div class="modal-overlay" id="userPropertiesModal">
            <div class="modal">
                <div class="modal-header">
                    <h3>👤 Свойства пользователя: ${user.username}</h3>
                    <button class="btn btn-sm" onclick="closeUserProperties()" style="background: transparent; border: none; font-size: 1.5rem; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">×</button>
                </div>
                <div class="modal-body">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                        <div class="info-card">
                            <h4>📊 Основная информация</h4>
                            <div class="info-item">
                                <label>Логин:</label>
                                <span>${user.username}</span>
                            </div>
                            <div class="info-item">
                                <label>Email:</label>
                                <span>${user.email || '-'}</span>
                            </div>
                            <div class="info-item">
                                <label>Роль:</label>
                                <span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}" style="font-size: 0.8rem; padding: 0.3rem 0.6rem;">
                                    ${user.role === 'admin' ? '👑 Администратор' : '👤 Пользователь'}
                                </span>
                            </div>
                            <div class="info-item">
                                <label>Статус:</label>
                                <span style="display: flex; align-items: center; gap: 0.5rem;">
                                    ${user.is_active ? '🟢 Активен' : '🔴 Заблокирован'}
                                </span>
                            </div>
                        </div>
                        
                        <div class="info-card">
                            <h4>📅 Даты и время</h4>
                            <div class="info-item">
                                <label>Дата регистрации:</label>
                                <span>${new Date(user.date_joined).toLocaleString('ru-RU')}</span>
                            </div>
                            <div class="info-item">
                                <label>Последний вход:</label>
                                <span>${user.last_login ? new Date(user.last_login).toLocaleString('ru-RU') : 'Никогда'}</span>
                            </div>
                            <div class="info-item">
                                <label>Последний вход (IP):</label>
                                <span>${user.last_login_at ? new Date(user.last_login_at).toLocaleString('ru-RU') : 'Нет данных'}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="action-section">
                        <h4>⚡ Действия</h4>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                            <button class="btn btn-primary" onclick="showChangePasswordForm(${user.id}, '${user.username}')"
                                    style="display: flex; align-items: center; gap: 0.5rem; justify-content: center;">
                                🔑 Сменить пароль
                            </button>
                            <button class="btn btn-secondary" onclick="requestPasswordChange(${user.id}, '${user.username}')"
                                    style="display: flex; align-items: center; gap: 0.5rem; justify-content: center;">
                                🔄 Запросить смену
                            </button>
                            ${user.id !== currentUserId ? `
                                <button class="btn ${user.is_active ? 'btn-danger' : 'btn-success'}" 
                                        onclick="toggleUserActive(${user.id}, ${!user.is_active})"
                                        style="display: flex; align-items: center; gap: 0.5rem; justify-content: center;">
                                    ${user.is_active ? '🚫 Заблокировать' : '✅ Разблокировать'}
                                </button>
                            ` : '<div></div>'}
                        </div>
                    </div>
                    
                    <div class="form-section" style="margin-top: 2rem;">
                        <h4>✏️ Редактирование данных</h4>
                        <div class="connection-form">
                            <div class="form-group">
                                <label>Имя:</label>
                                <div style="display: flex; gap: 0.5rem; align-items: center;">
                                    <input type="text" id="editFirstName" value="${user.first_name || ''}" placeholder="Иван" style="flex: 1;">
                                    <button class="btn btn-sm" onclick="updateUserField(${user.id}, 'first_name', document.getElementById('editFirstName').value)">Сохранить</button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Фамилия:</label>
                                <div style="display: flex; gap: 0.5rem; align-items: center;">
                                    <input type="text" id="editLastName" value="${user.last_name || ''}" placeholder="Иванов" style="flex: 1;">
                                    <button class="btn btn-sm" onclick="updateUserField(${user.id}, 'last_name', document.getElementById('editLastName').value)">Сохранить</button>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Email:</label>
                                <div style="display: flex; gap: 0.5rem; align-items: center;">
                                    <input type="email" id="editEmail" value="${user.email || ''}" placeholder="email@example.com" style="flex: 1;">
                                    <button class="btn btn-sm" onclick="updateUserField(${user.id}, 'email', document.getElementById('editEmail').value)">Сохранить</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="closeUserProperties()" style="background: #6C757D; color: white;">Закрыть</button>
                </div>
            </div>
        </div>
    `;
    
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = modalHtml;
}

/**
 * Закрыть модальное окно свойств пользователя
 */
function closeUserProperties() {
    const modal = document.getElementById('userPropertiesModal');
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => {
            modal.remove();
        }, 200);
    }
}

// ============================================
// Создание пользователя
// ============================================

/**
 * Показать форму создания пользователя
 */
function showCreateUserForm() {
    const contentArea = document.getElementById('contentArea');
    
    const formHtml = `
        <div style="max-width: 500px;">
            <h3>👤 Создание пользователя</h3>
            <div class="connection-form">
                <div class="form-group">
                    <label>Логин:</label>
                    <input type="text" id="newUsername" placeholder="Введите логин" required>
                </div>
                <div class="form-group">
                    <label>Пароль:</label>
                    <input type="password" id="newPassword" placeholder="Введите пароль" required>
                </div>
                <div class="form-group">
                    <label>Роль:</label>
                    <select id="newUserRole">
                        <option value="user">👤 Пользователь</option>
                        <option value="admin">⚙️ Администратор</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Email (необязательно):</label>
                    <input type="email" id="newUserEmail" placeholder="email@example.com">
                </div>
                <div class="form-group">
                    <label>Имя (необязательно):</label>
                    <input type="text" id="newUserFirstName" placeholder="Иван">
                </div>
                <div class="form-group">
                    <label>Фамилия (необязательно):</label>
                    <input type="text" id="newUserLastName" placeholder="Иванов">
                </div>
                <button class="btn btn-primary" onclick="createNewUser()">✅ Создать</button>
                <button class="btn" onclick="showUserManagement()">❌ Отмена</button>
            </div>
        </div>
    `;
    
    contentArea.innerHTML = formHtml;
}

/**
 * Создать нового пользователя
 */
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
            showNotification('❌ Ошибка создания пользователя: ' + result.error, true);
        }
    } catch (error) {
        showNotification('❌ Ошибка создания пользователя: ' + error.message, true);
    }
}

// ============================================
// Редактирование пользователя
// ============================================

/**
 * Редактировать поле пользователя (inline)
 * @param {number} userId - ID пользователя
 * @param {string} field - Название поля
 * @param {string} fieldName - Отображаемое название поля
 */
function editUserField(userId, field, fieldName) {
    const currentValue = document.getElementById(`${field}-${userId}`).textContent;
    const newValue = prompt(`Введите новое ${fieldName.toLowerCase()}:`, currentValue === '-' ? '' : currentValue);
    
    if (newValue !== null) {
        fetch('/api/users/update/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                user_id: userId,
                [field]: newValue
            })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showNotification(`✅ ${fieldName} успешно обновлен`);
                document.getElementById(`${field}-${userId}`).textContent = newValue || '-';
            } else {
                showNotification(`❌ Ошибка: ${result.error}`, true);
            }
        })
        .catch(error => {
            showNotification(`❌ Ошибка: ${error.message}`, true);
        });
    }
}

/**
 * Обновить поле пользователя
 * @param {number} userId - ID пользователя
 * @param {string} field - Название поля
 * @param {string} value - Новое значение
 */
function updateUserField(userId, field, value) {
    fetch('/api/users/update/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({
            user_id: userId,
            [field]: value
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showNotification('✅ Данные успешно обновлены');
            showUserManagement();
        } else {
            showNotification('❌ Ошибка: ' + result.error, true);
        }
    })
    .catch(error => {
        showNotification('❌ Ошибка: ' + error.message, true);
    });
}

// ============================================
// Управление паролем
// ============================================

/**
 * Показать форму смены пароля
 * @param {number} userId - ID пользователя
 * @param {string} username - Логин пользователя
 */
function showChangePasswordForm(userId, username) {
    const newPassword = prompt(`Введите новый пароль для пользователя "${username}":`, '');
    
    if (newPassword) {
        const requireChange = confirm('Требовать смену пароля при следующем входе?');
        
        fetch('/api/users/change-password/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                user_id: userId,
                new_password: newPassword,
                require_change: requireChange
            })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showNotification('✅ Пароль успешно изменен');
            } else {
                showNotification(`❌ Ошибка: ${result.error}`, true);
            }
        })
        .catch(error => {
            showNotification(`❌ Ошибка: ${error.message}`, true);
        });
    }
}

/**
 * Запросить смену пароля у пользователя
 * @param {number} userId - ID пользователя
 * @param {string} username - Логин пользователя
 */
function requestPasswordChange(userId, username) {
    if (confirm(`Отправить пользователю "${username}" запрос на смену пароля?`)) {
        fetch('/api/users/request-password-change/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                user_id: userId
            })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showNotification('✅ Запрос на смену пароля отправлен пользователю');
            } else {
                showNotification('❌ Ошибка: ' + result.error, true);
            }
        })
        .catch(error => {
            showNotification('❌ Ошибка: ' + error.message, true);
        });
    }
}

// ============================================
// Блокировка/разблокировка пользователя
// ============================================

/**
 * Переключить активность пользователя
 * @param {number} userId - ID пользователя
 * @param {boolean} isActive - Новый статус активности
 */
function toggleUserActive(userId, isActive) {
    const action = isActive ? 'разблокировать' : 'заблокировать';
    
    if (confirm(`Вы уверены, что хотите ${action} этого пользователя?`)) {
        fetch('/api/users/toggle-active/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                user_id: userId,
                is_active: isActive
            })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                showNotification(`✅ Пользователь ${action === 'разблокировать' ? 'разблокирован' : 'заблокирован'}`);
                showUserManagement();
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
// Удаление пользователя
// ============================================

/**
 * Удалить пользователя
 * @param {number} userId - ID пользователя
 * @param {string} username - Логин пользователя
 */
async function deleteUser(userId, username) {
    if (!confirm(`Вы уверены, что хотите удалить пользователя "${username}"?`)) {
        return;
    }
    
    showNotification('Удаление пользователя...');
    showNotification('Функция удаления пользователей в разработке');
}

