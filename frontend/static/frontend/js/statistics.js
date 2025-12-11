/**
 * Статистика - Ландыш
 * Загрузка и отображение статистики системы
 */

/**
 * Загрузить статистику системы
 */
async function loadStatistics() {
    try {
        const [connCountResponse, usersResponse, groupsResponse] = await Promise.all([
            fetch('/api/clusters/connections/count/'),
            fetch('/api/users/list/'),
            fetch('/api/users/groups/all/')
        ]);
        
        const connCountData = await connCountResponse.json();
        const usersData = await usersResponse.json();
        const groupsData = await groupsResponse.json();
        
        // Обновляем счетчики на странице
        const connectionsCount = document.getElementById('connectionsCount');
        const usersCount = document.getElementById('usersCount');
        const groupsCount = document.getElementById('groupsCount');
        
        if (connCountData.success && connectionsCount) {
            connectionsCount.textContent = connCountData.count || 0;
        }
        
        if (usersData.success && usersCount) {
            usersCount.textContent = usersData.users.length;
        }
        
        if (groupsData.success && groupsCount) {
            groupsCount.textContent = groupsData.groups.length;
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

