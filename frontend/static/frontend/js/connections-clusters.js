/**
 * Работа с кластерами - Ландыш
 * Загрузка, отображение и управление кластерами
 */

// Примечание: Этот модуль зависит от:
// - connections-utils.js (parseClusterList, escapeHtml)
// - connections-core.js (addClusterAdminParams, openClusterAdminModal, loadConnectionData)

/**
 * Загрузить данные подключения и выполнить команду RAC
 * @param {number} connectionId - ID подключения
 */
async function loadConnectionData(connectionId, connectionName = null) {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = '<div style="text-align: center; padding: 2rem;"><p>⏳ Загрузка кластеров...</p></div>';
    
    // Сохраняем connectionId для использования в контекстном меню
    window._currentConnectionId = connectionId;
    
    // Если имя подключения не передано, получаем его из API
    if (!connectionName) {
        try {
            const connResponse = await fetch('/api/clusters/connections/');
            const connData = await connResponse.json();
            if (connData.connections) {
                const connection = connData.connections.find(c => c.id === connectionId);
                if (connection) {
                    connectionName = connection.display_name;
                }
            }
        } catch (e) {
            console.error('Ошибка загрузки имени подключения:', e);
        }
    }
    
    // Если имя всё ещё не найдено, используем значение по умолчанию
    const displayConnectionName = connectionName || `Подключение ${connectionId}`;
    
    try {
        const response = await fetch(`/api/clusters/clusters/${connectionId}/`);
        const data = await response.json();
        
        if (data.success) {
            // Используем структурированные данные если есть, иначе парсим вывод
            let clusters = data.clusters || [];
            
            if (clusters.length === 0 && data.output) {
                // Парсим вывод вручную если структурированных данных нет
                clusters = parseClusterList(data.output);
            }
            
            // Отображаем иерархическое дерево с подразделами
            let clustersHTML = `
                <div class="info-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="margin: 0;">📊 Кластеры: ${escapeHtml(displayConnectionName)}</h4>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-secondary" onclick="showAgentsTable(${connectionId})">
                                Агенты
                            </button>
                            <button class="btn btn-primary" onclick="openRegisterClusterModal(${connectionId})">
                                + Регистрация нового кластера
                            </button>
                        </div>
                    </div>
            `;
            
            if (clusters.length === 0) {
                clustersHTML += `
                    <div style="padding: 1rem; text-align: center; color: #666;">
                        <p>Кластеры не найдены</p>
                    </div>
                `;
            } else {
                clustersHTML += `<div class="clusters-tree">`;
                
                clusters.forEach((cluster, index) => {
                const clusterName = cluster.name || `Кластер ${index + 1}`;
                const clusterUuid = cluster.uuid || '';
                const clusterId = `cluster-${connectionId}-${clusterUuid}`;
                
                clustersHTML += `
                    <div class="cluster-tree-node" data-cluster-id="${clusterId}">
                        <div class="cluster-header" 
                             data-connection-id="${connectionId}" 
                             data-cluster-uuid="${clusterUuid}"
                             data-cluster-name="${escapeHtml(clusterName)}">
                            <span class="tree-toggle" onclick="toggleClusterNode('${clusterId}')">▶</span>
                            <span class="cluster-name">📊 ${escapeHtml(clusterName)}</span>
                            <div style="margin-left: auto; display: flex; gap: 0.25rem;">
                                <button class="btn btn-sm" 
                                        onclick="event.stopPropagation(); openClusterAdminModal(${connectionId}, '${clusterUuid}', '${escapeHtml(clusterName).replace(/'/g, "\\'")}')"
                                        style="padding: 0.25rem 0.5rem; font-size: 0.8rem; background: transparent; border: none; color: #666; cursor: pointer;"
                                        title="Настройки администратора кластера">
                                    ⚙️
                                </button>
                                <button class="btn btn-sm btn-danger" 
                                        onclick="event.stopPropagation(); deleteCluster(${connectionId}, '${clusterUuid}', '${escapeHtml(clusterName).replace(/'/g, "\\'")}')"
                                        style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">
                                    🗑️
                                </button>
                            </div>
                        </div>
                        <div class="cluster-children" id="${clusterId}-children" style="display: none;">
                            <div class="tree-item-section" data-section="infobases" data-connection-id="${connectionId}" data-cluster-uuid="${clusterUuid}">
                                <span class="tree-toggle-section" data-section-id="infobases-${clusterId}">▶</span>
                                <span class="tree-icon">📁</span>
                                <span>Информационные базы</span>
                            </div>
                            <div class="tree-section-children" id="infobases-${clusterId}-children" style="display: none; margin-left: 1.5rem;">
                                <div style="padding: 0.5rem; color: #666; font-style: italic;">Загрузка...</div>
                            </div>
                            <div class="tree-item-section" data-section="servers" data-connection-id="${connectionId}" data-cluster-uuid="${clusterUuid}">
                                <span class="tree-toggle-section" data-section-id="servers-${clusterId}">▶</span>
                                <span class="tree-icon">⚙️</span>
                                <span>Рабочие серверы</span>
                            </div>
                            <div class="tree-section-children" id="servers-${clusterId}-children" style="display: none; margin-left: 1.5rem;">
                                <div style="padding: 0.5rem; color: #666; font-style: italic;">Загрузка...</div>
                            </div>
                            <div class="tree-item-section" data-section="admins" data-connection-id="${connectionId}" data-cluster-uuid="${clusterUuid}"
                                 oncontextmenu="showAdminsContextMenu(event, ${connectionId}, '${clusterUuid}'); return false;"
                                 style="cursor: pointer;">
                                <span class="tree-toggle-section" data-section-id="admins-${clusterId}">▶</span>
                                <span class="tree-icon">👥</span>
                                <span>Администраторы</span>
                            </div>
                            <div class="tree-section-children" id="admins-${clusterId}-children" style="display: none; margin-left: 1.5rem;">
                                <div style="padding: 0.5rem; color: #666; font-style: italic;">Загрузка...</div>
                            </div>
                            <div class="tree-item" data-section="managers" data-connection-id="${connectionId}" data-cluster-uuid="${clusterUuid}">
                                <span class="tree-icon">🏢</span>
                                <span>Менеджеры кластера</span>
                            </div>
                            <div class="tree-item" data-section="processes" data-connection-id="${connectionId}" data-cluster-uuid="${clusterUuid}">
                                <span class="tree-icon">🔄</span>
                                <span>Рабочие процессы</span>
                            </div>
                            <div class="tree-item" data-section="sessions" data-connection-id="${connectionId}" data-cluster-uuid="${clusterUuid}">
                                <span class="tree-icon">💺</span>
                                <span>Сеансы</span>
                            </div>
                            <div class="tree-item" data-section="locks" data-connection-id="${connectionId}" data-cluster-uuid="${clusterUuid}">
                                <span class="tree-icon">🔒</span>
                                <span>Блокировки</span>
                            </div>
                            <div class="tree-item" data-section="connections" data-connection-id="${connectionId}" data-cluster-uuid="${clusterUuid}">
                                <span class="tree-icon">🔗</span>
                                <span>Соединения</span>
                            </div>
                            <div class="tree-item" data-section="security" data-connection-id="${connectionId}" data-cluster-uuid="${clusterUuid}">
                                <span class="tree-icon">🛡️</span>
                                <span>Профили безопасности</span>
                            </div>
                            <div class="tree-item" data-section="counters" data-connection-id="${connectionId}" data-cluster-uuid="${clusterUuid}">
                                <span class="tree-icon">📊</span>
                                <span>Счетчики потребления ресурсов</span>
                            </div>
                            <div class="tree-item" data-section="limits" data-connection-id="${connectionId}" data-cluster-uuid="${clusterUuid}">
                                <span class="tree-icon">⚖️</span>
                                <span>Ограничения потребления ресурсов</span>
                            </div>
                        </div>
                    </div>
                `;
                });
                
                clustersHTML += `</div>`;
            }
            
            clustersHTML += '</div>';
            contentArea.innerHTML = clustersHTML;
            
            // Добавляем обработчики событий через делегирование
            setupClusterEventHandlers();
            
        } else {
            // Обработка ошибок
            let errorMessage = data.error || 'Неизвестная ошибка';
            
            // Проверяем, не связана ли ошибка с путём к RAC
            if (errorMessage.includes('No such file') || errorMessage.includes('не найден')) {
                errorMessage = `Путь к RAC не найден: ${data.rac_path || 'не указан'}`;
            } else if (errorMessage.includes('Connection') || errorMessage.includes('подключ')) {
                errorMessage = `Ошибка подключения: ${errorMessage}`;
            }
            
            contentArea.innerHTML = `
                <div class="info-card" style="border-left: 4px solid var(--primary-color);">
                    <h4 style="color: var(--primary-color);">❌ Ошибка выполнения команды</h4>
                    <p style="color: #721c24; margin: 0;">${errorMessage}</p>
                </div>
            `;
        }
    } catch (error) {
        contentArea.innerHTML = `
            <div class="info-card" style="border-left: 4px solid var(--primary-color);">
                <h4 style="color: var(--primary-color);">❌ Ошибка</h4>
                <p style="color: #721c24; margin: 0;">Ошибка подключения: ${error.message}</p>
            </div>
        `;
    }
}

