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
    updateNavigation();
    
    document.getElementById('contentArea').innerHTML = `
        <h2>Добро пожаловать в Ландыш! 🚂</h2>
        <p>Выберите подключение слева для просмотра кластеров и управления серверами 1С.</p>
        <div style="margin-top: 2rem;">
            <h3>📊 Статистика системы</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1rem;">
                <div style="background: #f8f9fa; padding: 1rem; border-radius: 4px; text-align: center;">
                    <h4 id="connectionsCount">0</h4>
                    <p>Подключений</p>
                </div>
                <div style="background: #f8f9fa; padding: 1rem; border-radius: 4px; text-align: center;">
                    <h4 id="usersCount">0</h4>
                    <p>Пользователей</p>
                </div>
                <div style="background: #f8f9fa; padding: 1rem; border-radius: 4px; text-align: center;">
                    <h4 id="groupsCount">0</h4>
                    <p>Групп</p>
                </div>
            </div>
        </div>
    `;
    
    loadStatistics();
}

