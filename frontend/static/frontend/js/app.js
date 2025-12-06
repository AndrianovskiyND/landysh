/**
 * Главный модуль приложения Ландыш
 * Инициализация и глобальные настройки
 */

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

