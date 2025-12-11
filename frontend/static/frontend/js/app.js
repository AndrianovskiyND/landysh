/**
 * Главный модуль приложения Ландыш
 * Инициализация и глобальные настройки
 */

// ============================================
// Выпадающее меню пользователя
// ============================================

/**
 * Переключить выпадающее меню пользователя
 */
function toggleUserMenu(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('userMenuDropdown');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Закрыть меню при клике вне его
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('userMenuDropdown');
    const trigger = event.target.closest('.user-menu-trigger');
    if (dropdown && !trigger && !event.target.closest('.user-menu-dropdown')) {
        dropdown.classList.remove('show');
    }
});

// ============================================
// Смена пароля для текущего пользователя
// ============================================

/**
 * Открыть свойства текущего пользователя
 */
function openMyProperties() {
    const dropdown = document.getElementById('userMenuDropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
    
    const currentUserId = window.CURRENT_USER_ID || 0;
    if (currentUserId && typeof showUserProperties === 'function') {
        showUserProperties(currentUserId);
    } else {
        showNotification('❌ Не удалось открыть свойства пользователя', true);
    }
}

/**
 * Открыть модальное окно смены пароля для текущего пользователя
 */
function openChangePasswordModal() {
    const dropdown = document.getElementById('userMenuDropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
    }
    
    const currentUserId = window.CURRENT_USER_ID || 0;
    const currentUsername = document.querySelector('.user-menu-trigger span')?.textContent?.trim() || 'Пользователь';
    
    // Создаем модальное окно для текущего пользователя
    showChangePasswordModal(currentUserId, currentUsername);
}

/**
 * Показать модальное окно смены пароля
 */
function showChangePasswordModal(userId, username) {
    const modalHtml = `
        <div class="modal-overlay optimized" id="changePasswordModal">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>🔑 Смена пароля</h3>
                    <button class="modal-close-btn" onclick="closeChangePasswordModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-row">
                        <label for="currentPassword">Текущий пароль</label>
                        <input type="password" id="currentPassword" placeholder="Введите текущий пароль">
                    </div>
                    <div class="form-row">
                        <label for="newPassword1">Новый пароль</label>
                        <input type="password" id="newPassword1" placeholder="Введите новый пароль">
                    </div>
                    <div class="form-row">
                        <label for="newPassword2">Подтвердите новый пароль</label>
                        <input type="password" id="newPassword2" placeholder="Повторите новый пароль">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="saveCurrentUserPassword(${userId})">
                        💾 Сохранить
                    </button>
                    <button class="btn" onclick="closeChangePasswordModal()" style="background: #6c757d; color: white;">
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        modalContainer.innerHTML = modalHtml;
    } else {
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
}

/**
 * Закрыть модальное окно смены пароля
 */
function closeChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Сохранить пароль текущего пользователя
 */
async function saveCurrentUserPassword(userId) {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword1 = document.getElementById('newPassword1').value;
    const newPassword2 = document.getElementById('newPassword2').value;
    
    if (!currentPassword) {
        showNotification('❌ Введите текущий пароль', true);
        return;
    }
    
    if (!newPassword1 || !newPassword2) {
        showNotification('❌ Заполните все поля для нового пароля', true);
        return;
    }
    
    if (newPassword1 !== newPassword2) {
        showNotification('❌ Новые пароли не совпадают', true);
        return;
    }
    
    if (newPassword1.length < 6) {
        showNotification('❌ Пароль должен содержать минимум 6 символов', true);
        return;
    }
    
    try {
        const response = await fetch('/api/users/change-own-password/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password1: newPassword1,
                new_password2: newPassword2
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('✅ Пароль успешно изменен');
            closeChangePasswordModal();
            // Можно предложить перезагрузить страницу или выйти
            setTimeout(() => {
                if (confirm('Пароль изменен. Рекомендуется перезагрузить страницу. Перезагрузить сейчас?')) {
                    window.location.reload();
                }
            }, 1000);
        } else {
            showNotification('❌ Ошибка: ' + (data.error || 'Не удалось изменить пароль'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

// ============================================
// Инициализация приложения
// ============================================

/**
 * Инициализация приложения при загрузке страницы
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚂 Ландыш: Инициализация приложения...');
    
    // Загружаем подключения
    loadConnections();
    
    // Восстанавливаем последний открытый раздел
    restoreLastView();
    
    console.log('🚂 Ландыш: Приложение готово к работе!');
});

/**
 * Восстановить последний открытый раздел
 */
function restoreLastView() {
    try {
        const savedView = typeof getSavedView === 'function' ? getSavedView() : null;
        const isAdmin = window.IS_ADMIN || false;
        
        if (savedView) {
            // Проверяем доступность раздела для текущего пользователя
            const adminOnlyViews = ['users', 'groups', 'settings'];
            
            if (adminOnlyViews.includes(savedView) && !isAdmin) {
                // Обычный пользователь не может открыть админские разделы
                if (typeof showDashboard === 'function') {
                    showDashboard();
                }
            } else {
                // Восстанавливаем сохранённый раздел
                switch (savedView) {
                    case 'users':
                        if (typeof showUserManagement === 'function') {
                            showUserManagement();
                        }
                        break;
                    case 'groups':
                        if (typeof showGroupManagement === 'function') {
                            showGroupManagement();
                        }
                        break;
                    case 'settings':
                        if (typeof showSystemSettings === 'function') {
                            showSystemSettings();
                        }
                        break;
                    default:
                        if (typeof showDashboard === 'function') {
                            showDashboard();
                        }
                }
            }
        } else {
            if (typeof showDashboard === 'function') {
                showDashboard();
            }
        }
    } catch (error) {
        console.error('Ошибка при восстановлении последнего раздела:', error);
        // В случае ошибки просто показываем dashboard
        if (typeof showDashboard === 'function') {
            showDashboard();
        }
    }
}