// Примечание: Функция deleteSelectedConnections перенесена в connections-core.js

/**
 * Настраивает обработчики событий для кластеров
 */
function setupClusterEventHandlers() {
    // Удаляем старые обработчики, если они есть (чтобы избежать накопления)
    if (window._clusterContextMenuHandler) {
        document.removeEventListener('contextmenu', window._clusterContextMenuHandler);
    }
    if (window._clusterClickHandler) {
        document.removeEventListener('click', window._clusterClickHandler);
    }
    
    // Обработчик контекстного меню для заголовка кластера
    window._clusterContextMenuHandler = (e) => {
        const clusterHeader = e.target.closest('.cluster-header');
        if (clusterHeader) {
            e.preventDefault();
            const connectionId = clusterHeader.dataset.connectionId;
            const clusterUuid = clusterHeader.dataset.clusterUuid;
            const clusterName = clusterHeader.dataset.clusterName;
            showClusterContextMenu(e, connectionId, clusterUuid, clusterName);
            return;
        }
        
        // Обработчик контекстного меню для секций "Информационные базы" и "Рабочие серверы"
        const treeItemSection = e.target.closest('.tree-item-section');
        if (treeItemSection) {
            const section = treeItemSection.dataset.section;
            const connectionId = treeItemSection.dataset.connectionId;
            const clusterUuid = treeItemSection.dataset.clusterUuid;
            
            if (section === 'infobases' || section === 'servers') {
                e.preventDefault();
                showSectionContextMenu(e, connectionId, clusterUuid, section);
            } else if (section === 'admins') {
                // Контекстное меню для администраторов обрабатывается в oncontextmenu
            }
        }
    };
    document.addEventListener('contextmenu', window._clusterContextMenuHandler);
    
    // Обработчик клика по секциям (Информационные базы, Рабочие серверы)
    window._clusterClickHandler = (e) => {
        // Игнорируем клики внутри модальных окон
        if (e.target.closest('.modal-overlay')) {
            return;
        }
        
        const treeItemSection = e.target.closest('.tree-item-section');
        if (treeItemSection) {
            e.stopPropagation();
            const section = treeItemSection.dataset.section;
            const connectionId = treeItemSection.dataset.connectionId;
            const clusterUuid = treeItemSection.dataset.clusterUuid;
            const clusterId = `cluster-${connectionId}-${clusterUuid}`;
            const sectionId = `${section}-${clusterId}`;
            
            // Проверяем текущее состояние секции (открыта или закрыта)
            const childrenContainer = document.getElementById(`${sectionId}-children`);
            if (!childrenContainer) {
                console.error(`Container not found: ${sectionId}-children`);
                return;
            }
            
            // Проверяем состояние ДО переключения
            const currentDisplay = childrenContainer.style.display;
            const computedDisplay = window.getComputedStyle(childrenContainer).display;
            const isCurrentlyOpen = currentDisplay !== 'none' && computedDisplay !== 'none';
            
            // Переключаем раскрытие секции
            toggleSectionNode(sectionId);
            
            // Проверяем новое состояние ПОСЛЕ переключения
            const containerAfterToggle = document.getElementById(`${sectionId}-children`);
            if (!containerAfterToggle) {
                console.error(`Container not found after toggle: ${sectionId}-children`);
                return;
            }
            
            const newDisplay = containerAfterToggle.style.display;
            const newComputedDisplay = window.getComputedStyle(containerAfterToggle).display;
            const isNowOpen = newDisplay !== 'none' && newComputedDisplay !== 'none';
            
            // Загружаем данные только если секция была закрыта и теперь открыта
            if (isNowOpen && !isCurrentlyOpen) {
                loadSectionData(section, connectionId, clusterUuid, sectionId);
            }
            
            return;
        }
        
        // Обработчик для других разделов (переход на другую страницу)
        const treeItem = e.target.closest('.tree-item:not(.tree-item-section)');
        if (treeItem && treeItem.dataset.section) {
            e.stopPropagation();
            const section = treeItem.dataset.section;
            const connectionId = treeItem.dataset.connectionId;
            const clusterUuid = treeItem.dataset.clusterUuid;
            loadClusterSection(section, connectionId, clusterUuid);
            return;
        }
    };
    document.addEventListener('click', window._clusterClickHandler);
}

