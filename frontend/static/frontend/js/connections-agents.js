/**
 * Работа с агентами кластера - Ландыш
 * Загрузка, создание и удаление агентов
 */

// Примечание: Этот модуль зависит от:
// - connections-utils.js (escapeHtml, closeContextMenu)

/**
 * Показать таблицу агентов кластера
 */
async function showAgentsTable(connectionId) {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = '<div style="text-align: center; padding: 2rem;"><p>⏳ Загрузка агентов...</p></div>';
    
    try {
        const response = await fetch(`/api/clusters/agents/${connectionId}/`);
        const data = await response.json();
        
        if (data.success) {
            renderAgentsTable(data.agents || [], connectionId);
        } else {
            contentArea.innerHTML = `
                <div class="info-card" style="border-left: 4px solid var(--primary-color);">
                    <h4 style="color: var(--primary-color);">❌ Ошибка</h4>
                    <p style="color: #721c24; margin: 0;">${data.error || 'Неизвестная ошибка'}</p>
                </div>
            `;
        }
    } catch (error) {
        contentArea.innerHTML = `
            <div class="info-card" style="border-left: 4px solid var(--primary-color);">
                <h4 style="color: var(--primary-color);">❌ Ошибка</h4>
                <p style="color: #721c24; margin: 0;">Ошибка загрузки: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Отрисовать таблицу агентов
 */
function renderAgentsTable(agents, connectionId) {
    const contentArea = document.getElementById('contentArea');
    
    let html = `
        <div class="info-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="margin: 0;">🤖 Администраторы агента кластера</h4>
                <button class="btn btn-primary" onclick="openCreateAgentModal(${connectionId})">
                    + Создать
                </button>
            </div>
            <div id="agentsTableContainer">
    `;
    
    if (agents.length === 0) {
        html += `
            <div style="padding: 1rem; text-align: center; color: #666;">
                <p>Агентов кластера нету, выводим пустой список.</p>
            </div>
        `;
    } else {
        html += `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Имя</th>
                        <th>Аутентификация</th>
                        <th>Описание</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        agents.forEach(agent => {
            html += `
                <tr style="cursor: pointer;" 
                    oncontextmenu="showAgentContextMenu(event, ${connectionId}, '${escapeHtml(agent.name || '').replace(/'/g, "\\'")}'); return false;">
                    <td><strong>${escapeHtml(agent.name || '—')}</strong></td>
                    <td>${escapeHtml(agent.auth || '—')}</td>
                    <td>${escapeHtml(agent.descr || '—')}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
    }
    
    html += `
            </div>
        </div>
    `;
    
    contentArea.innerHTML = html;
}

// Примечание: Остальные функции для агентов (openCreateAgentModal, saveAgent, 
// deleteAgent, showAgentContextMenu) находятся в connections.js 
// и будут перенесены в следующих итерациях

