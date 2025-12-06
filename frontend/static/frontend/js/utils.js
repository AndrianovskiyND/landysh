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
    return document.querySelector('[name=csrfmiddlewaretoken]').value;
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
    
    if (isError) {
        notification.style.borderLeft = '4px solid var(--primary-color)';
    } else {
        notification.style.borderLeft = '4px solid #28a745';
    }
    
    // Автоматически скрыть через 5 секунд
    setTimeout(() => {
        hideNotification();
    }, 5000);
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
 * Показать форму добавления подключения
 */
function showConnectionForm() {
    document.getElementById('connectionForm').style.display = 'block';
}

/**
 * Скрыть форму добавления подключения
 */
function hideConnectionForm() {
    document.getElementById('connectionForm').style.display = 'none';
}

