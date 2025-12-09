/**
 * Утилиты для работы с подключениями - Ландыш
 * Вспомогательные функции для парсинга и форматирования
 */

/**
 * Парсит вывод cluster list в структурированный формат
 */
function parseClusterList(output) {
    const clusters = [];
    if (!output) return clusters;
    
    const lines = output.trim().split('\n');
    let currentCluster = null;
    
    for (let line of lines) {
        line = line.trim();
        if (!line) {
            if (currentCluster) {
                clusters.push(currentCluster);
                currentCluster = null;
            }
            continue;
        }
        
        if (line.includes(':')) {
            const parts = line.split(':', 2);
            const key = parts[0].trim();
            const value = parts[1] ? parts[1].trim() : '';
            
            if (key === 'cluster') {
                if (currentCluster) {
                    clusters.push(currentCluster);
                }
                currentCluster = {
                    uuid: value,
                    name: '',
                    data: {}
                };
            } else if (currentCluster) {
                currentCluster.data[key] = value;
                if (key === 'name') {
                    currentCluster.name = value.replace(/^"|"$/g, '');
                }
            }
        }
    }
    
    if (currentCluster) {
        clusters.push(currentCluster);
    }
    
    return clusters;
}

/**
 * Экранирует HTML для безопасного отображения
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Форматирует вывод RAC для читаемого отображения
 */
function formatRACOutput(output) {
    if (!output) return 'Нет данных';
    
    // Простое форматирование - можно улучшить в будущем
    return output.trim();
}

/**
 * Закрывает все контекстные меню
 */
function closeContextMenu() {
    const menus = ['sectionContextMenu', 'infobaseContextMenu', 'serverContextMenu', 'clusterContextMenu', 'adminsContextMenu', 'contextMenu'];
    menus.forEach(id => {
        const menu = document.getElementById(id);
        if (menu) {
            menu.remove();
        }
    });
}