/**
 * Переключает раскрытие/сворачивание узла кластера
 */
function toggleClusterNode(clusterId) {
    const children = document.getElementById(`${clusterId}-children`);
    const toggle = document.querySelector(`[onclick="toggleClusterNode('${clusterId}')"]`);
    
    if (children) {
        if (children.style.display === 'none') {
            children.style.display = 'block';
            if (toggle) toggle.textContent = '▼';
        } else {
            children.style.display = 'none';
            if (toggle) toggle.textContent = '▶';
        }
    }
}

/**
 * Переключает раскрытие/сворачивание секции (Информационные базы, Рабочие серверы)
 */
function toggleSectionNode(sectionId) {
    const children = document.getElementById(`${sectionId}-children`);
    const toggle = document.querySelector(`.tree-toggle-section[data-section-id="${sectionId}"]`);
    
    if (children) {
        if (children.style.display === 'none') {
            children.style.display = 'block';
            if (toggle) toggle.textContent = '▼';
        } else {
            children.style.display = 'none';
            if (toggle) toggle.textContent = '▶';
        }
    }
}

/**
 * Загружает данные для секции и отображает их в дереве
 */
async function loadSectionData(section, connectionId, clusterUuid, sectionId) {
    const childrenContainer = document.getElementById(`${sectionId}-children`);
    if (!childrenContainer) return;
    
    try {
        if (section === 'infobases') {
            await loadInfobasesIntoTree(connectionId, clusterUuid, sectionId);
        } else if (section === 'servers') {
            await loadServersIntoTree(connectionId, clusterUuid, sectionId);
        } else if (section === 'admins') {
            await loadAdminsIntoTree(connectionId, clusterUuid, sectionId);
        }
    } catch (error) {
        childrenContainer.innerHTML = `
            <div style="padding: 0.5rem; color: #d52b1e;">
                ❌ Ошибка загрузки: ${error.message}
            </div>
        `;
    }
}

