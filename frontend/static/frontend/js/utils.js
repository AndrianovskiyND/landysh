/**
 * Утилиты приложения Ландыш
 * Базовые функции: уведомления, CSRF, вспомогательные методы
 */

// ============================================
// CSRF Token
// ============================================

/**
 * Получить CSRF токен из формы
 * @returns {string} CSRF токен
 */
function getCSRFToken() {
    const tokenElement = document.querySelector('[name=csrfmiddlewaretoken]');
    if (!tokenElement) {
        console.error('CSRF token not found');
        // Пытаемся получить из cookie как fallback
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }
        return '';
    }
    return tokenElement.value;
}

// ============================================
// Уведомления
// ============================================

/**
 * Показать уведомление
 * @param {string} message - Текст сообщения
 * @param {boolean} isError - Является ли сообщение ошибкой
 */
function showNotification(message, isError = false) {
    let notification = document.getElementById('notification');
    let content = document.getElementById('notificationContent');
    
    // Если уведомление не существует, создаём его
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        notification.style.display = 'none';
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '1rem';
        notification.style.background = 'white';
        notification.style.border = '1px solid var(--border-color)';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
        notification.style.maxWidth = '400px';
        notification.style.zIndex = '99999';
        notification.style.userSelect = 'text';
        notification.style.cursor = 'text';
        
        content = document.createElement('div');
        content.id = 'notificationContent';
        notification.appendChild(content);
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Закрыть';
        closeBtn.style.marginTop = '0.5rem';
        closeBtn.onclick = hideNotification;
        notification.appendChild(closeBtn);
    } else {
        content = document.getElementById('notificationContent');
    }
    
    if (!notification || !content) return;
    
    // Перемещаем уведомление в конец body, чтобы оно было поверх всех элементов
    // appendChild автоматически перемещает элемент, если он уже существует в DOM
    document.body.appendChild(notification);
    
    content.innerHTML = message;
    notification.style.display = 'block';
    
    // Устанавливаем очень высокий z-index чтобы уведомление было поверх модальных окон
    notification.style.zIndex = '99999';
    notification.style.position = 'fixed';
    
    if (isError) {
        notification.style.borderLeft = '4px solid var(--primary-color)';
        // Для ошибок увеличиваем время отображения
        setTimeout(() => {
            hideNotification();
        }, 8000);
    } else {
        notification.style.borderLeft = '4px solid #28a745';
        setTimeout(() => {
            hideNotification();
        }, 5000);
    }
}

/**
 * Скрыть уведомление
 */
function hideNotification() {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.style.display = 'none';
    }
}

// ============================================
// Форма подключения
// ============================================

/**
 * Показать форму добавления подключения (устаревшая функция)
 */
function showConnectionForm() {
    // Перенаправляем на модальное окно
    if (typeof openConnectionModal === 'function') {
        openConnectionModal();
    }
}

/**
 * Скрыть форму добавления подключения (устаревшая функция)
 */
function hideConnectionForm() {
    // Перенаправляем на закрытие модального окна
    if (typeof closeConnectionModal === 'function') {
        closeConnectionModal();
    }
}

// ============================================
// Сохранение состояния навигации
// ============================================

/**
 * Сохранить текущий раздел в localStorage
 * @param {string} view - Название текущего раздела
 */
function saveCurrentView(view) {
    try {
        if (typeof(Storage) !== "undefined") {
            localStorage.setItem('landysh_current_view', view);
        }
    } catch (e) {
        console.warn('Не удалось сохранить состояние навигации:', e);
    }
}

/**
 * Получить сохранённый раздел
 * @returns {string|null} - Название сохранённого раздела
 */
function getSavedView() {
    try {
        if (typeof(Storage) !== "undefined") {
            return localStorage.getItem('landysh_current_view');
        }
    } catch (e) {
        console.warn('Не удалось прочитать состояние навигации:', e);
    }
    return null;
}

