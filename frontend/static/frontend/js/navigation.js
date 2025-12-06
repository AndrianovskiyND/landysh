/**
 * Навигация приложения Ландыш
 * Управление состоянием навигации и переключение видов
 */

// Глобальная переменная текущего вида
let currentView = 'dashboard';

/**
 * Обновить состояние кнопок навигации
 */
function updateNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const navButtons = document.querySelectorAll('.nav-btn');
    
    switch (currentView) {
        case 'dashboard':
            if (navButtons[0]) navButtons[0].classList.add('active');
            break;
        case 'users':
            if (navButtons[1]) navButtons[1].classList.add('active');
            break;
        case 'groups':
            if (navButtons[2]) navButtons[2].classList.add('active');
            break;
        case 'settings':
            if (navButtons[3]) navButtons[3].classList.add('active');
            break;
    }
}

/**
 * Показать главную панель (Dashboard)
 */
function showDashboard() {
    currentView = 'dashboard';
    if (typeof saveCurrentView === 'function') {
        saveCurrentView('dashboard');
    }
    updateNavigation();
    
    const isAdmin = window.IS_ADMIN || false;
    
    let html = `
        <h2>Добро пожаловать в Ландыш! 🚂</h2>
        <p>Выберите подключение слева для просмотра кластеров и управления серверами 1С.</p>
    `;
    
    // Статистика только для администраторов
    if (isAdmin) {
        html += `
            <div style="margin-top: 2rem;">
                <h3>📊 Статистика системы</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                    <div class="info-card" style="text-align: center; margin-bottom: 0;">
                        <h4 id="connectionsCount" style="font-size: 2rem; color: var(--primary-color); margin: 0; border: none; padding: 0;">0</h4>
                        <p style="margin: 0.5rem 0 0 0; color: #666;">Подключений</p>
                    </div>
                    <div class="info-card" style="text-align: center; margin-bottom: 0;">
                        <h4 id="usersCount" style="font-size: 2rem; color: var(--secondary-color); margin: 0; border: none; padding: 0;">0</h4>
                        <p style="margin: 0.5rem 0 0 0; color: #666;">Пользователей</p>
                    </div>
                    <div class="info-card" style="text-align: center; margin-bottom: 0;">
                        <h4 id="groupsCount" style="font-size: 2rem; color: #6366f1; margin: 0; border: none; padding: 0;">0</h4>
                        <p style="margin: 0.5rem 0 0 0; color: #666;">Групп</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    document.getElementById('contentArea').innerHTML = html;
    
    // Загружаем статистику только для админов
    if (isAdmin) {
        loadStatistics();
    }
}

