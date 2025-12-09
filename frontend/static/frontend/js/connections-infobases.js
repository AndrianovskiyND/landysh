/**
 * Работа с информационными базами - Ландыш
 * Загрузка, создание, редактирование и удаление информационных баз
 */

// Примечание: Этот модуль зависит от:
// - connections-utils.js (escapeHtml, closeContextMenu)
// - connections-core.js (addClusterAdminParams)

/**
 * Загружает информационные базы в дерево
 */
async function loadInfobasesIntoTree(connectionId, clusterUuid, sectionId) {
    const childrenContainer = document.getElementById(`${sectionId}-children`);
    if (!childrenContainer) return;
    
    // Убеждаемся, что контейнер видим перед загрузкой
    if (childrenContainer.style.display === 'none') {
        childrenContainer.style.display = 'block';
    }
    
    childrenContainer.innerHTML = '<div style="padding: 0.5rem; color: #666; font-style: italic;">⏳ Загрузка...</div>';
    
    try {
        const url = addClusterAdminParams(`/api/clusters/infobases/${connectionId}/?cluster=${clusterUuid}`, connectionId, clusterUuid);
        const response = await fetch(url);
        const data = await response.json();
        
        // Проверяем, что контейнер все еще существует (на случай переключения подключений)
        const currentContainer = document.getElementById(`${sectionId}-children`);
        if (!currentContainer) return;
        
        if (data.success) {
            const infobases = data.infobases || [];
            
            if (infobases.length === 0) {
                currentContainer.innerHTML = `
                    <div style="padding: 0.5rem; color: #666; font-style: italic;">
                        Информационные базы не найдены
                    </div>
                `;
            } else {
                let html = '';
                infobases.forEach((infobase) => {
                    const infobaseName = infobase.name || `Информационная база ${infobase.uuid.substring(0, 8)}`;
                    html += `
                        <div class="tree-item" 
                             data-infobase-uuid="${infobase.uuid}"
                             data-connection-id="${connectionId}"
                             data-cluster-uuid="${clusterUuid}"
                             style="cursor: pointer; padding: 0.5rem; border-radius: 4px; margin: 0.25rem 0; display: flex; align-items: center; gap: 0.5rem;"
                             oncontextmenu="showInfobaseContextMenu(event, ${connectionId}, '${clusterUuid}', '${infobase.uuid}', '${escapeHtml(infobaseName).replace(/'/g, "\\'")}'); return false;">
                            <span class="tree-icon">📁</span>
                            <span>${escapeHtml(infobaseName)}</span>
                        </div>
                    `;
                });
                currentContainer.innerHTML = html;
                
                // Добавляем обработчики кликов
                currentContainer.querySelectorAll('[data-infobase-uuid]').forEach(item => {
                    item.addEventListener('click', (e) => {
                        if (e.button === 0) {
                            const uuid = item.getAttribute('data-infobase-uuid');
                            const connId = item.getAttribute('data-connection-id');
                            const clustUuid = item.getAttribute('data-cluster-uuid');
                            openInfobaseProperties(connId, clustUuid, uuid);
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
 * Загружает информационные базы
 */
async function loadInfobases(connectionId, clusterUuid) {
    const url = addClusterAdminParams(`/api/clusters/infobases/${connectionId}/?cluster=${clusterUuid}`, connectionId, clusterUuid);
    const response = await fetch(url);
    const data = await response.json();
    
    const contentArea = document.getElementById('contentArea');
    if (data.success) {
        const infobases = data.infobases || [];
        
        let html = `
            <div class="info-card">
                <h4>📁 Информационные базы</h4>
        `;
        
        if (infobases.length === 0) {
            html += `
                <div style="padding: 1rem; text-align: center; color: #666;">
                    <p>Информационные базы не найдены</p>
                </div>
            `;
        } else {
            html += `<div class="clusters-tree">`;
            infobases.forEach((infobase) => {
                const infobaseName = infobase.name || `Информационная база ${infobase.uuid.substring(0, 8)}`;
                html += `
                    <div class="tree-item" 
                         data-infobase-uuid="${infobase.uuid}"
                         data-connection-id="${connectionId}"
                         data-cluster-uuid="${clusterUuid}"
                         style="cursor: pointer; padding: 0.5rem; border-radius: 4px; margin: 0.25rem 0;"
                         oncontextmenu="showInfobaseContextMenu(event, ${connectionId}, '${clusterUuid}', '${infobase.uuid}', '${escapeHtml(infobaseName).replace(/'/g, "\\'")}'); return false;">
                        <span class="tree-icon">📁</span>
                        <span>${escapeHtml(infobaseName)}</span>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        html += `</div>`;
        contentArea.innerHTML = html;
        
        // Добавляем обработчики кликов для открытия свойств
        contentArea.querySelectorAll('[data-infobase-uuid]').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.button === 0) { // Левый клик
                    const uuid = item.getAttribute('data-infobase-uuid');
                    const connId = item.getAttribute('data-connection-id');
                    const clustUuid = item.getAttribute('data-cluster-uuid');
                    openInfobaseProperties(connId, clustUuid, uuid);
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
 * Показывает контекстное меню для информационной базы
 */
function showInfobaseContextMenu(event, connectionId, clusterUuid, infobaseUuid, infobaseName) {
    event.preventDefault();
    event.stopPropagation();
    
    const existingMenu = document.getElementById('infobaseContextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.id = 'infobaseContextMenu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.style.zIndex = '10000';
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="openInfobaseProperties(${connectionId}, '${clusterUuid}', '${infobaseUuid}'); closeContextMenu();">
            📋 Свойства
        </div>
        <div class="context-menu-item" onclick="openSessionsModal(${connectionId}, '${clusterUuid}', '${infobaseUuid}'); closeContextMenu();">
            💺 Сеансы
        </div>
        <div class="context-menu-item" onclick="deleteInfobase(${connectionId}, '${clusterUuid}', '${infobaseUuid}', '${escapeHtml(infobaseName).replace(/'/g, "\\'")}'); closeContextMenu();">
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

// Примечание: Остальные функции для информационных баз (openCreateInfobaseModal, saveCreateInfobase, 
// openInfobaseProperties, saveInfobaseProperties, showInfobaseCredentialsModal, deleteInfobase и т.д.)
// находятся в connections.js и будут перенесены в следующих итерациях

