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
    const notification = document.getElementById('notification');
    const content = document.getElementById('notificationContent');
    
    if (!notification || !content) return;
    
    content.innerHTML = message;
    notification.style.display = 'block';
    
    // Устанавливаем высокий z-index чтобы уведомление было поверх модальных окон
    notification.style.zIndex = '10000';
    
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

