/**
 * Работа с рабочими серверами - Ландыш
 * Загрузка, создание, редактирование и удаление рабочих серверов
 */

// Примечание: Этот модуль зависит от:
// - connections-utils.js (escapeHtml, closeContextMenu)
// - connections-core.js (addClusterAdminParams)

/**
 * Загружает рабочие серверы в дерево
 */
async function loadServersIntoTree(connectionId, clusterUuid, sectionId) {
    const childrenContainer = document.getElementById(`${sectionId}-children`);
    if (!childrenContainer) return;
    
    // Убеждаемся, что контейнер видим перед загрузкой
    if (childrenContainer.style.display === 'none') {
        childrenContainer.style.display = 'block';
    }
    
    childrenContainer.innerHTML = '<div style="padding: 0.5rem; color: #666; font-style: italic;">⏳ Загрузка...</div>';
    
    try {
        const url = addClusterAdminParams(`/api/clusters/servers/${connectionId}/?cluster=${clusterUuid}`, connectionId, clusterUuid);
        const response = await fetch(url);
        const data = await response.json();
        
        // Проверяем, что контейнер все еще существует (на случай переключения подключений)
        const currentContainer = document.getElementById(`${sectionId}-children`);
        if (!currentContainer) return;
        
        if (data.success) {
            const servers = data.servers || [];
            
            if (servers.length === 0) {
                currentContainer.innerHTML = `
                    <div style="padding: 0.5rem; color: #666; font-style: italic;">
                        Рабочие серверы не найдены
                    </div>
                `;
            } else {
                let html = '';
                servers.forEach((server) => {
                    // Используем host из server, если нет - из data, если нет - name, если нет - uuid
                    const serverHost = server.host || server.data?.host || server.data?.['agent-host'] || server.name || `Сервер ${server.uuid.substring(0, 8)}`;
                    html += `
                        <div class="tree-item" 
                             data-server-uuid="${server.uuid}"
                             data-connection-id="${connectionId}"
                             data-cluster-uuid="${clusterUuid}"
                             style="cursor: pointer; padding: 0.5rem; border-radius: 4px; margin: 0.25rem 0; display: flex; align-items: center; gap: 0.5rem;"
                             oncontextmenu="showServerContextMenu(event, ${connectionId}, '${clusterUuid}', '${server.uuid}', '${escapeHtml(serverHost).replace(/'/g, "\\'")}'); return false;">
                            <span class="tree-icon">⚙️</span>
                            <span>${escapeHtml(serverHost)}</span>
                        </div>
                    `;
                });
                currentContainer.innerHTML = html;
                
                // Добавляем обработчики кликов
                currentContainer.querySelectorAll('[data-server-uuid]').forEach(item => {
                    item.addEventListener('click', (e) => {
                        if (e.button === 0) {
                            const uuid = item.getAttribute('data-server-uuid');
                            const connId = item.getAttribute('data-connection-id');
                            const clustUuid = item.getAttribute('data-cluster-uuid');
                            openServerProperties(connId, clustUuid, uuid);
                        }
                    });
                });
            }
        } else {
            currentContainer.innerHTML = `
                <div style="padding: 0.5rem; color: #d52b1e;">
                    ❌ Ошибка: ${data.error || 'Неизвестная ошибка'}
                </div>
            `;
        }
    } catch (error) {
        const errorContainer = document.getElementById(`${sectionId}-children`);
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div style="padding: 0.5rem; color: #d52b1e;">
                    ❌ Ошибка загрузки: ${error.message}
                </div>
            `;
        }
    }
}

/**
 * Загружает рабочие серверы
 */
async function loadServers(connectionId, clusterUuid) {
    const url = addClusterAdminParams(`/api/clusters/servers/${connectionId}/?cluster=${clusterUuid}`, connectionId, clusterUuid);
    const response = await fetch(url);
    const data = await response.json();
    
    const contentArea = document.getElementById('contentArea');
    if (data.success) {
        const servers = data.servers || [];
        
        let html = `
            <div class="info-card">
                <h4>⚙️ Рабочие серверы</h4>
        `;
        
        if (servers.length === 0) {
            html += `
                <div style="padding: 1rem; text-align: center; color: #666;">
                    <p>Рабочие серверы не найдены</p>
                </div>
            `;
        } else {
            html += `<div class="clusters-tree">`;
            servers.forEach((server) => {
                const serverName = server.name || `Рабочий сервер ${server.uuid.substring(0, 8)}`;
                html += `
                    <div class="tree-item" 
                         data-server-uuid="${server.uuid}"
                         data-connection-id="${connectionId}"
                         data-cluster-uuid="${clusterUuid}"
                         style="cursor: pointer; padding: 0.5rem; border-radius: 4px; margin: 0.25rem 0;"
                         oncontextmenu="showServerContextMenu(event, ${connectionId}, '${clusterUuid}', '${server.uuid}', '${escapeHtml(serverName).replace(/'/g, "\\'")}'); return false;">
                        <span class="tree-icon">⚙️</span>
                        <span>${escapeHtml(serverName)}</span>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        html += `</div>`;
        contentArea.innerHTML = html;
        
        // Добавляем обработчики кликов для открытия свойств
        contentArea.querySelectorAll('[data-server-uuid]').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.button === 0) { // Левый клик
                    const uuid = item.getAttribute('data-server-uuid');
                    const connId = item.getAttribute('data-connection-id');
                    const clustUuid = item.getAttribute('data-cluster-uuid');
                    openServerProperties(connId, clustUuid, uuid);
                }
            });
        });
    } else {
        contentArea.innerHTML = `
            <div class="info-card" style="border-left: 4px solid var(--primary-color);">
                <h4 style="color: var(--primary-color);">❌ Ошибка</h4>
                <p style="color: #721c24; margin: 0;">${data.error || 'Неизвестная ошибка'}</p>
            </div>
        `;
    }
}

/**
 * Показывает контекстное меню для рабочего сервера
 */
function showServerContextMenu(event, connectionId, clusterUuid, serverUuid, serverName) {
    event.preventDefault();
    event.stopPropagation();
    
    const existingMenu = document.getElementById('serverContextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.id = 'serverContextMenu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.style.zIndex = '10000';
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="openServerProperties(${connectionId}, '${clusterUuid}', '${serverUuid}'); closeContextMenu();">
            📋 Свойства
        </div>
        <div class="context-menu-item" onclick="openRulesModal(${connectionId}, '${clusterUuid}', '${serverUuid}', '${escapeHtml(serverName).replace(/'/g, "\\'")}'); closeContextMenu();">
            📐 ТНФ
        </div>
        <div class="context-menu-item" onclick="openProcessesModal(${connectionId}, '${clusterUuid}', '${serverUuid}'); closeContextMenu();">
            🔄 Процессы
        </div>
        <div class="context-menu-item" onclick="deleteServer(${connectionId}, '${clusterUuid}', '${serverUuid}', '${escapeHtml(serverName).replace(/'/g, "\\'")}'); closeContextMenu();">
            🗑️ Удалить
        </div>
    `;
    
    document.body.appendChild(menu);
    
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            closeContextMenu();
            document.removeEventListener('click', closeMenu);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 100);
}

// Примечание: Остальные функции для рабочих серверов (openCreateServerModal, saveCreateServer, 
// openServerProperties, saveServerProperties, deleteServer) находятся в connections.js 
// и будут перенесены в следующих итерациях