/**
 * Загружает данные для подраздела кластера
 */
async function loadClusterSection(section, connectionId, clusterUuid) {
    // Для секций сеансов и процессов открываем модальное окно, не трогая contentArea
    if (section === 'sessions') {
        await openSessionsModal(connectionId, clusterUuid);
        return;
    }
    if (section === 'processes') {
        await openProcessesModal(connectionId, clusterUuid);
        return;
    }
    if (section === 'managers') {
        await openManagersModal(connectionId, clusterUuid);
        return;
    }
    
    // Для остальных секций проверяем, реализованы ли они
    const implementedSections = ['infobases', 'servers', 'admins'];
    if (!implementedSections.includes(section)) {
        showNotification(`⚠️ Функционал "${section}" находится в разработке`, true);
        return; // Не меняем contentArea, остаемся в дереве
    }
    
    // Секция "Администраторы" не загружается в contentArea, только в дерево
    if (section === 'admins') {
        return;
    }
    
    const contentArea = document.getElementById('contentArea');
    if (!contentArea) return;
    
    contentArea.innerHTML = '<div style="text-align: center; padding: 2rem;"><p>⏳ Загрузка данных...</p></div>';
    
    try {
        // В зависимости от раздела загружаем соответствующие данные
        switch(section) {
            case 'infobases':
                await loadInfobases(connectionId, clusterUuid);
                break;
            case 'servers':
                await loadServers(connectionId, clusterUuid);
                break;
            default:
                showNotification(`⚠️ Функционал "${section}" находится в разработке`, true);
        }
    } catch (error) {
        showNotification(`❌ Ошибка загрузки: ${error.message}`, true);
    }
}

/**
 * Показывает контекстное меню для кластера
 */
function showClusterContextMenu(event, connectionId, clusterUuid, clusterName) {
    event.preventDefault();
    event.stopPropagation();
    
    // Удаляем предыдущее меню если есть
    const existingMenu = document.getElementById('clusterContextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Создаём контекстное меню
    const menu = document.createElement('div');
    menu.id = 'clusterContextMenu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.style.zIndex = '10000';
    menu.style.background = '#fff';
    menu.style.border = '1px solid #ddd';
    menu.style.borderRadius = '6px';
    menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    menu.style.padding = '0.5rem 0';
    menu.style.minWidth = '180px';
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="openClusterProperties('${connectionId}', '${clusterUuid}', '${escapeHtml(clusterName)}'); closeContextMenu();">
            📋 Свойства
        </div>
    `;
    
    document.body.appendChild(menu);
    
    // Закрываем меню при клике вне его
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
 * Показывает контекстное меню для секций (Информационные базы, Рабочие серверы)
 */
function showSectionContextMenu(event, connectionId, clusterUuid, section) {
    event.preventDefault();
    event.stopPropagation();
    
    // Удаляем предыдущее меню если есть
    const existingMenu = document.getElementById('sectionContextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.id = 'sectionContextMenu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.style.zIndex = '10000';
    
    const sectionName = section === 'infobases' ? 'Информационные базы' : 'Рабочие серверы';
    const createFunction = section === 'infobases' ? `openCreateInfobaseModal(${connectionId}, '${clusterUuid}')` : `openCreateServerModal(${connectionId}, '${clusterUuid}')`;
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="${createFunction}; closeContextMenu();">
            ➕ Создать
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

// Примечание: Остальные функции для кластеров (openClusterProperties, saveClusterProperties, 
// openRegisterClusterModal, saveRegisterCluster, deleteCluster) находятся в connections.js 
// и будут перенесены в следующих итерациях

