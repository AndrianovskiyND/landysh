/**
 * Работа с администраторами кластера - Ландыш
 * Загрузка, создание и удаление администраторов кластера
 */

// Примечание: Этот модуль зависит от:
// - connections-utils.js (escapeHtml, closeContextMenu)
// - connections-core.js (addClusterAdminParams, getClusterAdminCredentials)

/**
 * Загрузить администраторов кластера в дерево
 */
async function loadAdminsIntoTree(connectionId, clusterUuid, sectionId) {
    const childrenContainer = document.getElementById(`${sectionId}-children`);
    if (!childrenContainer) return;
    
    if (childrenContainer.style.display === 'none') {
        childrenContainer.style.display = 'block';
    }
    
    childrenContainer.innerHTML = '<div style="padding: 0.5rem; color: #666; font-style: italic;">⏳ Загрузка...</div>';
    
    try {
        const url = addClusterAdminParams(`/api/clusters/admins/${connectionId}/${clusterUuid}/`, connectionId, clusterUuid);
        const response = await fetch(url);
        const data = await response.json();
        
        const currentContainer = document.getElementById(`${sectionId}-children`);
        if (!currentContainer) return;
        
        if (data.success) {
            const admins = data.admins || [];
            
            if (admins.length === 0) {
                currentContainer.innerHTML = `
                    <div style="padding: 0.5rem; color: #666; font-style: italic;">
                        Администраторы не найдены
                    </div>
                `;
            } else {
                let html = '';
                admins.forEach((admin) => {
                    const adminName = admin.name || '—';
                    html += `
                        <div class="tree-item" 
                             data-admin-name="${adminName}"
                             data-connection-id="${connectionId}"
                             data-cluster-uuid="${clusterUuid}"
                             style="cursor: pointer; padding: 0.5rem; border-radius: 4px; margin: 0.25rem 0; display: flex; align-items: center; gap: 0.5rem;"
                             oncontextmenu="showAdminContextMenu(event, ${connectionId}, '${clusterUuid}', '${escapeHtml(adminName).replace(/'/g, "\\'")}'); return false;">
                            <span class="tree-icon">👤</span>
                            <span>${escapeHtml(adminName)}</span>
                        </div>
                    `;
                });
                currentContainer.innerHTML = html;
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
 * Показать контекстное меню для администраторов
 */
function showAdminsContextMenu(event, connectionId, clusterUuid) {
    event.preventDefault();
    event.stopPropagation();
    
    // Удаляем предыдущее меню если есть
    const existingMenu = document.getElementById('adminsContextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.id = 'adminsContextMenu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.style.zIndex = '10000';
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="openCreateClusterAdminModal(${connectionId}, '${clusterUuid}'); closeContextMenu();">
            Создать администратора
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

/**
 * Показать контекстное меню для администратора
 */
function showAdminContextMenu(event, connectionId, clusterUuid, adminName) {
    event.preventDefault();
    event.stopPropagation();
    
    // Удаляем предыдущее меню если есть
    const existingMenu = document.getElementById('adminContextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.id = 'adminContextMenu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.style.zIndex = '10000';
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="deleteClusterAdmin(${connectionId}, '${clusterUuid}', '${escapeHtml(adminName).replace(/'/g, "\\'")}'); closeContextMenu();">
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

// Примечание: Остальные функции для администраторов (openCreateClusterAdminModal, 
// saveClusterAdmin, deleteClusterAdmin, openClusterAdminModal и т.д.) 
// находятся в connections.js и будут перенесены в следующих итерациях

