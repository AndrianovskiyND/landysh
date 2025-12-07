/**
 * Управление подключениями - Ландыш
 * Работа с подключениями к серверам 1С
 */

// ============================================
// Загрузка и отображение подключений
// ============================================

/**
 * Загрузить список подключений
 */
async function loadConnections() {
    try {
        const response = await fetch('/api/clusters/connections/');
        const data = await response.json();
        
        if (data.connections) {
            renderConnectionsTree(data.connections);
        }
    } catch (error) {
        showNotification('Ошибка загрузки подключений: ' + error.message, true);
    }
}

// Режим выбора подключений для массового удаления
let connectionSelectionMode = false;
let selectedConnections = new Set();

/**
 * Отрисовать дерево подключений в боковой панели
 * @param {Array} connections - Массив подключений
 */
function renderConnectionsTree(connections) {
    const treeContainer = document.getElementById('connectionsTree');
    if (!treeContainer) return;
    
    // Очищаем контейнер, но сохраняем кнопку выбора
    const existingButton = treeContainer.querySelector('.connection-select-button');
    treeContainer.innerHTML = '';
    
    // Добавляем кнопку выбора/отмены выбора
    const selectButton = document.createElement('button');
    selectButton.className = 'btn btn-secondary connection-select-button';
    selectButton.style.width = '100%';
    selectButton.style.marginBottom = '1rem';
    selectButton.textContent = connectionSelectionMode ? 'Отменить выбор' : 'Выбрать для удаления';
    selectButton.onclick = () => {
        connectionSelectionMode = !connectionSelectionMode;
        selectedConnections.clear();
        renderConnectionsTree(connections);
    };
    treeContainer.appendChild(selectButton);
    
    // Если режим выбора - добавляем чекбокс "Выбрать все"
    if (connectionSelectionMode) {
        const selectAllContainer = document.createElement('div');
        selectAllContainer.style.marginBottom = '0.5rem';
        selectAllContainer.innerHTML = `
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: 0.9rem;">
                <input type="checkbox" id="selectAllConnections" onchange="toggleSelectAllConnections()">
                <span>Выбрать все</span>
            </label>
        `;
        treeContainer.appendChild(selectAllContainer);
        
        // Кнопка удаления выбранных
        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-danger';
        deleteButton.style.width = '100%';
        deleteButton.style.marginBottom = '1rem';
        deleteButton.textContent = `Удалить выбранные (0)`;
        deleteButton.id = 'deleteSelectedConnections';
        deleteButton.onclick = () => deleteSelectedConnections(connections);
        deleteButton.disabled = true;
        treeContainer.appendChild(deleteButton);
    }
    
    connections.forEach(conn => {
        const node = document.createElement('div');
        node.className = 'tree-node';
        node.style.position = 'relative';
        
        if (connectionSelectionMode) {
            // Режим выбора - показываем чекбокс
            node.innerHTML = `
                <label style="display: flex; align-items: center; gap: 0.75rem; width: 100%; cursor: pointer;">
                    <input type="checkbox" class="connection-checkbox" value="${conn.id}" 
                           onchange="updateConnectionSelection(${conn.id}, this.checked)">
                    <div style="flex: 1;">
                        <strong>${conn.display_name}</strong>
                        <div style="font-size: 0.8rem; color: #666;">${conn.server_host}:${conn.ras_port}</div>
                    </div>
                </label>
            `;
        } else {
            // Обычный режим - показываем кнопки редактирования
            node.innerHTML = `
                <div style="flex: 1; cursor: pointer;">
                    <strong>${conn.display_name}</strong>
                    <div style="font-size: 0.8rem; color: #666;">${conn.server_host}:${conn.ras_port}</div>
                </div>
                <button class="btn btn-sm" onclick="event.stopPropagation(); openConnectionEditModal(${conn.id})" 
                        style="padding: 0.25rem 0.5rem; margin: 0; background: transparent; border: none; color: #666; cursor: pointer; font-size: 1rem;"
                        title="Редактировать">
                    ⚙️
                </button>
            `;
            node.style.display = 'flex';
            node.style.alignItems = 'center';
            node.style.justifyContent = 'space-between';
            
            // Клик на подключение - выполняет команду
            const connectionPart = node.querySelector('div');
            connectionPart.onclick = () => loadConnectionData(conn.id, conn.display_name);
        }
        
        treeContainer.appendChild(node);
    });
}

/**
 * Обновить выбор подключения
 */
function updateConnectionSelection(connectionId, isSelected) {
    if (isSelected) {
        selectedConnections.add(connectionId);
    } else {
        selectedConnections.delete(connectionId);
    }
    
    // Обновляем чекбокс "Выбрать все"
    const selectAll = document.getElementById('selectAllConnections');
    if (selectAll) {
        const allCheckboxes = document.querySelectorAll('.connection-checkbox');
        selectAll.checked = allCheckboxes.length > 0 && Array.from(allCheckboxes).every(cb => cb.checked);
    }
    
    // Обновляем кнопку удаления
    const deleteButton = document.getElementById('deleteSelectedConnections');
    if (deleteButton) {
        const count = selectedConnections.size;
        deleteButton.textContent = `Удалить выбранные (${count})`;
        deleteButton.disabled = count === 0;
    }
}

/**
 * Выбрать/снять выбор всех подключений
 */
function toggleSelectAllConnections() {
    const selectAll = document.getElementById('selectAllConnections');
    if (!selectAll) return;
    
    const checkboxes = document.querySelectorAll('.connection-checkbox');
    
    checkboxes.forEach(cb => {
        const connectionId = parseInt(cb.value);
        cb.checked = selectAll.checked;
        if (selectAll.checked) {
            selectedConnections.add(connectionId);
        } else {
            selectedConnections.delete(connectionId);
        }
    });
    
    // Обновляем кнопку удаления
    const deleteButton = document.getElementById('deleteSelectedConnections');
    if (deleteButton) {
        const count = selectedConnections.size;
        deleteButton.textContent = `Удалить выбранные (${count})`;
        deleteButton.disabled = count === 0;
    }
}

// ============================================
// Модальное окно для добавления/редактирования подключения
// ============================================

/**
 * Открыть модальное окно для добавления подключения
 */
function openConnectionModal() {
    openConnectionEditModal(null);
}

/**
 * Открыть модальное окно для редактирования подключения
 * @param {number|null} connectionId - ID подключения (null для создания нового)
 */
async function openConnectionEditModal(connectionId) {
    let connectionData = null;
    
    // Если редактирование - загружаем данные подключения
    if (connectionId) {
        try {
            const response = await fetch('/api/clusters/connections/');
            const data = await response.json();
            connectionData = data.connections.find(c => c.id === connectionId);
        } catch (error) {
            showNotification('❌ Ошибка загрузки данных подключения: ' + error.message, true);
            return;
        }
    }
    
    const modalHtml = `
        <div class="modal-overlay" id="connectionModal">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>${connectionId ? '⚙️ Редактирование подключения' : '➕ Добавить подключение'}</h3>
                    <button class="modal-close-btn" onclick="closeConnectionModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="edit-form">
                        <div class="form-row">
                            <label for="modalDisplayName">Отображаемое имя *</label>
                            <input type="text" id="modalDisplayName" value="${connectionData?.display_name || ''}" placeholder="Первый сервер проекта...">
                        </div>
                        <div class="form-row">
                            <label for="modalServerHost">Сервер *</label>
                            <input type="text" id="modalServerHost" value="${connectionData?.server_host || ''}" placeholder="server_ro01.com">
                        </div>
                        <div class="form-row">
                            <label for="modalRasPort">Порт RAS *</label>
                            <input type="number" id="modalRasPort" value="${connectionData?.ras_port || '1545'}" placeholder="1545">
                        </div>
                        <div class="form-row checkbox-row" style="margin-top: 0.5rem;">
                            <input type="checkbox" id="modalUseClusterAuth" ${connectionData?.cluster_admin ? 'checked' : ''} onchange="toggleClusterAuthFields()">
                            <label for="modalUseClusterAuth" style="font-weight: normal; text-transform: none; letter-spacing: normal;">Использовать УЗ админа кластера</label>
                        </div>
                        <div id="clusterAuthFields" style="display: ${connectionData?.cluster_admin ? 'block' : 'none'};">
                            <div class="form-row">
                                <label for="modalClusterAdmin">Логин кластера</label>
                                <input type="text" id="modalClusterAdmin" value="${connectionData?.cluster_admin || ''}" placeholder="admin">
                            </div>
                            <div class="form-row">
                                <label for="modalClusterPassword">Пароль кластера</label>
                                <input type="password" id="modalClusterPassword" value="" placeholder="••••••••">
                                <small style="color: #888; font-size: 0.75rem; margin-top: 0.25rem;">${connectionId ? 'Оставьте пустым, чтобы не изменять' : 'Введите пароль'}</small>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeConnectionModal()">Отмена</button>
                    <button class="btn btn-primary" onclick="saveConnection(${connectionId || 'null'})">
                        ${connectionId ? '💾 Сохранить изменения' : '➕ Создать'}
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const container = document.getElementById('modal-container');
    container.insertAdjacentHTML('beforeend', modalHtml);
    
    // Инициализируем состояние полей УЗ при загрузке модального окна
    if (connectionData?.cluster_admin) {
        toggleClusterAuthFields();
    }
}

/**
 * Переключить отображение полей УЗ админа кластера
 */
function toggleClusterAuthFields() {
    const checkbox = document.getElementById('modalUseClusterAuth');
    const fieldsContainer = document.getElementById('clusterAuthFields');
    const adminInput = document.getElementById('modalClusterAdmin');
    const passwordInput = document.getElementById('modalClusterPassword');
    
    if (!checkbox || !fieldsContainer || !adminInput || !passwordInput) {
        return;
    }
    
    if (checkbox.checked) {
        fieldsContainer.style.display = 'block';
        adminInput.disabled = false;
        passwordInput.disabled = false;
    } else {
        fieldsContainer.style.display = 'none';
        adminInput.disabled = true;
        passwordInput.disabled = true;
        // Очищаем поля при скрытии
        adminInput.value = '';
        passwordInput.value = '';
    }
}

/**
 * Сохранить подключение (создать или обновить)
 */
async function saveConnection(connectionId) {
    try {
        const displayNameEl = document.getElementById('modalDisplayName');
        const serverHostEl = document.getElementById('modalServerHost');
        const rasPortEl = document.getElementById('modalRasPort');
        const useClusterAuthEl = document.getElementById('modalUseClusterAuth');
        
        if (!displayNameEl || !serverHostEl || !rasPortEl || !useClusterAuthEl) {
            showNotification('❌ Ошибка: Не найдены элементы формы. Попробуйте обновить страницу.', true);
            return;
        }
        
        const displayName = displayNameEl.value;
        const serverHost = serverHostEl.value;
        const rasPort = rasPortEl.value;
        const useClusterAuth = useClusterAuthEl.checked;
        const clusterAdmin = useClusterAuth ? (document.getElementById('modalClusterAdmin')?.value || '') : '';
        const clusterPassword = useClusterAuth ? (document.getElementById('modalClusterPassword')?.value || '') : '';
    
        if (!displayName || !serverHost || !rasPort) {
            showNotification('❌ Заполните обязательные поля: Отображаемое имя, Сервер и Порт RAS', true);
            return;
        }
        
        const connectionData = {
            display_name: displayName,
            server_host: serverHost,
            ras_port: parseInt(rasPort),
            cluster_admin: useClusterAuth ? (clusterAdmin || '') : ''
        };
        
        // Пароль добавляем только если галочка включена и указан пароль
        // При редактировании пустое поле означает "не менять"
        if (useClusterAuth && clusterPassword) {
            connectionData.cluster_password = clusterPassword;
        } else if (!useClusterAuth && connectionId) {
            // Если галочка снята при редактировании - очищаем пароль
            connectionData.cluster_password = '';
        }
        
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден. Обновите страницу.', true);
            return;
        }
        
        let response;
        if (connectionId) {
            // Обновление существующего подключения
            response = await fetch(`/api/clusters/connections/update/${connectionId}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(connectionData)
            });
        } else {
            // Создание нового подключения - пароль добавляем только если галочка включена
            if (useClusterAuth && clusterPassword) {
                connectionData.cluster_password = clusterPassword;
            }
            response = await fetch('/api/clusters/connections/create/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(connectionData)
            });
        }
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`✅ Подключение ${connectionId ? 'обновлено' : 'создано'} успешно`);
            closeConnectionModal();
            loadConnections();
            if (window.loadStatistics) {
                loadStatistics();
            }
        } else {
            showNotification('❌ Ошибка: ' + result.error, true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

function closeConnectionModal() {
    const modal = document.getElementById('connectionModal');
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => modal.remove(), 200);
    }
}

// ============================================
// Создание подключения (старая функция - оставлена для совместимости)
// ============================================

/**
 * Создать новое подключение (устаревшая функция)
 */
async function createConnection() {
    const displayName = document.getElementById('displayName')?.value;
    const serverHost = document.getElementById('serverHost')?.value;
    const rasPort = document.getElementById('rasPort')?.value;
    const clusterAdmin = document.getElementById('clusterAdmin')?.value;
    const clusterPassword = document.getElementById('clusterPassword')?.value;
    
    if (!displayName || !serverHost || !rasPort) {
        showNotification('Заполните обязательные поля: Отображаемое имя, Сервер и Порт RAS', true);
        return;
    }
    
    const connectionData = {
        display_name: displayName,
        server_host: serverHost,
        ras_port: parseInt(rasPort),
        cluster_admin: clusterAdmin || '',
        cluster_password: clusterPassword || ''
    };
    
    try {
        const response = await fetch('/api/clusters/connections/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(connectionData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Подключение успешно создано');
            closeConnectionModal();
            loadConnections();
            if (window.loadStatistics) {
                loadStatistics();
            }
        } else {
            showNotification('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        console.error('Ошибка сохранения подключения:', error);
        showNotification('❌ Ошибка сохранения подключения: ' + (error.message || 'Неизвестная ошибка'), true);
    }
}

// ============================================
// Работа с данными подключения
// ============================================

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
            // Кнопка регистрации всегда видна, даже если кластеров нет
            let clustersHTML = `
                <div class="info-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="margin: 0;">📊 Кластеры: ${escapeHtml(displayConnectionName)}</h4>
                        <button class="btn btn-primary" onclick="openRegisterClusterModal(${connectionId})">
                            + Регистрация нового кластера
                        </button>
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
                            <button class="btn btn-sm btn-danger" 
                                    onclick="deleteCluster(${connectionId}, '${clusterUuid}', '${escapeHtml(clusterName).replace(/'/g, "\\'")}')"
                                    style="margin-left: auto; padding: 0.25rem 0.5rem; font-size: 0.8rem;">
                                🗑️
                            </button>
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
                            <div class="tree-item" data-section="admins" data-connection-id="${connectionId}" data-cluster-uuid="${clusterUuid}">
                                <span class="tree-icon">👥</span>
                                <span>Администраторы</span>
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
 * Удалить выбранные подключения
 */
async function deleteSelectedConnections(connections) {
    const selectedIds = Array.from(selectedConnections);
    
    if (selectedIds.length === 0) {
        showNotification('❌ Выберите подключения для удаления', true);
        return;
    }
    
    // Получаем информацию о выбранных подключениях
    const selectedConnectionsData = connections.filter(c => selectedIds.includes(c.id));
    
    // Группируем по группам для формирования сообщения
    const groupsInfo = {};
    selectedConnectionsData.forEach(conn => {
        const groupId = conn.group_id;
        if (!groupsInfo[groupId]) {
            groupsInfo[groupId] = {
                name: conn.group_name,
                members_count: conn.group_members_count,
                connections: []
            };
        }
        groupsInfo[groupId].connections.push(conn);
    });
    
    // Формируем сообщение
    let message = `Вы уверены, что хотите удалить ${selectedIds.length} подключений?\n\n`;
    
    // Проверяем сценарии для каждой группы
    const groupsToDelete = [];
    const groupsToLeave = [];
    
    Object.values(groupsInfo).forEach(groupInfo => {
        const groupId = groupInfo.connections[0].group_id;
        const totalConnectionsInGroup = connections.filter(c => c.group_id === groupId).length;
        const selectedInGroup = groupInfo.connections.length;
        
        // Если удаляются все подключения группы
        if (selectedInGroup === totalConnectionsInGroup) {
            if (groupInfo.members_count === 1) {
                groupsToDelete.push(groupInfo.name);
            } else {
                groupsToLeave.push({
                    name: groupInfo.name,
                    remaining: groupInfo.members_count - 1
                });
            }
        }
    });
    
    if (groupsToDelete.length > 0) {
        if (groupsToDelete.length === 1) {
            message += `⚠️ При удалении всех подключений группа "${groupsToDelete[0]}" будет удалена.\n\n`;
        } else {
            message += `⚠️ При удалении всех подключений группы "${groupsToDelete.join('", "')}" будут удалены.\n\n`;
        }
    }
    
    if (groupsToLeave.length > 0) {
        groupsToLeave.forEach(g => {
            message += `⚠️ Вы удаляете все подключения и будете исключены из группы "${g.name}", в которой останется ${g.remaining} участников.\n`;
        });
        message += '\n';
    }
    
    if (!confirm(message)) {
        return;
    }
    
    // Проверяем, есть ли группы, где удаляются все подключения с 2+ участниками
    // В таких случаях нужно использовать специальную логику
    const groupsToProtect = [];
    const protectedConnectionIds = new Set(); // ID подключений, которые НЕ нужно удалять
    
    Object.values(groupsInfo).forEach(groupInfo => {
        const groupId = groupInfo.connections[0].group_id;
        const totalConnectionsInGroup = connections.filter(c => c.group_id === groupId).length;
        const selectedInGroup = groupInfo.connections.length;
        
        // Если удаляются все подключения группы и в группе 2+ участников
        if (selectedInGroup === totalConnectionsInGroup && groupInfo.members_count > 1) {
            const connectionIds = groupInfo.connections.map(c => c.id);
            groupsToProtect.push({
                groupId: groupId,
                groupName: groupInfo.name,
                connectionIds: connectionIds,
                remainingMembers: groupInfo.members_count - 1
            });
            // Добавляем ID подключений в защищённый список
            connectionIds.forEach(id => protectedConnectionIds.add(id));
        }
    });
    
    // Если есть защищённые группы, обрабатываем их отдельно ПЕРЕД удалением
    if (groupsToProtect.length > 0) {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден. Обновите страницу.', true);
            return;
        }
        
        // Для защищённых групп: не удаляем подключения, только исключаем пользователя
        for (const protectedGroup of groupsToProtect) {
            try {
                // Исключаем пользователя из группы через API назначения
                const removeResponse = await fetch('/api/users/groups/assign/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify({
                        user_id: window.CURRENT_USER_ID,
                        group_id: protectedGroup.groupId,
                        action: 'remove'
                    })
                });
                
                if (removeResponse.ok) {
                    const removeResult = await removeResponse.json();
                    if (removeResult.success) {
                        showNotification(`✅ Вы исключены из группы "${protectedGroup.groupName}". Подключения сохранены для ${protectedGroup.remainingMembers} участников.`);
                    }
                }
            } catch (error) {
                console.error('Ошибка исключения из группы:', error);
                errors.push(`Ошибка исключения из группы "${protectedGroup.groupName}": ${error.message}`);
            }
        }
    }
    
    // Удаляем только те подключения, которые НЕ в защищённых группах
    const connectionsToDelete = selectedIds.filter(id => !protectedConnectionIds.has(id));
    
    // Если все подключения были защищены, просто обновляем список
    if (connectionsToDelete.length === 0 && groupsToProtect.length > 0) {
        showNotification('✅ Операция завершена. Вы исключены из групп, подключения сохранены для других участников.');
        connectionSelectionMode = false;
        selectedConnections.clear();
        loadConnections();
        if (window.loadStatistics) {
            loadStatistics();
        }
        return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const connectionId of connectionsToDelete) {
        try {
            const csrfToken = getCSRFToken();
            if (!csrfToken) {
                showNotification('❌ Ошибка: CSRF токен не найден. Обновите страницу.', true);
                return;
            }
            
            const response = await fetch(`/api/clusters/connections/delete/${connectionId}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                successCount++;
            } else {
                errorCount++;
                errors.push(result.error || 'Неизвестная ошибка');
            }
        } catch (error) {
            errorCount++;
            errors.push(error.message || 'Ошибка сети');
        }
    }
    
    if (successCount > 0) {
        let message = `✅ Удалено подключений: ${successCount}`;
        if (errorCount > 0) {
            message += `\n❌ Ошибок: ${errorCount}`;
            if (errors.length > 0) {
                message += `\n${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`;
            }
        }
        showNotification(message, errorCount > 0);
        connectionSelectionMode = false;
        selectedConnections.clear();
        loadConnections();
        if (window.loadStatistics) {
            loadStatistics();
        }
    } else {
        const errorMessage = errors.length > 0 
            ? `❌ Ошибка удаления подключений: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`
            : '❌ Ошибка удаления подключений';
        showNotification(errorMessage, true);
    }
}

/**
 * Настраивает обработчики событий для кластеров
 */
function setupClusterEventHandlers() {
    // Обработчик контекстного меню для заголовка кластера
    document.addEventListener('contextmenu', (e) => {
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
            }
        }
    });
    
    // Обработчик клика по секциям (Информационные базы, Рабочие серверы)
    document.addEventListener('click', (e) => {
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
            
            // Переключаем раскрытие секции
            toggleSectionNode(sectionId);
            
            // Загружаем данные для секции
            loadSectionData(section, connectionId, clusterUuid, sectionId);
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
    });
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
    const implementedSections = ['infobases', 'servers'];
    if (!implementedSections.includes(section)) {
        showNotification(`⚠️ Функционал "${section}" находится в разработке`, true);
        return; // Не меняем contentArea, остаемся в дереве
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
 * Загружает информационные базы в дерево
 */
async function loadInfobasesIntoTree(connectionId, clusterUuid, sectionId) {
    const childrenContainer = document.getElementById(`${sectionId}-children`);
    if (!childrenContainer) return;
    
    childrenContainer.innerHTML = '<div style="padding: 0.5rem; color: #666; font-style: italic;">⏳ Загрузка...</div>';
    
    try {
        const response = await fetch(`/api/clusters/infobases/${connectionId}/?cluster=${clusterUuid}`);
        const data = await response.json();
        
        if (data.success) {
            const infobases = data.infobases || [];
            
            if (infobases.length === 0) {
                childrenContainer.innerHTML = `
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
                childrenContainer.innerHTML = html;
                
                // Добавляем обработчики кликов
                childrenContainer.querySelectorAll('[data-infobase-uuid]').forEach(item => {
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
            childrenContainer.innerHTML = `
                <div style="padding: 0.5rem; color: #d52b1e;">
                    ❌ Ошибка: ${data.error || 'Неизвестная ошибка'}
                </div>
            `;
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
 * Загружает рабочие серверы в дерево
 */
async function loadServersIntoTree(connectionId, clusterUuid, sectionId) {
    const childrenContainer = document.getElementById(`${sectionId}-children`);
    if (!childrenContainer) return;
    
    childrenContainer.innerHTML = '<div style="padding: 0.5rem; color: #666; font-style: italic;">⏳ Загрузка...</div>';
    
    try {
        const response = await fetch(`/api/clusters/servers/${connectionId}/?cluster=${clusterUuid}`);
        const data = await response.json();
        
        if (data.success) {
            const servers = data.servers || [];
            
            if (servers.length === 0) {
                childrenContainer.innerHTML = `
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
                childrenContainer.innerHTML = html;
                
                // Добавляем обработчики кликов
                childrenContainer.querySelectorAll('[data-server-uuid]').forEach(item => {
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
            childrenContainer.innerHTML = `
                <div style="padding: 0.5rem; color: #d52b1e;">
                    ❌ Ошибка: ${data.error || 'Неизвестная ошибка'}
                </div>
            `;
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
 * Загружает информационные базы
 */
async function loadInfobases(connectionId, clusterUuid) {
    const response = await fetch(`/api/clusters/infobases/${connectionId}/?cluster=${clusterUuid}`);
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
 * Загружает рабочие серверы
 */
async function loadServers(connectionId, clusterUuid) {
    const response = await fetch(`/api/clusters/servers/${connectionId}/?cluster=${clusterUuid}`);
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
 * Открывает модальное окно сеансов на весь экран
 */
async function openSessionsModal(connectionId, clusterUuid, infobaseUuid = null) {
    closeContextMenu();
    
    // Удаляем предыдущее модальное окно если есть
    const existingModal = document.getElementById('sessionsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'sessionsModal';
    modal.style.zIndex = '10001';
    modal.innerHTML = `
        <div class="modal" style="max-width: 95vw; max-height: 95vh; width: 95vw; height: 95vh; display: flex; flex-direction: column;">
            <div class="modal-header" style="flex-shrink: 0;">
                <h3>💺 Сеансы${infobaseUuid ? ' (фильтр по информационной базе)' : ''}</h3>
                <button class="modal-close-btn" onclick="closeSessionsModal()">×</button>
            </div>
            <div class="modal-body" style="flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 1rem;">
                <div style="margin-bottom: 1rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <input type="text" id="sessionsSearch" placeholder="🔍 Поиск..." style="flex: 1; min-width: 200px; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    <button class="btn btn-secondary" onclick="toggleSessionsColumnFilter()" title="Фильтр столбцов">🔍 Фильтр</button>
                    <button class="btn btn-secondary" onclick="exportSessionsToExcel()" title="Выгрузить в Excel">📥 Excel</button>
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input type="checkbox" id="sessionsIncludeLicenses">
                        <span>Показать лицензии</span>
                    </label>
                    <button class="btn btn-secondary" onclick="refreshSessionsTable(${connectionId}, '${clusterUuid}', ${infobaseUuid ? `'${infobaseUuid}'` : 'null'})">🔄 Обновить</button>
                </div>
                <div id="sessionsColumnFilter" style="display: none; margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 6px; max-height: 200px; overflow-y: auto;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">Выберите столбцы для отображения:</div>
                    <div id="sessionsColumnFilterList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.5rem;"></div>
                </div>
                <div id="sessionsTableContainer" style="flex: 1; overflow: auto;">
                    <div style="text-align: center; padding: 2rem;">
                        <p>⏳ Загрузка сеансов...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Сохраняем параметры для обновления
    window._currentSessionsConnectionId = connectionId;
    window._currentSessionsClusterUuid = clusterUuid;
    window._currentSessionsInfobaseUuid = infobaseUuid;
    window._selectedSessions = new Set();
    
    // Загружаем сеансы
    await loadSessionsTable(connectionId, clusterUuid, infobaseUuid);
    
    // Добавляем обработчик поиска
    const searchInput = document.getElementById('sessionsSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterSessionsTable();
        });
    }
    
    // Добавляем обработчик переключения лицензий
    const licensesCheckbox = document.getElementById('sessionsIncludeLicenses');
    if (licensesCheckbox) {
        licensesCheckbox.addEventListener('change', () => {
            loadSessionsTable(connectionId, clusterUuid, infobaseUuid);
        });
    }
}

/**
 * Закрывает модальное окно сеансов
 */
function closeSessionsModal() {
    const modal = document.getElementById('sessionsModal');
    if (modal) {
        modal.remove();
    }
    
    // Очищаем глобальные переменные
    if (window._currentSessionsConnectionId) {
        delete window._currentSessionsConnectionId;
    }
    if (window._currentSessionsClusterUuid) {
        delete window._currentSessionsClusterUuid;
    }
    if (window._currentSessionsInfobaseUuid) {
        delete window._currentSessionsInfobaseUuid;
    }
    if (window._selectedSessions) {
        delete window._selectedSessions;
    }
    if (window._sessionsData) {
        delete window._sessionsData;
    }
    if (window._sessionsSort) {
        delete window._sessionsSort;
    }
}

/**
 * Загружает таблицу сеансов
 */
async function loadSessionsTable(connectionId, clusterUuid, infobaseUuid = null) {
    const container = document.getElementById('sessionsTableContainer');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 2rem;"><p>⏳ Загрузка сеансов...</p></div>';
    
    try {
        const includeLicenses = document.getElementById('sessionsIncludeLicenses')?.checked || false;
        let url = `/api/clusters/sessions/${connectionId}/?cluster=${clusterUuid}`;
        if (infobaseUuid) {
            url += `&infobase=${infobaseUuid}`;
        }
        if (includeLicenses) {
            url += `&licenses=true`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            const sessions = data.sessions || [];
            
            if (sessions.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: #666;">
                        <p>Сеансов нет</p>
                    </div>
                `;
            } else {
                renderSessionsTable(sessions, connectionId, clusterUuid);
            }
        } else {
            container.innerHTML = `
                <div class="info-card" style="border-left: 4px solid var(--primary-color);">
                    <h4 style="color: var(--primary-color);">❌ Ошибка</h4>
                    <p style="color: #721c24; margin: 0;">${data.error || 'Неизвестная ошибка'}</p>
                </div>
            `;
        }
    } catch (error) {
        container.innerHTML = `
            <div class="info-card" style="border-left: 4px solid var(--primary-color);">
                <h4 style="color: var(--primary-color);">❌ Ошибка</h4>
                <p style="color: #721c24; margin: 0;">Ошибка загрузки: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Обновляет таблицу сеансов
 */
async function refreshSessionsTable(connectionId, clusterUuid, infobaseUuid) {
    await loadSessionsTable(connectionId, clusterUuid, infobaseUuid);
}

/**
 * Отрисовывает таблицу сеансов
 */
function renderSessionsTable(sessions, connectionId, clusterUuid) {
    const container = document.getElementById('sessionsTableContainer');
    if (!container) return;
    
    // Сохраняем выбранные сеансы
    const selectedSessions = window._selectedSessions || new Set();
    
    // Собираем все уникальные ключи из всех сеансов для заголовков
    const allKeys = new Set();
    sessions.forEach(session => {
        Object.keys(session.data || {}).forEach(key => allKeys.add(key));
    });
    
    // Добавляем UUID сеанса в список ключей для управления через фильтр
    allKeys.add('session');
    const sortedKeys = Array.from(allKeys).sort();
    
    // Получаем сохраненное состояние видимости столбцов
    // По умолчанию UUID выключен, остальные включены
    if (!window._sessionsVisibleColumns) {
        window._sessionsVisibleColumns = new Set(sortedKeys.filter(k => k !== 'session'));
    }
    const visibleColumns = window._sessionsVisibleColumns;
    
    // Получаем сохраненный порядок столбцов
    const columnOrderKey = `sessions_column_order_${connectionId}_${clusterUuid}`;
    let columnOrder = JSON.parse(localStorage.getItem(columnOrderKey) || 'null');
    if (!columnOrder || !Array.isArray(columnOrder)) {
        columnOrder = sortedKeys.filter(k => visibleColumns.has(k));
    } else {
        // Фильтруем порядок, оставляя только видимые столбцы
        columnOrder = columnOrder.filter(k => visibleColumns.has(k));
        // Добавляем новые столбцы в конец
        sortedKeys.forEach(k => {
            if (visibleColumns.has(k) && !columnOrder.includes(k)) {
                columnOrder.push(k);
            }
        });
    }
    
    // Проверяем, есть ли видимые столбцы
    const hasVisibleColumns = visibleColumns.size > 0;
    
    let html = `
        <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
            <button class="btn btn-danger" onclick="terminateSelectedSessionsFromTable()" id="terminateSessionsBtn" style="display: none;">
                ⛔ Принудительное завершение сеанса
            </button>
            <button class="btn btn-warning" onclick="interruptSelectedSessionsFromTable()" id="interruptSessionsBtn" style="display: none;">
                🔄 Прерывание текущего серверного вызова
            </button>
        </div>
    `;
    
    if (!hasVisibleColumns) {
        html += `
            <div style="text-align: center; padding: 2rem; background: #f8f9fa; border-radius: 6px; margin-bottom: 1rem;">
                <p style="color: #6c757d; margin: 0;">Нет данных для отображения</p>
            </div>
        `;
        container.innerHTML = html;
        return;
    }
    
    html += `
        <table id="sessionsTable" style="width: 100%; border-collapse: collapse; background: white; table-layout: auto;">
            <thead>
                <tr style="background: #f8f9fa; position: sticky; top: 0; z-index: 10;">
                    <th style="padding: 0.5rem; text-align: left; border: 1px solid #ddd; width: 40px;">
                        <input type="checkbox" id="selectAllSessionsHeader" onchange="toggleSelectAllSessions()">
                    </th>
    `;
    
    // Добавляем заголовки в сохраненном порядке
    columnOrder.forEach((key, index) => {
        if (visibleColumns.has(key)) {
            html += `<th class="resizable-column draggable-column" draggable="true" data-column="${key}" data-index="${index}" style="padding: 0.5rem; text-align: left; border: 1px solid #ddd; min-width: 120px; position: relative; vertical-align: top; cursor: move;">
                <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    <div style="text-align: center; font-size: 0.85rem; cursor: pointer;" onclick="sortSessionsTable('${key}')" title="Сортировать">↕️</div>
                    <div style="display: flex; align-items: center; gap: 0.25rem;">
                        <input type="text" class="column-search-input" placeholder="🔍" style="flex: 1; padding: 0.25rem; font-size: 0.75rem; border: 1px solid #ccc; border-radius: 3px;" onkeyup="filterSessionsColumn('${key}', this.value)" data-column="${key}">
                    </div>
                    <div style="font-weight: 600; word-wrap: break-word; white-space: normal;">${escapeHtml(key === 'session' ? 'UUID сеанса' : key)}</div>
                </div>
                <div class="resize-handle" style="position: absolute; right: 0; top: 0; bottom: 0; width: 5px; cursor: col-resize; background: transparent; z-index: 1;"></div>
            </th>`;
        }
    });
    
    html += `
                </tr>
            </thead>
            <tbody>
    `;
    
    sessions.forEach((session, index) => {
        const isSelected = selectedSessions.has(session.uuid);
        html += `
            <tr class="session-row" data-session-uuid="${session.uuid}" data-index="${index}" style="cursor: pointer;">
                <td style="padding: 0.5rem; border: 1px solid #ddd; text-align: center;" onclick="event.stopPropagation();">
                    <input type="checkbox" class="session-checkbox" value="${session.uuid}" ${isSelected ? 'checked' : ''} onchange="updateSessionSelection('${session.uuid}', this.checked)">
                </td>
        `;
        
        // Используем сохраненный порядок столбцов
        columnOrder.forEach(key => {
            if (visibleColumns.has(key)) {
                let value = '';
                if (key === 'session') {
                    value = session.uuid;
                } else {
                    value = session.data[key] || '';
                }
                
                // Добавляем tooltip для длинных значений
                const titleAttr = value ? `title="${escapeHtml(value)}"` : '';
                
                html += `<td style="padding: 0.5rem; border: 1px solid #ddd; word-wrap: break-word; white-space: normal; max-width: 300px; font-size: 0.9rem;" ${titleAttr} data-column="${key}">${escapeHtml(value)}</td>`;
            }
        });
        
        html += `</tr>`;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
    
    if (hasVisibleColumns) {
        // Добавляем обработчики кликов на строки
        container.querySelectorAll('.session-row').forEach(row => {
            row.addEventListener('click', (e) => {
                // Если клик по чекбоксу - только выбор
                if (e.target.type === 'checkbox' || e.target.closest('input[type="checkbox"]')) {
                    return;
                }
                // Если клик по resize handle или по полю поиска - не открываем модальное окно
                if (e.target.classList.contains('resize-handle') || e.target.closest('.resize-handle') || 
                    e.target.classList.contains('column-search-input') || e.target.closest('.column-search-input')) {
                    return;
                }
                // Иначе открываем модальное окно с детальной информацией
                const uuid = row.getAttribute('data-session-uuid');
                openSessionInfoModal(connectionId, clusterUuid, uuid);
            });
        });
        
        // Добавляем обработчики для изменения размера столбцов
        initColumnResize('#sessionsTable');
        
        // Добавляем обработчики drag and drop для перестановки столбцов
        initColumnDragDrop('#sessionsTable', columnOrderKey);
    }
    
    // Обновляем видимость кнопок действий
    updateSessionsActionButtons();
    
    // Сохраняем данные для фильтрации и сортировки
    window._sessionsData = sessions;
    window._selectedSessions = selectedSessions;
    if (columnOrder && Array.isArray(columnOrder)) {
        window._sessionsColumnOrder = columnOrder;
    }
}

/**
 * Переключает выбор всех сеансов
 */
function toggleSelectAllSessions() {
    const selectAll = document.getElementById('selectAllSessionsHeader');
    if (!selectAll) return;
    
    const checkboxes = document.querySelectorAll('.session-checkbox');
    const isChecked = selectAll.checked;
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
        updateSessionSelection(checkbox.value, isChecked);
    });
}

/**
 * Обновляет выбор сеанса
 */
function updateSessionSelection(sessionUuid, isSelected) {
    if (!window._selectedSessions) {
        window._selectedSessions = new Set();
    }
    
    if (isSelected) {
        window._selectedSessions.add(sessionUuid);
    } else {
        window._selectedSessions.delete(sessionUuid);
    }
    
    // Обновляем состояние "Выбрать все" в заголовке таблицы
    const selectAll = document.getElementById('selectAllSessionsHeader');
    if (selectAll) {
        const checkboxes = document.querySelectorAll('.session-checkbox');
        const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
        selectAll.checked = allChecked;
    }
    
    // Обновляем видимость кнопок действий
    updateSessionsActionButtons();
}

/**
 * Обновляет видимость кнопок действий для сеансов
 */
function updateSessionsActionButtons() {
    const selectedSessions = window._selectedSessions || new Set();
    const terminateBtn = document.getElementById('terminateSessionsBtn');
    const interruptBtn = document.getElementById('interruptSessionsBtn');
    
    if (terminateBtn) {
        terminateBtn.style.display = selectedSessions.size > 0 ? 'inline-block' : 'none';
    }
    if (interruptBtn) {
        interruptBtn.style.display = selectedSessions.size > 0 ? 'inline-block' : 'none';
    }
}

/**
 * Принудительное завершение выбранных сеансов из таблицы
 */
async function terminateSelectedSessionsFromTable() {
    const selectedSessions = window._selectedSessions || new Set();
    const connectionId = window._currentSessionsConnectionId;
    const clusterUuid = window._currentSessionsClusterUuid;
    
    if (!connectionId || !clusterUuid) {
        showNotification('❌ Ошибка: не найдены параметры подключения', true);
        return;
    }
    
    const sessionUuids = Array.from(selectedSessions);
    if (sessionUuids.length === 0) {
        showNotification('❌ Выберите сеансы для завершения', true);
        return;
    }
    
    const count = sessionUuids.length;
    if (!confirm(`Вы уверены, что хотите принудительно завершить ${count} сеанс${count > 1 ? 'ов' : ''}?`)) {
        return;
    }
    
    await terminateSelectedSessions(connectionId, clusterUuid, sessionUuids);
}

/**
 * Прерывание текущих серверных вызовов для выбранных сеансов из таблицы
 */
async function interruptSelectedSessionsFromTable() {
    const selectedSessions = window._selectedSessions || new Set();
    const connectionId = window._currentSessionsConnectionId;
    const clusterUuid = window._currentSessionsClusterUuid;
    
    if (!connectionId || !clusterUuid) {
        showNotification('❌ Ошибка: не найдены параметры подключения', true);
        return;
    }
    
    const sessionUuids = Array.from(selectedSessions);
    if (sessionUuids.length === 0) {
        showNotification('❌ Выберите сеансы для прерывания', true);
        return;
    }
    
    const count = sessionUuids.length;
    if (!confirm(`Вы уверены, что хотите прервать текущий серверный вызов для ${count} сеанс${count > 1 ? 'ов' : ''}?`)) {
        return;
    }
    
    await interruptSelectedSessions(connectionId, clusterUuid, sessionUuids);
}

/**
 * Фильтрует таблицу сеансов по поисковому запросу
 */
function filterSessionsTable() {
    const searchInput = document.getElementById('sessionsSearch');
    const searchTerm = (searchInput?.value || '').toLowerCase();
    const rows = document.querySelectorAll('.session-row');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

/**
 * Сортирует таблицу сеансов
 */
function sortSessionsTable(columnKey) {
    const sessions = window._sessionsData || [];
    const currentSort = window._sessionsSort || { column: null, direction: 'asc' };
    
    let direction = 'asc';
    if (currentSort.column === columnKey && currentSort.direction === 'asc') {
        direction = 'desc';
    }
    
    sessions.sort((a, b) => {
        let aVal = '';
        let bVal = '';
        
        if (columnKey === 'session') {
            aVal = a.uuid || '';
            bVal = b.uuid || '';
        } else {
            aVal = a.data[columnKey] || '';
            bVal = b.data[columnKey] || '';
        }
        
        if (direction === 'asc') {
            return aVal.localeCompare(bVal);
        } else {
            return bVal.localeCompare(aVal);
        }
    });
    
    window._sessionsSort = { column: columnKey, direction };
    
    // Перерисовываем таблицу
    const connectionId = window._currentSessionsConnectionId;
    const clusterUuid = window._currentSessionsClusterUuid;
    const infobaseUuid = window._currentSessionsInfobaseUuid;
    
    if (connectionId && clusterUuid) {
        renderSessionsTable(sessions, connectionId, clusterUuid);
        filterSessionsTable(); // Применяем фильтр если есть
    }
}

/**
 * Показывает контекстное меню для сеанса
 */
function showSessionContextMenu(event, connectionId, clusterUuid, sessionUuid) {
    event.preventDefault();
    event.stopPropagation();
    
    closeContextMenu();
    
    const selectedSessions = window._selectedSessions || new Set();
    const sessionsToProcess = selectedSessions.has(sessionUuid) ? Array.from(selectedSessions) : [sessionUuid];
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.style.zIndex = '10001';
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="openSessionInfoModal(${connectionId}, '${clusterUuid}', '${sessionUuid}'); closeContextMenu();">
            📋 Свойства
        </div>
    `;
    
    document.body.appendChild(menu);
    
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    
    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 100);
}

/**
 * Принудительно завершает выбранные сеансы
 */
async function terminateSelectedSessions(connectionId, clusterUuid, sessionUuids) {
    closeContextMenu();
    
    if (!sessionUuids || sessionUuids.length === 0) {
        showNotification('❌ Выберите сеансы для завершения', true);
        return;
    }
    
    const count = sessionUuids.length;
    if (!confirm(`Вы уверены, что хотите принудительно завершить ${count} сеанс${count > 1 ? 'ов' : ''}?`)) {
        return;
    }
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден', true);
            return;
        }
        
        const response = await fetch('/api/clusters/sessions/terminate/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                connection_id: connectionId,
                cluster_uuid: clusterUuid,
                session_uuids: sessionUuids
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const failed = result.results.filter(r => !r.success);
            if (failed.length === 0) {
                showNotification(`✅ Успешно завершено ${count} сеанс${count > 1 ? 'ов' : ''}`, false);
            } else {
                showNotification(`⚠️ Завершено ${count - failed.length} из ${count} сеансов. Ошибки: ${failed.map(f => f.error).join(', ')}`, true);
            }
            
            // Обновляем таблицу
            await refreshSessionsTable(connectionId, clusterUuid, window._currentSessionsInfobaseUuid || null);
        } else {
            showNotification('❌ Ошибка завершения сеансов: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

/**
 * Открывает модальное окно с детальной информацией о сеансе
 */
async function openSessionInfoModal(connectionId, clusterUuid, sessionUuid) {
    closeContextMenu();
    
    // Удаляем предыдущее модальное окно если есть
    const existingModal = document.getElementById('sessionInfoModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'sessionInfoModal';
    modal.style.zIndex = '10002';
    modal.innerHTML = `
        <div class="modal" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3>💺 Информация о сеансе</h3>
                <button class="modal-close-btn" onclick="closeSessionInfoModal()">×</button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 2rem;">
                    <p>⏳ Загрузка информации...</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    try {
        const response = await fetch(`/api/clusters/sessions/${connectionId}/${clusterUuid}/info/?session=${sessionUuid}`);
        const data = await response.json();
        
        if (data.success) {
            const session = data.session || {};
            const sessionData = session.data || {};
            
            let infoHtml = `
                <div class="info-card">
                    <h4>📊 Основная информация</h4>
                    <div class="form-row">
                        <label>UUID сеанса:</label>
                        <input type="text" class="readonly-field" value="${escapeHtml(session.uuid || sessionUuid)}" readonly>
                    </div>
            `;
            
            // Сортируем ключи для красивого отображения
            const sortedKeys = Object.keys(sessionData).sort();
            
            sortedKeys.forEach(key => {
                const value = sessionData[key] || '';
                infoHtml += `
                    <div class="form-row">
                        <label>${escapeHtml(key)}:</label>
                        <input type="text" class="readonly-field" value="${escapeHtml(value)}" readonly>
                    </div>
                `;
            });
            
            infoHtml += `</div>`;
            
            modal.querySelector('.modal-body').innerHTML = infoHtml;
        } else {
            modal.querySelector('.modal-body').innerHTML = `
                <div class="info-card" style="border-left: 4px solid var(--primary-color);">
                    <h4 style="color: var(--primary-color);">❌ Ошибка</h4>
                    <p style="color: #721c24; margin: 0;">${data.error || 'Неизвестная ошибка'}</p>
                </div>
            `;
        }
    } catch (error) {
        modal.querySelector('.modal-body').innerHTML = `
            <div class="info-card" style="border-left: 4px solid var(--primary-color);">
                <h4 style="color: var(--primary-color);">❌ Ошибка</h4>
                <p style="color: #721c24; margin: 0;">Ошибка загрузки: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Закрывает модальное окно информации о сеансе
 */
function closeSessionInfoModal() {
    const modal = document.getElementById('sessionInfoModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Инициализирует изменение размера столбцов для таблицы
 */
/**
 * Инициализирует drag and drop для перестановки столбцов
 */
function initColumnDragDrop(tableSelector, orderKey) {
    const table = document.querySelector(tableSelector);
    if (!table) return;
    
    const headers = table.querySelectorAll('thead th.draggable-column');
    let draggedElement = null;
    
    headers.forEach((header) => {
        header.addEventListener('dragstart', (e) => {
            draggedElement = header;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', header.getAttribute('data-column'));
            header.style.opacity = '0.5';
            header.classList.add('dragging');
        });
        
        header.addEventListener('dragend', (e) => {
            header.style.opacity = '1';
            header.classList.remove('dragging');
            draggedElement = null;
        });
        
        header.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            if (!draggedElement || draggedElement === header) return;
            
            const afterElement = getDragAfterElement(table.querySelector('thead tr'), e.clientX);
            if (afterElement == null) {
                table.querySelector('thead tr').appendChild(draggedElement);
            } else {
                table.querySelector('thead tr').insertBefore(draggedElement, afterElement);
            }
        });
        
        header.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!draggedElement) return;
            
            // Обновляем порядок в ячейках данных
            const tbody = table.querySelector('tbody');
            if (tbody) {
                const rows = tbody.querySelectorAll('tr');
                rows.forEach(row => {
                    const cells = Array.from(row.querySelectorAll('td[data-column]'));
                    const headerOrder = Array.from(table.querySelectorAll('thead th.draggable-column')).map(h => h.getAttribute('data-column'));
                    
                    // Создаем новый порядок ячеек
                    const newCells = [];
                    headerOrder.forEach(colKey => {
                        const cell = cells.find(c => c.getAttribute('data-column') === colKey);
                        if (cell) newCells.push(cell);
                    });
                    
                    // Заменяем ячейки
                    newCells.forEach(cell => row.appendChild(cell));
                });
            }
            
            // Сохраняем новый порядок
            const newOrder = [];
            const allHeaders = table.querySelectorAll('thead th.draggable-column');
            allHeaders.forEach(h => {
                const colKey = h.getAttribute('data-column');
                if (colKey) newOrder.push(colKey);
            });
            
            localStorage.setItem(orderKey, JSON.stringify(newOrder));
        });
    });
}

/**
 * Получает элемент после которого нужно вставить перетаскиваемый элемент
 */
function getDragAfterElement(container, x) {
    const draggableElements = [...container.querySelectorAll('th.draggable-column:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function initColumnResize(tableSelector) {
    const table = document.querySelector(tableSelector);
    if (!table) return;
    
    const resizeHandles = table.querySelectorAll('.resize-handle');
    let currentResize = null;
    
    resizeHandles.forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const th = handle.closest('th');
            if (!th) return;
            
            const startX = e.pageX;
            const startWidth = th.offsetWidth;
            
            currentResize = { th, startX, startWidth };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });
    });
    
    function handleMouseMove(e) {
        if (!currentResize) return;
        
        const diff = e.pageX - currentResize.startX;
        const newWidth = currentResize.startWidth + diff;
        
        if (newWidth > 50) { // Минимальная ширина столбца
            const columnIndex = Array.from(currentResize.th.parentElement.children).indexOf(currentResize.th);
            const columnKey = currentResize.th.getAttribute('data-column');
            
            // Устанавливаем ширину заголовка
            currentResize.th.style.width = newWidth + 'px';
            currentResize.th.style.minWidth = newWidth + 'px';
            
            // Обновляем ширину всех ячеек в этом столбце
            const tbody = table.querySelector('tbody');
            if (tbody) {
                const rows = tbody.querySelectorAll('tr');
                rows.forEach(row => {
                    const cell = row.querySelector(`td[data-column="${columnKey}"]`);
                    if (cell) {
                        cell.style.width = newWidth + 'px';
                        cell.style.minWidth = newWidth + 'px';
                    }
                });
            }
        }
    }
    
    function handleMouseUp() {
        if (currentResize) {
            currentResize = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
    }
}

/**
 * Выгружает таблицу сеансов в Excel
 */
function exportSessionsToExcel() {
    const sessions = window._sessionsData || [];
    if (sessions.length === 0) {
        showNotification('❌ Нет данных для выгрузки', true);
        return;
    }
    
    const visibleColumns = window._sessionsVisibleColumns || new Set();
    const allKeys = new Set();
    sessions.forEach(session => {
        Object.keys(session.data || {}).forEach(key => allKeys.add(key));
    });
    const sortedKeys = Array.from(allKeys).sort().filter(key => visibleColumns.has(key));
    
    // Создаем CSV данные
    let csv = '\uFEFF'; // BOM для правильной кодировки UTF-8 в Excel
    
    // Заголовки (включаем UUID если он видим)
    const headers = [];
    if (visibleColumns.has('session')) {
        headers.push('UUID сеанса');
    }
    sortedKeys.forEach(key => {
        if (key !== 'session' && visibleColumns.has(key)) {
            headers.push(key);
        }
    });
    // Используем точку с запятой как разделитель для лучшей совместимости с Excel
    const separator = ';';
    
    csv += headers.map(h => h.replace(/"/g, '""')).join(separator) + '\n';
    
    // Данные
    sessions.forEach(session => {
        const row = [];
        if (visibleColumns.has('session')) {
            row.push(String(session.uuid || ''));
        }
        sortedKeys.forEach(key => {
            if (key !== 'session' && visibleColumns.has(key)) {
                const value = session.data[key] || '';
                // Заменяем переносы строк на пробелы
                const cleanValue = String(value).replace(/\n/g, ' ').replace(/\r/g, '');
                row.push(cleanValue);
            }
        });
        csv += row.map(cell => {
            // Если ячейка содержит разделитель, кавычки или перенос строки - оборачиваем в кавычки
            if (cell.includes(separator) || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
                return `"${String(cell).replace(/"/g, '""')}"`;
            }
            return cell;
        }).join(separator) + '\n';
    });
    
    // Создаем blob и скачиваем
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sessions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('✅ Таблица выгружена в Excel', false);
}

/**
 * Переключает отображение фильтра столбцов
 */
function toggleSessionsColumnFilter() {
    const filterDiv = document.getElementById('sessionsColumnFilter');
    if (filterDiv) {
        filterDiv.style.display = filterDiv.style.display === 'none' ? 'block' : 'none';
        
        // Если открываем фильтр, заполняем список столбцов
        if (filterDiv.style.display === 'block') {
            updateSessionsColumnFilterList();
        }
    }
}

/**
 * Обновляет список столбцов в фильтре
 */
function updateSessionsColumnFilterList() {
    const filterList = document.getElementById('sessionsColumnFilterList');
    if (!filterList) return;
    
    const sessions = window._sessionsData || [];
    if (sessions.length === 0) return;
    
    // Собираем все уникальные ключи (включая UUID сеанса)
    const allKeys = new Set();
    sessions.forEach(session => {
        Object.keys(session.data || {}).forEach(key => allKeys.add(key));
    });
    allKeys.add('session');
    
    const sortedKeys = Array.from(allKeys).sort();
    
    // Получаем сохраненное состояние видимости столбцов
    // По умолчанию UUID выключен, остальные включены
    if (!window._sessionsVisibleColumns) {
        window._sessionsVisibleColumns = new Set(sortedKeys.filter(k => k !== 'session'));
    }
    const visibleColumns = window._sessionsVisibleColumns;
    
    // Проверяем, все ли столбцы выбраны
    const allSelected = sortedKeys.length > 0 && sortedKeys.every(key => visibleColumns.has(key));
    
    let html = `
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 600; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid #ddd;">
            <input type="checkbox" id="selectAllSessionsColumns" ${allSelected ? 'checked' : ''} onchange="toggleAllSessionsColumns(this.checked)">
            <span>Выбрать все</span>
        </label>
    `;
    
    sortedKeys.forEach(key => {
        const isVisible = visibleColumns.has(key);
        const displayName = key === 'session' ? 'UUID сеанса' : key;
        html += `
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" class="session-column-checkbox" data-column="${key}" ${isVisible ? 'checked' : ''} onchange="toggleSessionsColumn('${key}', this.checked)">
                <span>${escapeHtml(displayName)}</span>
            </label>
        `;
    });
    
    filterList.innerHTML = html;
}

/**
 * Переключает выбор всех столбцов сеансов
 */
function toggleAllSessionsColumns(selectAll) {
    const sessions = window._sessionsData || [];
    if (sessions.length === 0) return;
    
    // Собираем все уникальные ключи (включая UUID сеанса)
    const allKeys = new Set();
    sessions.forEach(session => {
        Object.keys(session.data || {}).forEach(key => allKeys.add(key));
    });
    allKeys.add('session');
    
    const sortedKeys = Array.from(allKeys).sort();
    
    if (!window._sessionsVisibleColumns) {
        window._sessionsVisibleColumns = new Set();
    }
    
    if (selectAll) {
        // Добавляем все столбцы
        sortedKeys.forEach(key => window._sessionsVisibleColumns.add(key));
    } else {
        // Удаляем все столбцы
        sortedKeys.forEach(key => window._sessionsVisibleColumns.delete(key));
    }
    
    // Обновляем чекбоксы в фильтре
    document.querySelectorAll('.session-column-checkbox').forEach(checkbox => {
        checkbox.checked = selectAll;
    });
    
    // Перерисовываем таблицу
    const connectionId = window._currentSessionsConnectionId;
    const clusterUuid = window._currentSessionsClusterUuid;
    
    if (connectionId && clusterUuid) {
        const sessions = window._sessionsData || [];
        renderSessionsTable(sessions, connectionId, clusterUuid);
        filterSessionsTable(); // Применяем фильтр если есть
    }
}

/**
 * Переключает видимость столбца
 */
function toggleSessionsColumn(columnKey, isVisible) {
    if (!window._sessionsVisibleColumns) {
        window._sessionsVisibleColumns = new Set();
    }
    
    if (isVisible) {
        window._sessionsVisibleColumns.add(columnKey);
    } else {
        window._sessionsVisibleColumns.delete(columnKey);
    }
    
    // Перерисовываем таблицу
    const connectionId = window._currentSessionsConnectionId;
    const clusterUuid = window._currentSessionsClusterUuid;
    const infobaseUuid = window._currentSessionsInfobaseUuid;
    
    if (connectionId && clusterUuid) {
        const sessions = window._sessionsData || [];
        renderSessionsTable(sessions, connectionId, clusterUuid);
        filterSessionsTable(); // Применяем фильтр если есть
    }
}

/**
 * Прерывает текущие серверные вызовы для выбранных сеансов
 */
async function interruptSelectedSessions(connectionId, clusterUuid, sessionUuids) {
    if (!sessionUuids || sessionUuids.length === 0) {
        showNotification('❌ Выберите сеансы для прерывания', true);
        return;
    }
    
    const count = sessionUuids.length;
    let successCount = 0;
    let errorCount = 0;
    
    showNotification(`⏳ Прерывание ${count} сеанс${count > 1 ? 'ов' : ''}...`, false);
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден', true);
            return;
        }
        
        // Выполняем запросы для каждого сеанса
        const promises = sessionUuids.map(async (sessionUuid) => {
            try {
                const response = await fetch('/api/clusters/sessions/interrupt/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify({
                        connection_id: connectionId,
                        cluster_uuid: clusterUuid,
                        session_uuids: [sessionUuid]
                    })
                });
                
                const data = await response.json();
                if (data.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
            }
        });
        
        await Promise.all(promises);
        
        // Очищаем выбор
        window._selectedSessions = new Set();
        updateSessionsActionButtons();
        const checkboxes = document.querySelectorAll('.session-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
        const selectAll = document.getElementById('selectAllSessions') || document.getElementById('selectAllSessionsHeader');
        if (selectAll) selectAll.checked = false;
        
        // Показываем результат
        if (errorCount === 0) {
            showNotification(`✅ Успешно прервано ${successCount} сеанс${successCount > 1 ? 'ов' : ''}`, false);
        } else {
            showNotification(`⚠️ Прервано ${successCount} из ${count} сеанс${count > 1 ? 'ов' : ''}. Ошибок: ${errorCount}`, true);
        }
        
        // Обновляем таблицу
        await refreshSessionsTable(connectionId, clusterUuid, window._currentSessionsInfobaseUuid || null);
    } catch (error) {
        showNotification(`❌ Ошибка: ${error.message}`, true);
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
 * Закрывает контекстное меню
 */
function closeContextMenu() {
    const menu = document.getElementById('clusterContextMenu');
    if (menu) {
        menu.remove();
    }
}

/**
 * Открывает модальное окно свойств кластера
 */
async function openClusterProperties(connectionId, clusterUuid, clusterName) {
    // Загружаем детальную информацию о кластере
    try {
        const response = await fetch(`/api/clusters/clusters/${connectionId}/${clusterUuid}/`);
        const data = await response.json();
        
        if (!data.success) {
            showNotification('❌ Ошибка загрузки свойств кластера: ' + (data.error || 'Неизвестная ошибка'), true);
            return;
        }
        
        const cluster = data.cluster || {};
        
        // Получаем имя кластера, убирая кавычки если есть
        let clusterNameValue = cluster.name || '';
        if (clusterNameValue) {
            clusterNameValue = clusterNameValue.replace(/^"|"$/g, '').trim();
        }
        // Если имя не найдено в данных кластера, используем переданное имя
        if (!clusterNameValue) {
            clusterNameValue = clusterName || '';
        }
        // Если всё ещё пусто, используем значение по умолчанию
        if (!clusterNameValue) {
            clusterNameValue = 'Кластер';
        }
        
        const displayName = clusterNameValue;
        
        // Создаём модальное окно в стилистике системы
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'clusterPropertiesModal';
        modal.innerHTML = `
            <div class="modal" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>⚙️ Свойства кластера: ${escapeHtml(displayName)}</h3>
                    <button class="modal-close-btn" onclick="closeClusterPropertiesModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="clusterPropertiesForm">
                        <div class="info-card">
                            <h4>📊 Основная информация</h4>
                            <div class="form-row">
                                <label>Имя кластера:</label>
                                <input type="text" id="clusterName" name="name" value="${escapeHtml(clusterNameValue)}">
                            </div>
                            <div class="form-row">
                                <label>UUID кластера:</label>
                                <input type="text" class="readonly-field" value="${escapeHtml(cluster.cluster || clusterUuid)}" readonly>
                            </div>
                            <div class="form-row">
                                <label>Хост:</label>
                                <input type="text" class="readonly-field" value="${escapeHtml(cluster.host || '')}" readonly>
                            </div>
                            <div class="form-row">
                                <label>Порт:</label>
                                <input type="text" class="readonly-field" value="${escapeHtml(cluster.port || '')}" readonly>
                            </div>
                        </div>
                        <div class="info-card">
                            <h4>⚙️ Параметры кластера</h4>
                            <div class="form-row">
                                <label>Период принудительного завершения (секунды):</label>
                                <input type="number" id="expirationTimeout" name="expiration_timeout" value="${cluster['expiration-timeout'] || cluster.expiration_timeout || '60'}">
                            </div>
                            <div class="form-row">
                                <label>Период перезапуска рабочих процессов (секунды):</label>
                                <input type="number" id="lifetimeLimit" name="lifetime_limit" value="${cluster['lifetime-limit'] || cluster.lifetime_limit || '0'}">
                            </div>
                            <div class="form-row">
                                <label>Максимальный объем памяти (КБ):</label>
                                <input type="number" id="maxMemorySize" name="max_memory_size" value="${cluster['max-memory-size'] || cluster.max_memory_size || '0'}">
                            </div>
                            <div class="form-row">
                                <label>Максимальный период превышения памяти (секунды):</label>
                                <input type="number" id="maxMemoryTimeLimit" name="max_memory_time_limit" value="${cluster['max-memory-time-limit'] || cluster.max_memory_time_limit || '0'}">
                            </div>
                            <div class="form-row">
                                <label>Уровень безопасности:</label>
                                <input type="number" id="securityLevel" name="security_level" value="${cluster['security-level'] || cluster.security_level || '0'}">
                            </div>
                            <div class="form-row">
                                <label>Уровень отказоустойчивости:</label>
                                <input type="number" id="sessionFaultToleranceLevel" name="session_fault_tolerance_level" value="${cluster['session-fault-tolerance-level'] || cluster.session_fault_tolerance_level || '0'}">
                            </div>
                            <div class="form-row">
                                <label>Режим распределения нагрузки:</label>
                                <select id="loadBalancingMode" name="load_balancing_mode">
                                    <option value="performance" ${(cluster['load-balancing-mode'] || cluster.load_balancing_mode || 'performance') === 'performance' ? 'selected' : ''}>Приоритет по производительности</option>
                                    <option value="memory" ${(cluster['load-balancing-mode'] || cluster.load_balancing_mode) === 'memory' ? 'selected' : ''}>Приоритет по памяти</option>
                                </select>
                            </div>
                            <div class="form-row">
                                <label>Допустимое отклонение ошибок (%):</label>
                                <input type="number" id="errorsCountThreshold" name="errors_count_threshold" value="${cluster['errors-count-threshold'] || cluster.errors_count_threshold || '0'}">
                            </div>
                            <div class="form-row">
                                <label>Принудительно завершать проблемные процессы:</label>
                                <select id="killProblemProcesses" name="kill_problem_processes">
                                    <option value="yes" ${(cluster['kill-problem-processes'] || cluster.kill_problem_processes || '1') === '1' || (cluster['kill-problem-processes'] || cluster.kill_problem_processes) === 'yes' ? 'selected' : ''}>Да</option>
                                    <option value="no" ${(cluster['kill-problem-processes'] || cluster.kill_problem_processes) === '0' || (cluster['kill-problem-processes'] || cluster.kill_problem_processes) === 'no' ? 'selected' : ''}>Нет</option>
                                </select>
                            </div>
                            <div class="form-row">
                                <label>Формировать дамп при превышении памяти:</label>
                                <select id="killByMemoryWithDump" name="kill_by_memory_with_dump">
                                    <option value="yes" ${(cluster['kill-by-memory-with-dump'] || cluster.kill_by_memory_with_dump || '0') === '1' || (cluster['kill-by-memory-with-dump'] || cluster.kill_by_memory_with_dump) === 'yes' ? 'selected' : ''}>Да</option>
                                    <option value="no" ${(cluster['kill-by-memory-with-dump'] || cluster.kill_by_memory_with_dump || '0') === '0' || (cluster['kill-by-memory-with-dump'] || cluster.kill_by_memory_with_dump) === 'no' ? 'selected' : ''}>Нет</option>
                                </select>
                            </div>
                            <div class="form-row">
                                <label>Разрешать запись событий аудита:</label>
                                <select id="allowAccessRightAuditEventsRecording" name="allow_access_right_audit_events_recording">
                                    <option value="yes" ${(cluster['allow-access-right-audit-events-recording'] || cluster.allow_access_right_audit_events_recording || '0') === '1' || (cluster['allow-access-right-audit-events-recording'] || cluster.allow_access_right_audit_events_recording) === 'yes' ? 'selected' : ''}>Да</option>
                                    <option value="no" ${(cluster['allow-access-right-audit-events-recording'] || cluster.allow_access_right_audit_events_recording || '0') === '0' || (cluster['allow-access-right-audit-events-recording'] || cluster.allow_access_right_audit_events_recording) === 'no' ? 'selected' : ''}>Нет</option>
                                </select>
                            </div>
                            <div class="form-row">
                                <label>Период отправки ping (миллисекунды):</label>
                                <input type="number" id="pingPeriod" name="ping_period" value="${cluster['ping-period'] || cluster.ping_period || '0'}">
                            </div>
                            <div class="form-row">
                                <label>Таймаут ping (миллисекунды):</label>
                                <input type="number" id="pingTimeout" name="ping_timeout" value="${cluster['ping-timeout'] || cluster.ping_timeout || '0'}">
                            </div>
                        </div>
                        <div class="form-actions" style="margin-top: 1.5rem;">
                            <button type="button" class="btn btn-secondary" onclick="closeClusterPropertiesModal()">Отмена</button>
                            <button type="button" class="btn btn-primary" onclick="saveClusterProperties('${connectionId}', '${clusterUuid}')">Сохранить</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (error) {
        showNotification('❌ Ошибка загрузки свойств кластера: ' + error.message, true);
    }
}

/**
 * Закрывает модальное окно свойств кластера
 */
function closeClusterPropertiesModal() {
    const modal = document.getElementById('clusterPropertiesModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Сохраняет свойства кластера
 */
async function saveClusterProperties(connectionId, clusterUuid) {
    const form = document.getElementById('clusterPropertiesForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const data = {};
    
    // Собираем данные формы
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден', true);
            return;
        }
        
        const response = await fetch(`/api/clusters/clusters/${connectionId}/${clusterUuid}/update/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Параметры кластера успешно обновлены', false);
            closeClusterPropertiesModal();
            // Обновляем список кластеров
            if (window._currentConnectionId) {
                loadConnectionData(window._currentConnectionId);
            }
        } else {
            showNotification('❌ Ошибка обновления кластера: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка сохранения: ' + error.message, true);
    }
}

/**
 * Открывает модальное окно регистрации нового кластера
 */
function openRegisterClusterModal(connectionId) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'registerClusterModal';
    modal.innerHTML = `
        <div class="modal" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3>➕ Регистрация нового кластера</h3>
                <button class="modal-close-btn" onclick="closeRegisterClusterModal()">×</button>
            </div>
            <div class="modal-body">
                <form id="registerClusterForm">
                    <div class="info-card">
                        <h4>📊 Основная информация</h4>
                        <div class="form-row">
                            <label>Хост (обязательно):</label>
                            <input type="text" id="registerHost" name="host" required placeholder="localhost или IP-адрес">
                        </div>
                        <div class="form-row">
                            <label>Порт (обязательно):</label>
                            <input type="number" id="registerPort" name="port" value="1541" required>
                        </div>
                        <div class="form-row">
                            <label>Имя кластера:</label>
                            <input type="text" id="registerName" name="name" placeholder="Локальный кластер">
                        </div>
                    </div>
                    <div class="info-card">
                        <h4>⚙️ Параметры кластера</h4>
                        <div class="form-row">
                            <label>Период принудительного завершения (секунды):</label>
                            <input type="number" id="registerExpirationTimeout" name="expiration_timeout" value="60">
                        </div>
                        <div class="form-row">
                            <label>Период перезапуска рабочих процессов (секунды):</label>
                            <input type="number" id="registerLifetimeLimit" name="lifetime_limit" value="0">
                        </div>
                        <div class="form-row">
                            <label>Максимальный объем памяти (КБ):</label>
                            <input type="number" id="registerMaxMemorySize" name="max_memory_size" value="0">
                        </div>
                        <div class="form-row">
                            <label>Максимальный период превышения памяти (секунды):</label>
                            <input type="number" id="registerMaxMemoryTimeLimit" name="max_memory_time_limit" value="0">
                        </div>
                        <div class="form-row">
                            <label>Уровень безопасности:</label>
                            <input type="number" id="registerSecurityLevel" name="security_level" value="0">
                        </div>
                        <div class="form-row">
                            <label>Уровень отказоустойчивости:</label>
                            <input type="number" id="registerSessionFaultToleranceLevel" name="session_fault_tolerance_level" value="0">
                        </div>
                        <div class="form-row">
                            <label>Режим распределения нагрузки:</label>
                            <select id="registerLoadBalancingMode" name="load_balancing_mode">
                                <option value="performance" selected>Приоритет по производительности</option>
                                <option value="memory">Приоритет по памяти</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label>Допустимое отклонение ошибок (%):</label>
                            <input type="number" id="registerErrorsCountThreshold" name="errors_count_threshold" value="0">
                        </div>
                        <div class="form-row">
                            <label>Принудительно завершать проблемные процессы:</label>
                            <select id="registerKillProblemProcesses" name="kill_problem_processes">
                                <option value="yes" selected>Да</option>
                                <option value="no">Нет</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label>Формировать дамп при превышении памяти:</label>
                            <select id="registerKillByMemoryWithDump" name="kill_by_memory_with_dump">
                                <option value="yes">Да</option>
                                <option value="no" selected>Нет</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label>Разрешать запись событий аудита:</label>
                            <select id="registerAllowAccessRightAuditEventsRecording" name="allow_access_right_audit_events_recording">
                                <option value="yes">Да</option>
                                <option value="no" selected>Нет</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label>Период отправки ping (миллисекунды):</label>
                            <input type="number" id="registerPingPeriod" name="ping_period" value="0">
                        </div>
                        <div class="form-row">
                            <label>Таймаут ping (миллисекунды):</label>
                            <input type="number" id="registerPingTimeout" name="ping_timeout" value="0">
                        </div>
                    </div>
                    <div class="form-actions" style="margin-top: 1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="closeRegisterClusterModal()">Отмена</button>
                        <button type="button" class="btn btn-primary" onclick="saveRegisterCluster(${connectionId})">Зарегистрировать</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * Закрывает модальное окно регистрации кластера
 */
function closeRegisterClusterModal() {
    const modal = document.getElementById('registerClusterModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Сохраняет регистрацию нового кластера
 */
async function saveRegisterCluster(connectionId) {
    const form = document.getElementById('registerClusterForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const data = {};
    
    // Собираем данные формы
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }
    
    // Проверяем обязательные поля
    if (!data.host || !data.port) {
        showNotification('❌ Ошибка: Host и Port обязательны', true);
        return;
    }
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден', true);
            return;
        }
        
        const response = await fetch(`/api/clusters/clusters/${connectionId}/insert/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Кластер успешно зарегистрирован', false);
            closeRegisterClusterModal();
            // Обновляем список кластеров
            if (window._currentConnectionId) {
                loadConnectionData(window._currentConnectionId);
            }
        } else {
            showNotification('❌ Ошибка регистрации кластера: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка сохранения: ' + error.message, true);
    }
}

/**
 * Удаляет кластер
 */
async function deleteCluster(connectionId, clusterUuid, clusterName) {
    if (!confirm(`Вы уверены, что хотите удалить кластер "${clusterName}"?`)) {
        return;
    }
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден', true);
            return;
        }
        
        const response = await fetch(`/api/clusters/clusters/${connectionId}/${clusterUuid}/remove/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Кластер успешно удалён', false);
            // Обновляем список кластеров
            if (window._currentConnectionId) {
                loadConnectionData(window._currentConnectionId);
            }
        } else {
            showNotification('❌ Ошибка удаления кластера: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка удаления: ' + error.message, true);
    }
}

// ============================================
// Контекстные меню для секций
// ============================================

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

/**
 * Закрывает контекстное меню
 */
function closeContextMenu() {
    const menus = ['sectionContextMenu', 'infobaseContextMenu', 'serverContextMenu', 'clusterContextMenu'];
    menus.forEach(id => {
        const menu = document.getElementById(id);
        if (menu) {
            menu.remove();
        }
    });
}

// ============================================
// Функции для работы с информационными базами
// ============================================

/**
 * Открывает модальное окно создания информационной базы
 */
function openCreateInfobaseModal(connectionId, clusterUuid) {
    closeContextMenu();
    
    // Удаляем предыдущее модальное окно если есть
    const existingModal = document.getElementById('createInfobaseModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'createInfobaseModal';
    modal.innerHTML = `
        <div class="modal" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3>➕ Создание информационной базы</h3>
                <button class="modal-close-btn" onclick="closeCreateInfobaseModal()">×</button>
            </div>
            <div class="modal-body">
                <form id="createInfobaseForm">
                    <div class="info-card">
                        <h4>📊 Основная информация 1С</h4>
                        <div class="form-row">
                            <label>Имя информационной базы (обязательно):</label>
                            <input type="text" id="infobaseName" name="name" required placeholder="Название базы">
                        </div>
                        <div class="form-row">
                            <label>Описание:</label>
                            <input type="text" id="infobaseDescr" name="descr" placeholder="Описание информационной базы">
                        </div>
                    </div>
                    <div class="info-card">
                        <h4>📊 Основная информация СУБД</h4>
                        <div class="form-row">
                            <label>Тип СУБД (обязательно):</label>
                            <select id="infobaseDbms" name="dbms" required>
                                <option value="PostgreSQL" selected>PostgreSQL</option>
                                <option value="MSSQLServer">MS SQL Server</option>
                                <option value="IBMDB2">IBM DB2</option>
                                <option value="OracleDatabase">Oracle Database</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label>Сервер баз данных (обязательно):</label>
                            <input type="text" id="infobaseDbServer" name="db_server" required placeholder="localhost или IP-адрес">
                        </div>
                        <div class="form-row">
                            <label>Имя базы данных (обязательно):</label>
                            <input type="text" id="infobaseDbName" name="db_name" required placeholder="Имя БД">
                        </div>
                        <div class="form-row">
                            <label>Имя администратора БД:</label>
                            <input type="text" id="infobaseDbUser" name="db_user" placeholder="sa">
                        </div>
                        <div class="form-row">
                            <label>Пароль администратора БД:</label>
                            <input type="password" id="infobaseDbPwd" name="db_pwd" placeholder="Пароль">
                        </div>
                    </div>
                    <div class="info-card">
                        <h4>⚙️ Дополнительные параметры</h4>
                        <div class="form-row">
                            <label>Создать базу данных:</label>
                            <select id="infobaseCreateDatabase" name="create_database">
                                <option value="false">Нет</option>
                                <option value="true">Да</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label>Блокировка регламентных заданий:</label>
                            <select id="infobaseScheduledJobsDeny" name="scheduled_jobs_deny">
                                <option value="off">Выключена</option>
                                <option value="on">Включена</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label>Выдача лицензий:</label>
                            <select id="infobaseLicenseDistribution" name="license_distribution">
                                <option value="allow">Разрешена</option>
                                <option value="deny">Запрещена</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label>Идентификатор национальных настроек (обязательно):</label>
                            <input type="text" id="infobaseLocale" name="locale" required placeholder="ru_RU" value="ru_RU">
                        </div>
                        <div class="form-row">
                            <label>Уровень безопасности:</label>
                            <input type="number" id="infobaseSecurityLevel" name="security_level" value="0" min="0">
                        </div>
                    </div>
                    <div class="form-actions" style="margin-top: 1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="closeCreateInfobaseModal()">Отмена</button>
                        <button type="button" class="btn btn-primary" onclick="saveCreateInfobase(${connectionId}, '${clusterUuid}')">Создать</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Автозаполнение при вводе имени информационной базы
    const nameInput = document.getElementById('infobaseName');
    const descrInput = document.getElementById('infobaseDescr');
    const dbNameInput = document.getElementById('infobaseDbName');
    
    if (nameInput && descrInput && dbNameInput) {
        let dbNameWasManuallyEdited = false;
        let lastNameValue = '';
        
        // Автозаполнение при вводе имени информационной базы
        nameInput.addEventListener('input', (e) => {
            const currentValue = e.target.value.trim();
            
            // Автозаполняем описание только если оно пустое
            if (currentValue && !descrInput.value) {
                descrInput.value = `Владелец:`;
            }
            
            // Автозаполняем имя базы данных только если оно не было изменено вручную
            if (currentValue && !dbNameWasManuallyEdited) {
                dbNameInput.value = currentValue;
            }
            
            lastNameValue = currentValue;
        });
        
        // Отслеживаем ручное редактирование поля "Имя базы данных"
        dbNameInput.addEventListener('input', () => {
            // Если пользователь изменил значение вручную, помечаем это
            if (dbNameInput.value !== lastNameValue) {
                dbNameWasManuallyEdited = true;
            }
        });
        
        // При фокусе на поле "Имя базы данных" разрешаем независимое редактирование
        dbNameInput.addEventListener('focus', () => {
            // Разрешаем независимое редактирование
            dbNameWasManuallyEdited = true;
        });
    }
}

/**
 * Закрывает модальное окно создания информационной базы
 */
function closeCreateInfobaseModal() {
    const modal = document.getElementById('createInfobaseModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Сохраняет создание информационной базы
 */
async function saveCreateInfobase(connectionId, clusterUuid) {
    const form = document.getElementById('createInfobaseForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        if (key === 'create_database') {
            data[key] = value === 'true';
        } else {
            data[key] = value;
        }
    }
    
    // Проверяем обязательные поля
    if (!data.name || !data.dbms || !data.db_server || !data.db_name || !data.locale) {
        showNotification('❌ Ошибка: Заполните все обязательные поля', true);
        return;
    }
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден', true);
            return;
        }
        
        const response = await fetch(`/api/clusters/infobases/${connectionId}/${clusterUuid}/create/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Информационная база успешно создана', false);
            closeCreateInfobaseModal();
            // Обновляем дерево
            const clusterId = `cluster-${connectionId}-${clusterUuid}`;
            const sectionId = `infobases-${clusterId}`;
            await loadInfobasesIntoTree(connectionId, clusterUuid, sectionId);
        } else {
            showNotification('❌ Ошибка создания информационной базы: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка сохранения: ' + error.message, true);
    }
}

/**
 * Открывает модальное окно свойств информационной базы
 */
async function openInfobaseProperties(connectionId, clusterUuid, infobaseUuid) {
    closeContextMenu();
    
    try {
        const response = await fetch(`/api/clusters/infobases/${connectionId}/${clusterUuid}/info/?infobase=${infobaseUuid}`);
        const data = await response.json();
        
        if (!data.success) {
            showNotification('❌ Ошибка загрузки свойств информационной базы: ' + (data.error || 'Неизвестная ошибка'), true);
            return;
        }
        
        const infobase = data.infobase || {};
        const infobaseData = infobase.data || {};
        
        // Получаем имя информационной базы
        let infobaseNameValue = infobase.name || '';
        if (infobaseNameValue) {
            infobaseNameValue = infobaseNameValue.replace(/^"|"$/g, '').trim();
        }
        if (!infobaseNameValue) {
            infobaseNameValue = infobaseData.name || 'Информационная база';
        }
        const displayName = infobaseNameValue;
        
        // Получаем значения полей
        const getValue = (key) => {
            // Пробуем разные варианты ключей
            return infobaseData[key] || 
                   infobaseData[key.replace(/-/g, '_')] || 
                   infobaseData[key.replace(/_/g, '-')] ||
                   '';
        };
        
        // Получаем описание (может быть в разных полях)
        const getDescr = () => {
            return getValue('descr') || 
                   getValue('description') || 
                   infobaseData['descr'] || 
                   infobaseData['description'] || 
                   '';
        };
        
        // Блокировка регламентных заданий
        const scheduledJobsDeny = getValue('scheduled-jobs-deny') || 'off';
        
        // Блокировка сеансов
        const sessionsDeny = getValue('sessions-deny') || 'off';
        
        // Удаляем предыдущее модальное окно если есть
        const existingModal = document.getElementById('infobasePropertiesModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'infobasePropertiesModal';
        modal.innerHTML = `
            <div class="modal" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>📁 Свойства информационной базы: ${escapeHtml(displayName)}</h3>
                    <button class="modal-close-btn" onclick="closeInfobasePropertiesModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="infobasePropertiesForm">
                        <div class="info-card">
                            <h4>📊 Основная информация 1С</h4>
                            <div class="form-row">
                                <label>UUID информационной базы:</label>
                                <input type="text" class="readonly-field" value="${escapeHtml(infobase.uuid || infobaseUuid)}" readonly>
                            </div>
                            <div class="form-row">
                                <label>Имя информационной базы:</label>
                                <input type="text" id="infobaseName" name="name" value="${escapeHtml(infobaseNameValue)}">
                            </div>
                            <div class="form-row">
                                <label>Описание:</label>
                                <input type="text" id="infobaseDescr" name="descr" value="${escapeHtml(getDescr())}">
                            </div>
                        </div>
                        <div class="info-card">
                            <h4>📊 Основная информация СУБД</h4>
                            <div class="form-row">
                                <label>Тип СУБД:</label>
                                <input type="text" class="readonly-field" value="${escapeHtml(getValue('dbms') || '')}" readonly>
                            </div>
                            <div class="form-row">
                                <label>Сервер баз данных:</label>
                                <input type="text" class="readonly-field" value="${escapeHtml(getValue('db-server') || '')}" readonly>
                            </div>
                            <div class="form-row">
                                <label>Имя базы данных:</label>
                                <input type="text" class="readonly-field" value="${escapeHtml(getValue('db-name') || '')}" readonly>
                            </div>
                        </div>
                        <div class="info-card">
                            <h4>⚙️ Дополнительные параметры</h4>
                            <div class="form-row">
                                <label>Блокировка регламентных заданий:</label>
                                <select id="infobaseScheduledJobsDeny" name="scheduled_jobs_deny">
                                    <option value="off" ${scheduledJobsDeny === 'off' ? 'selected' : ''}>Выключена</option>
                                    <option value="on" ${scheduledJobsDeny === 'on' ? 'selected' : ''}>Включена</option>
                                </select>
                            </div>
                            <div class="form-row">
                                <label>Блокировка сеансов:</label>
                                <select id="infobaseSessionsDeny" name="sessions_deny">
                                    <option value="off" ${sessionsDeny === 'off' ? 'selected' : ''}>Выключена</option>
                                    <option value="on" ${sessionsDeny === 'on' ? 'selected' : ''}>Включена</option>
                                </select>
                            </div>
                            <div class="form-row">
                                <label>Выдача лицензий:</label>
                                <select id="infobaseLicenseDistribution" name="license_distribution">
                                    <option value="allow" ${getValue('license-distribution') === 'allow' ? 'selected' : ''}>Разрешена</option>
                                    <option value="deny" ${getValue('license-distribution') === 'deny' ? 'selected' : ''}>Запрещена</option>
                                </select>
                            </div>
                            <div class="form-row">
                                <label>Уровень безопасности:</label>
                                <input type="number" id="infobaseSecurityLevel" name="security_level" value="${getValue('security-level') || '0'}" min="0">
                            </div>
                        </div>
                        <div class="form-actions" style="margin-top: 1.5rem;">
                            <button type="button" class="btn btn-secondary" onclick="closeInfobasePropertiesModal()">Отмена</button>
                            <button type="button" class="btn btn-primary" onclick="saveInfobaseProperties('${connectionId}', '${clusterUuid}', '${infobaseUuid}')">Сохранить</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    } catch (error) {
        showNotification('❌ Ошибка загрузки свойств информационной базы: ' + error.message, true);
    }
}

/**
 * Сохраняет свойства информационной базы
 */
async function saveInfobaseProperties(connectionId, clusterUuid, infobaseUuid) {
    const form = document.getElementById('infobasePropertiesForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const data = {
        infobase_uuid: infobaseUuid
    };
    
    // Собираем данные формы
    for (let [key, value] of formData.entries()) {
        if (value) {
            data[key] = value;
        }
    }
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден', true);
            return;
        }
        
        const response = await fetch(`/api/clusters/infobases/${connectionId}/${clusterUuid}/update/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Параметры информационной базы успешно обновлены', false);
            closeInfobasePropertiesModal();
            // Обновляем дерево
            const clusterId = `cluster-${connectionId}-${clusterUuid}`;
            const sectionId = `infobases-${clusterId}`;
            await loadInfobasesIntoTree(connectionId, clusterUuid, sectionId);
        } else {
            showNotification('❌ Ошибка обновления информационной базы: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка сохранения: ' + error.message, true);
    }
}

/**
 * Закрывает модальное окно свойств информационной базы
 */
function closeInfobasePropertiesModal() {
    const modal = document.getElementById('infobasePropertiesModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Показывает модальное окно выбора варианта удаления информационной базы
 */
function showDeleteInfobaseModal(connectionId, clusterUuid, infobaseUuid, infobaseName) {
    closeContextMenu();
    
    // Удаляем предыдущее модальное окно если есть
    const existingModal = document.getElementById('deleteInfobaseModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'deleteInfobaseModal';
    modal.innerHTML = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header">
                <h3>🗑️ Удаление информационной базы</h3>
                <button class="modal-close-btn" onclick="closeDeleteInfobaseModal()">×</button>
            </div>
            <div class="modal-body">
                <div class="info-card">
                    <h4>📋 Выберите вариант удаления</h4>
                    <p style="margin-bottom: 1rem;">Информационная база: <strong>${escapeHtml(infobaseName)}</strong></p>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <label style="display: flex; align-items: start; gap: 0.75rem; cursor: pointer; padding: 1rem; border: 2px solid #ddd; border-radius: 6px; transition: all 0.2s;">
                            <input type="radio" name="deleteType" value="default" checked style="margin-top: 0.25rem;">
                            <div style="flex: 1;">
                                <strong>Удалить без удаления на СУБД</strong>
                                <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">Информационная база будет удалена из кластера, но база данных на сервере СУБД останется</p>
                            </div>
                        </label>
                        <label style="display: flex; align-items: start; gap: 0.75rem; cursor: pointer; padding: 1rem; border: 2px solid #ddd; border-radius: 6px; transition: all 0.2s;">
                            <input type="radio" name="deleteType" value="clear" style="margin-top: 0.25rem;">
                            <div style="flex: 1;">
                                <strong>Очистить базу данных</strong>
                                <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">Информационная база будет удалена из кластера, база данных на СУБД будет очищена</p>
                            </div>
                        </label>
                        <label style="display: flex; align-items: start; gap: 0.75rem; cursor: pointer; padding: 1rem; border: 2px solid #ddd; border-radius: 6px; transition: all 0.2s;">
                            <input type="radio" name="deleteType" value="drop" style="margin-top: 0.25rem;">
                            <div style="flex: 1;">
                                <strong>Удалить базу данных на сервере СУБД</strong>
                                <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">Информационная база будет удалена из кластера, база данных будет полностью удалена с сервера СУБД</p>
                            </div>
                        </label>
                    </div>
                </div>
                <div class="form-actions" style="margin-top: 1.5rem;">
                    <button type="button" class="btn btn-secondary" onclick="closeDeleteInfobaseModal()">Отмена</button>
                    <button type="button" class="btn btn-danger" onclick="confirmDeleteInfobase(${connectionId}, '${clusterUuid}', '${infobaseUuid}', '${escapeHtml(infobaseName).replace(/'/g, "\\'")}')">Удалить</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Добавляем стили для hover эффекта
    const labels = modal.querySelectorAll('label');
    labels.forEach(label => {
        label.addEventListener('mouseenter', () => {
            label.style.borderColor = 'var(--primary-color)';
            label.style.background = '#fff5f5';
        });
        label.addEventListener('mouseleave', () => {
            label.style.borderColor = '#ddd';
            label.style.background = 'transparent';
        });
    });
}

/**
 * Закрывает модальное окно удаления информационной базы
 */
function closeDeleteInfobaseModal() {
    const modal = document.getElementById('deleteInfobaseModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Подтверждает удаление информационной базы
 */
async function confirmDeleteInfobase(connectionId, clusterUuid, infobaseUuid, infobaseName) {
    const modal = document.getElementById('deleteInfobaseModal');
    if (!modal) return;
    
    const selectedType = modal.querySelector('input[name="deleteType"]:checked')?.value || 'default';
    
    let dropDatabase = false;
    let clearDatabase = false;
    
    if (selectedType === 'drop') {
        dropDatabase = true;
    } else if (selectedType === 'clear') {
        clearDatabase = true;
    }
    
    closeDeleteInfobaseModal();
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден', true);
            return;
        }
        
        const response = await fetch(`/api/clusters/infobases/${connectionId}/${clusterUuid}/drop/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                infobase_uuid: infobaseUuid,
                drop_database: dropDatabase,
                clear_database: clearDatabase
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Информационная база успешно удалена', false);
            // Обновляем дерево, остаёмся в иерархии
            const clusterId = `cluster-${connectionId}-${clusterUuid}`;
            const sectionId = `infobases-${clusterId}`;
            await loadInfobasesIntoTree(connectionId, clusterUuid, sectionId);
        } else {
            showNotification('❌ Ошибка удаления: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка удаления: ' + error.message, true);
    }
}

/**
 * Удаляет информационную базу (старая функция, теперь вызывает модальное окно)
 */
function deleteInfobase(connectionId, clusterUuid, infobaseUuid, infobaseName) {
    showDeleteInfobaseModal(connectionId, clusterUuid, infobaseUuid, infobaseName);
}

// ============================================
// Функции для работы с рабочими серверами
// ============================================

/**
 * Открывает модальное окно создания рабочего сервера
 */
function openCreateServerModal(connectionId, clusterUuid) {
    closeContextMenu();
    
    // Удаляем предыдущее модальное окно если есть
    const existingModal = document.getElementById('createServerModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'createServerModal';
    modal.innerHTML = `
        <div class="modal" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3>➕ Регистрация рабочего сервера</h3>
                <button class="modal-close-btn" onclick="closeCreateServerModal()">×</button>
            </div>
            <div class="modal-body">
                <form id="createServerForm">
                    <div class="info-card">
                        <h4>📊 Основная информация</h4>
                        <div class="form-row">
                            <label>Имя хоста агента сервера (обязательно):</label>
                            <input type="text" id="serverAgentHost" name="agent_host" required placeholder="localhost или IP-адрес">
                        </div>
                        <div class="form-row">
                            <label>Основной порт агента сервера (обязательно):</label>
                            <input type="number" id="serverAgentPort" name="agent_port" required placeholder="1540" value="1540">
                        </div>
                        <div class="form-row">
                            <label>Диапазон портов (обязательно):</label>
                            <input type="text" id="serverPortRange" name="port_range" required placeholder="1560:1591" value="1560:1591">
                            <small style="color: #666; font-size: 0.85rem;">Формат: min:max (например, 1560:1591)</small>
                        </div>
                        <div class="form-row">
                            <label>Наименование рабочего сервера:</label>
                            <input type="text" id="serverName" name="name" placeholder="Название сервера">
                        </div>
                    </div>
                    <div class="info-card">
                        <h4>⚙️ Параметры сервера</h4>
                        <div class="form-row">
                            <label>Вариант использования:</label>
                            <select id="serverUsing" name="using">
                                <option value="normal">Рабочий сервер</option>
                                <option value="main">Центральный сервер</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label>Максимальное количество информационных баз на рабочий процесс:</label>
                            <input type="number" id="serverInfobasesLimit" name="infobases_limit" value="0" min="0">
                        </div>
                        <div class="form-row">
                            <label>Предел использования памяти (КБ):</label>
                            <input type="number" id="serverMemoryLimit" name="memory_limit" value="0" min="0">
                        </div>
                        <div class="form-row">
                            <label>Максимальное количество соединений на рабочий процесс:</label>
                            <input type="number" id="serverConnectionsLimit" name="connections_limit" value="0" min="0">
                        </div>
                        <div class="form-row">
                            <label>Номер порта главного менеджера кластера:</label>
                            <input type="number" id="serverClusterPort" name="cluster_port" value="1541" min="1" max="65535">
                        </div>
                        <div class="form-row">
                            <label>Вариант размещения менеджеров сервисов:</label>
                            <select id="serverDedicateManagers" name="dedicate_managers">
                                <option value="none">В одном менеджере</option>
                                <option value="all">В отдельных менеджерах</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-actions" style="margin-top: 1.5rem;">
                        <button type="button" class="btn btn-secondary" onclick="closeCreateServerModal()">Отмена</button>
                        <button type="button" class="btn btn-primary" onclick="saveCreateServer(${connectionId}, '${clusterUuid}')">Зарегистрировать</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * Закрывает модальное окно создания рабочего сервера
 */
function closeCreateServerModal() {
    const modal = document.getElementById('createServerModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Сохраняет создание рабочего сервера
 */
async function saveCreateServer(connectionId, clusterUuid) {
    const form = document.getElementById('createServerForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        if (value) {
            data[key] = value;
        }
    }
    
    // Проверяем обязательные поля
    if (!data.agent_host || !data.agent_port || !data.port_range) {
        showNotification('❌ Ошибка: Заполните все обязательные поля', true);
        return;
    }
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден', true);
            return;
        }
        
        const response = await fetch(`/api/clusters/servers/${connectionId}/${clusterUuid}/insert/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Рабочий сервер успешно зарегистрирован', false);
            closeCreateServerModal();
            // Обновляем дерево
            const clusterId = `cluster-${connectionId}-${clusterUuid}`;
            const sectionId = `servers-${clusterId}`;
            await loadServersIntoTree(connectionId, clusterUuid, sectionId);
        } else {
            showNotification('❌ Ошибка регистрации рабочего сервера: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка сохранения: ' + error.message, true);
    }
}

/**
 * Открывает модальное окно свойств рабочего сервера
 */
async function openServerProperties(connectionId, clusterUuid, serverUuid) {
    closeContextMenu();
    
    try {
        const response = await fetch(`/api/clusters/servers/${connectionId}/${clusterUuid}/${serverUuid}/info/`);
        const data = await response.json();
        
        if (!data.success) {
            showNotification('❌ Ошибка загрузки свойств рабочего сервера: ' + (data.error || 'Неизвестная ошибка'), true);
            return;
        }
        
        const server = data.server || {};
        const serverData = server.data || {};
        
        // Получаем имя сервера
        let serverNameValue = server.name || '';
        if (serverNameValue) {
            serverNameValue = serverNameValue.replace(/^"|"$/g, '').trim();
        }
        if (!serverNameValue) {
            serverNameValue = serverData.name || server.host || 'Рабочий сервер';
        }
        const displayName = serverNameValue;
        
        // Получаем значения полей
        const getValue = (key) => {
            return serverData[key] || serverData[key.replace(/-/g, '_')] || '';
        };
        
        const usingValue = getValue('using') || 'normal';
        const usingText = usingValue === 'main' ? 'Центральный сервер' : 'Рабочий сервер';
        
        // Удаляем предыдущее модальное окно если есть
        const existingModal = document.getElementById('serverPropertiesModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'serverPropertiesModal';
        modal.innerHTML = `
            <div class="modal" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <h3>⚙️ Свойства рабочего сервера: ${escapeHtml(displayName)}</h3>
                    <button class="modal-close-btn" onclick="closeServerPropertiesModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="serverPropertiesForm">
                        <div class="info-card">
                            <h4>📊 Основная информация</h4>
                            <div class="form-row">
                                <label>UUID сервера:</label>
                                <input type="text" class="readonly-field" value="${escapeHtml(server.uuid || serverUuid)}" readonly>
                            </div>
                            <div class="form-row">
                                <label>Имя хоста агента:</label>
                                <input type="text" class="readonly-field" value="${escapeHtml(getValue('agent-host') || server.host || '')}" readonly>
                            </div>
                            <div class="form-row">
                                <label>Порт агента:</label>
                                <input type="text" class="readonly-field" value="${escapeHtml(getValue('agent-port') || '')}" readonly>
                            </div>
                            <div class="form-row">
                                <label>Наименование:</label>
                                <input type="text" id="serverName" name="name" value="${escapeHtml(serverNameValue)}">
                            </div>
                        </div>
                        <div class="info-card">
                            <h4>⚙️ Параметры сервера</h4>
                            <div class="form-row">
                                <label>Вариант использования:</label>
                                <select id="serverUsing" name="using">
                                    <option value="normal" ${usingValue === 'normal' ? 'selected' : ''}>Рабочий сервер</option>
                                    <option value="main" ${usingValue === 'main' ? 'selected' : ''}>Центральный сервер</option>
                                </select>
                            </div>
                            <div class="form-row">
                                <label>Диапазон портов:</label>
                                <input type="text" id="serverPortRange" name="port_range" value="${escapeHtml(getValue('port-range') || '')}" placeholder="1560:1591">
                            </div>
                            <div class="form-row">
                                <label>Максимальное количество информационных баз на рабочий процесс:</label>
                                <input type="number" id="serverInfobasesLimit" name="infobases_limit" value="${getValue('infobases-limit') || '0'}" min="0">
                            </div>
                            <div class="form-row">
                                <label>Предел использования памяти (КБ):</label>
                                <input type="number" id="serverMemoryLimit" name="memory_limit" value="${getValue('memory-limit') || '0'}" min="0">
                            </div>
                            <div class="form-row">
                                <label>Максимальное количество соединений на рабочий процесс:</label>
                                <input type="number" id="serverConnectionsLimit" name="connections_limit" value="${getValue('connections-limit') || '0'}" min="0">
                            </div>
                            <div class="form-row">
                                <label>Вариант размещения менеджеров сервисов:</label>
                                <select id="serverDedicateManagers" name="dedicate_managers">
                                    <option value="none" ${getValue('dedicate-managers') === 'none' ? 'selected' : ''}>В одном менеджере</option>
                                    <option value="all" ${getValue('dedicate-managers') === 'all' ? 'selected' : ''}>В отдельных менеджерах</option>
                                </select>
                            </div>
                            <div class="form-row">
                                <label>Максимальный объем памяти рабочих процессов (байты):</label>
                                <input type="number" id="serverSafeWorkingProcessesMemoryLimit" name="safe_working_processes_memory_limit" value="${getValue('safe-working-processes-memory-limit') || '0'}" min="0">
                            </div>
                            <div class="form-row">
                                <label>Безопасный расход памяти за один вызов (байты):</label>
                                <input type="number" id="serverSafeCallMemoryLimit" name="safe_call_memory_limit" value="${getValue('safe-call-memory-limit') || '0'}" min="0">
                            </div>
                            <div class="form-row">
                                <label>Максимальный объем памяти процессов (байты):</label>
                                <input type="number" id="serverCriticalTotalMemory" name="critical_total_memory" value="${getValue('critical-total-memory') || '0'}" min="0">
                            </div>
                            <div class="form-row">
                                <label>Допустимый объем памяти процессов (байты):</label>
                                <input type="number" id="serverTemporaryAllowedTotalMemory" name="temporary_allowed_total_memory" value="${getValue('temporary-allowed-total-memory') || '0'}" min="0">
                            </div>
                            <div class="form-row">
                                <label>Предел превышения допустимого объема памяти (секунды):</label>
                                <input type="number" id="serverTemporaryAllowedTotalMemoryTimeLimit" name="temporary_allowed_total_memory_time_limit" value="${getValue('temporary-allowed-total-memory-time-limit') || '0'}" min="0">
                            </div>
                            <div class="form-row">
                                <label>Номер порта главного менеджера кластера:</label>
                                <input type="number" id="serverClusterPort" name="cluster_port" value="${getValue('cluster-port') || '1541'}" min="1" max="65535">
                            </div>
                            <div class="form-row">
                                <label>Имя службы (SPN):</label>
                                <input type="text" id="serverServicePrincipalName" name="service_principal_name" value="${escapeHtml(getValue('service-principal-name') || '')}">
                            </div>
                            <div class="form-row">
                                <label>Расписание перезапуска:</label>
                                <input type="text" id="serverRestartSchedule" name="restart_schedule" value="${escapeHtml(getValue('restart-schedule') || '')}">
                            </div>
                        </div>
                        <div class="form-actions" style="margin-top: 1.5rem;">
                            <button type="button" class="btn btn-secondary" onclick="closeServerPropertiesModal()">Отмена</button>
                            <button type="button" class="btn btn-primary" onclick="saveServerProperties('${connectionId}', '${clusterUuid}', '${serverUuid}')">Сохранить</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    } catch (error) {
        showNotification('❌ Ошибка загрузки свойств рабочего сервера: ' + error.message, true);
    }
}

/**
 * Сохраняет свойства рабочего сервера
 */
async function saveServerProperties(connectionId, clusterUuid, serverUuid) {
    const form = document.getElementById('serverPropertiesForm');
    if (!form) return;
    
    const formData = new FormData(form);
    const data = {};
    
    // Собираем данные формы
    for (let [key, value] of formData.entries()) {
        if (value) {
            data[key] = value;
        }
    }
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден', true);
            return;
        }
        
        const response = await fetch(`/api/clusters/servers/${connectionId}/${clusterUuid}/${serverUuid}/update/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Параметры рабочего сервера успешно обновлены', false);
            closeServerPropertiesModal();
            // Обновляем дерево
            const clusterId = `cluster-${connectionId}-${clusterUuid}`;
            const sectionId = `servers-${clusterId}`;
            await loadServersIntoTree(connectionId, clusterUuid, sectionId);
        } else {
            showNotification('❌ Ошибка обновления рабочего сервера: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка сохранения: ' + error.message, true);
    }
}

/**
 * Закрывает модальное окно свойств рабочего сервера
 */
function closeServerPropertiesModal() {
    const modal = document.getElementById('serverPropertiesModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Удаляет рабочий сервер
 */
async function deleteServer(connectionId, clusterUuid, serverUuid, serverName) {
    closeContextMenu();
    
    if (!confirm(`Вы уверены, что хотите удалить рабочий сервер "${serverName}"?`)) {
        return;
    }
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден', true);
            return;
        }
        
        const response = await fetch(`/api/clusters/servers/${connectionId}/${clusterUuid}/${serverUuid}/remove/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Рабочий сервер успешно удалён', false);
            // Перезагружаем список рабочих серверов
            await loadServers(connectionId, clusterUuid);
        } else {
            showNotification('❌ Ошибка удаления: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка удаления: ' + error.message, true);
    }
}

// ============================================
// Функции для работы с процессами
// ============================================

/**
 * Открывает модальное окно процессов на весь экран
 */
async function openProcessesModal(connectionId, clusterUuid, serverUuid = null) {
    closeContextMenu();
    
    // Удаляем предыдущее модальное окно если есть
    const existingModal = document.getElementById('processesModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'processesModal';
    modal.style.zIndex = '10001';
    modal.innerHTML = `
        <div class="modal" style="max-width: 95vw; max-height: 95vh; width: 95vw; height: 95vh; display: flex; flex-direction: column;">
            <div class="modal-header" style="flex-shrink: 0;">
                <h3>🔄 Рабочие процессы${serverUuid ? ' (фильтр по серверу)' : ''}</h3>
                <button class="modal-close-btn" onclick="closeProcessesModal()">×</button>
            </div>
            <div class="modal-body" style="flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 1rem;">
                <div style="margin-bottom: 1rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <input type="text" id="processesSearch" placeholder="🔍 Поиск..." style="flex: 1; min-width: 200px; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    <button class="btn btn-secondary" onclick="toggleProcessesColumnFilter()" title="Фильтр столбцов">🔍 Фильтр</button>
                    <button class="btn btn-secondary" onclick="exportProcessesToExcel()" title="Выгрузить в Excel">📥 Excel</button>
                    <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                        <input type="checkbox" id="processesIncludeLicenses">
                        <span>Показать лицензии</span>
                    </label>
                    <button class="btn btn-secondary" onclick="refreshProcessesTable(${connectionId}, '${clusterUuid}', ${serverUuid ? `'${serverUuid}'` : 'null'})">🔄 Обновить</button>
                </div>
                <div id="processesColumnFilter" style="display: none; margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 6px; max-height: 200px; overflow-y: auto;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">Выберите столбцы для отображения:</div>
                    <div id="processesColumnFilterList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.5rem;"></div>
                </div>
                <div id="processesTableContainer" style="flex: 1; overflow: auto;">
                    <div style="text-align: center; padding: 2rem;">
                        <p>⏳ Загрузка процессов...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Сохраняем параметры для обновления
    window._currentProcessesConnectionId = connectionId;
    window._currentProcessesClusterUuid = clusterUuid;
    window._currentProcessesServerUuid = serverUuid;
    window._selectedProcesses = new Set();
    
    // Загружаем процессы
    await loadProcessesTable(connectionId, clusterUuid, serverUuid);
    
    // Добавляем обработчик поиска
    const searchInput = document.getElementById('processesSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterProcessesTable();
        });
    }
    
    // Добавляем обработчик переключения лицензий
    const licensesCheckbox = document.getElementById('processesIncludeLicenses');
    if (licensesCheckbox) {
        licensesCheckbox.addEventListener('change', () => {
            loadProcessesTable(connectionId, clusterUuid, serverUuid);
        });
    }
}

/**
 * Закрывает модальное окно процессов
 */
function closeProcessesModal() {
    const modal = document.getElementById('processesModal');
    if (modal) {
        modal.remove();
    }
    
    // Очищаем глобальные переменные
    if (window._currentProcessesConnectionId) {
        delete window._currentProcessesConnectionId;
    }
    if (window._currentProcessesClusterUuid) {
        delete window._currentProcessesClusterUuid;
    }
    if (window._currentProcessesServerUuid) {
        delete window._currentProcessesServerUuid;
    }
    if (window._selectedProcesses) {
        delete window._selectedProcesses;
    }
    if (window._processesData) {
        delete window._processesData;
    }
    if (window._processesSort) {
        delete window._processesSort;
    }
}

/**
 * Загружает таблицу процессов
 */
async function loadProcessesTable(connectionId, clusterUuid, serverUuid = null) {
    const container = document.getElementById('processesTableContainer');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 2rem;"><p>⏳ Загрузка процессов...</p></div>';
    
    try {
        const includeLicenses = document.getElementById('processesIncludeLicenses')?.checked || false;
        let url = `/api/clusters/processes/${connectionId}/?cluster=${clusterUuid}`;
        if (serverUuid) {
            url += `&server=${serverUuid}`;
        }
        if (includeLicenses) {
            url += `&licenses=true`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            const processes = data.processes || [];
            
            if (processes.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: #666;">
                        <p>Процессов нет</p>
                    </div>
                `;
            } else {
                renderProcessesTable(processes, connectionId, clusterUuid);
            }
        } else {
            container.innerHTML = `
                <div class="info-card" style="border-left: 4px solid var(--primary-color);">
                    <h4 style="color: var(--primary-color);">❌ Ошибка</h4>
                    <p style="color: #721c24; margin: 0;">${data.error || 'Неизвестная ошибка'}</p>
                </div>
            `;
        }
    } catch (error) {
        container.innerHTML = `
            <div class="info-card" style="border-left: 4px solid var(--primary-color);">
                <h4 style="color: var(--primary-color);">❌ Ошибка</h4>
                <p style="color: #721c24; margin: 0;">Ошибка загрузки: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Обновляет таблицу процессов
 */
async function refreshProcessesTable(connectionId, clusterUuid, serverUuid) {
    await loadProcessesTable(connectionId, clusterUuid, serverUuid);
}

/**
 * Отрисовывает таблицу процессов
 */
function renderProcessesTable(processes, connectionId, clusterUuid) {
    const container = document.getElementById('processesTableContainer');
    if (!container) return;
    
    // Сохраняем выбранные процессы
    const selectedProcesses = window._selectedProcesses || new Set();
    
    // Собираем все уникальные ключи из всех процессов для заголовков
    const allKeys = new Set();
    processes.forEach(process => {
        Object.keys(process.data || {}).forEach(key => allKeys.add(key));
    });
    
    // Добавляем UUID процесса в список ключей для управления через фильтр
    allKeys.add('process');
    const sortedKeys = Array.from(allKeys).sort();
    
    // Получаем сохраненное состояние видимости столбцов
    // По умолчанию UUID выключен, остальные включены
    if (!window._processesVisibleColumns) {
        window._processesVisibleColumns = new Set(sortedKeys.filter(k => k !== 'process'));
    }
    const visibleColumns = window._processesVisibleColumns;
    
    // Проверяем, есть ли видимые столбцы
    const hasVisibleColumns = visibleColumns.size > 0;
    
    // Получаем сохраненный порядок столбцов
    const columnOrderKey = `processes_column_order_${connectionId}_${clusterUuid}`;
    let columnOrder = JSON.parse(localStorage.getItem(columnOrderKey) || 'null');
    if (!columnOrder || !Array.isArray(columnOrder)) {
        columnOrder = sortedKeys.filter(k => visibleColumns.has(k));
    } else {
        // Фильтруем порядок, оставляя только видимые столбцы
        columnOrder = columnOrder.filter(k => visibleColumns.has(k));
        // Добавляем новые столбцы в конец
        sortedKeys.forEach(k => {
            if (visibleColumns.has(k) && !columnOrder.includes(k)) {
                columnOrder.push(k);
            }
        });
    }
    
    let html = '';
    
    if (!hasVisibleColumns) {
        html = `
            <div style="text-align: center; padding: 2rem; background: #f8f9fa; border-radius: 6px;">
                <p style="color: #6c757d; margin: 0;">Нет данных для отображения</p>
            </div>
        `;
    } else {
        html = `
            <table id="processesTable" style="width: 100%; border-collapse: collapse; background: white; table-layout: auto;">
                <thead>
                    <tr style="background: #f8f9fa; position: sticky; top: 0; z-index: 10;">
        `;
        
        // Добавляем заголовки в сохраненном порядке
        columnOrder.forEach((key, index) => {
            if (visibleColumns.has(key)) {
                html += `<th class="resizable-column draggable-column" draggable="true" data-column="${key}" data-index="${index}" style="padding: 0.5rem; text-align: left; border: 1px solid #ddd; min-width: 120px; position: relative; vertical-align: top; cursor: move;">
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <div style="text-align: center; font-size: 0.85rem; cursor: pointer;" onclick="sortProcessesTable('${key}')" title="Сортировать">↕️</div>
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                            <input type="text" class="column-search-input" placeholder="🔍" style="flex: 1; padding: 0.25rem; font-size: 0.75rem; border: 1px solid #ccc; border-radius: 3px;" onkeyup="filterProcessesColumn('${key}', this.value)" data-column="${key}">
                        </div>
                        <div style="font-weight: 600; word-wrap: break-word; white-space: normal;">${escapeHtml(key === 'process' ? 'UUID процесса' : key)}</div>
                    </div>
                    <div class="resize-handle" style="position: absolute; right: 0; top: 0; bottom: 0; width: 5px; cursor: col-resize; background: transparent; z-index: 1;"></div>
                </th>`;
            }
        });
        
        html += `
                    </tr>
                </thead>
                <tbody>
        `;
        
        processes.forEach((process, index) => {
            html += `
                <tr class="process-row" data-process-uuid="${process.uuid}" data-index="${index}" style="cursor: pointer;">
            `;
            
            // Используем сохраненный порядок столбцов
            columnOrder.forEach(key => {
                if (visibleColumns.has(key)) {
                    let value = '';
                    if (key === 'process') {
                        value = process.uuid;
                    } else {
                        value = process.data[key] || '';
                    }
                    
                    // Добавляем tooltip для длинных значений
                    const titleAttr = value ? `title="${escapeHtml(value)}"` : '';
                    
                    html += `<td style="padding: 0.5rem; border: 1px solid #ddd; word-wrap: break-word; white-space: normal; max-width: 300px; font-size: 0.9rem;" ${titleAttr} data-column="${key}">${escapeHtml(value)}</td>`;
                }
            });
            
            html += `</tr>`;
        });
        
        html += `
                </tbody>
            </table>
        `;
    }
    
    container.innerHTML = html;
    
    if (hasVisibleColumns) {
        // Добавляем обработчики кликов на строки
        container.querySelectorAll('.process-row').forEach(row => {
            row.addEventListener('click', (e) => {
                // Если клик по resize handle или по полю поиска - не открываем модальное окно
                if (e.target.classList.contains('resize-handle') || e.target.closest('.resize-handle') || 
                    e.target.classList.contains('column-search-input') || e.target.closest('.column-search-input')) {
                    return;
                }
                // Иначе открываем модальное окно с детальной информацией
                const uuid = row.getAttribute('data-process-uuid');
                openProcessInfoModal(connectionId, clusterUuid, uuid);
            });
        });
        
        // Добавляем обработчики для изменения размера столбцов
        initColumnResize('#processesTable');
        
        // Добавляем обработчики drag and drop для перестановки столбцов
        initColumnDragDrop('#processesTable', columnOrderKey);
    }
    
    // Сохраняем данные для фильтрации и сортировки
    window._processesData = processes;
    window._selectedProcesses = selectedProcesses;
    window._processesColumnOrder = columnOrder;
}

/**
 * Фильтрует таблицу процессов по поисковому запросу
 */
function filterProcessesTable() {
    const searchInput = document.getElementById('processesSearch');
    const searchTerm = (searchInput?.value || '').toLowerCase();
    const rows = document.querySelectorAll('.process-row');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

/**
 * Сортирует таблицу процессов
 */
function sortProcessesTable(columnKey) {
    const processes = window._processesData || [];
    const currentSort = window._processesSort || { column: null, direction: 'asc' };
    
    let direction = 'asc';
    if (currentSort.column === columnKey && currentSort.direction === 'asc') {
        direction = 'desc';
    }
    
    processes.sort((a, b) => {
        let aVal = '';
        let bVal = '';
        
        if (columnKey === 'process') {
            aVal = a.uuid || '';
            bVal = b.uuid || '';
        } else {
            aVal = a.data[columnKey] || '';
            bVal = b.data[columnKey] || '';
        }
        
        if (direction === 'asc') {
            return aVal.localeCompare(bVal);
        } else {
            return bVal.localeCompare(aVal);
        }
    });
    
    window._processesSort = { column: columnKey, direction };
    
    // Перерисовываем таблицу
    const connectionId = window._currentProcessesConnectionId;
    const clusterUuid = window._currentProcessesClusterUuid;
    
    if (connectionId && clusterUuid) {
        renderProcessesTable(processes, connectionId, clusterUuid);
        filterProcessesTable(); // Применяем фильтр если есть
    }
}

/**
 * Переключает отображение фильтра столбцов для процессов
 */
function toggleProcessesColumnFilter() {
    const filterDiv = document.getElementById('processesColumnFilter');
    if (filterDiv) {
        filterDiv.style.display = filterDiv.style.display === 'none' ? 'block' : 'none';
        
        // Если открываем фильтр, заполняем список столбцов
        if (filterDiv.style.display === 'block') {
            updateProcessesColumnFilterList();
        }
    }
}

/**
 * Обновляет список столбцов в фильтре процессов
 */
function updateProcessesColumnFilterList() {
    const filterList = document.getElementById('processesColumnFilterList');
    if (!filterList) return;
    
    const processes = window._processesData || [];
    if (processes.length === 0) return;
    
    // Собираем все уникальные ключи (включая UUID процесса)
    const allKeys = new Set();
    processes.forEach(process => {
        Object.keys(process.data || {}).forEach(key => allKeys.add(key));
    });
    allKeys.add('process');
    
    const sortedKeys = Array.from(allKeys).sort();
    
    // Получаем сохраненное состояние видимости столбцов
    // По умолчанию UUID выключен, остальные включены
    if (!window._processesVisibleColumns) {
        window._processesVisibleColumns = new Set(sortedKeys.filter(k => k !== 'process'));
    }
    const visibleColumns = window._processesVisibleColumns;
    
    // Проверяем, все ли столбцы выбраны
    const allSelected = sortedKeys.length > 0 && sortedKeys.every(key => visibleColumns.has(key));
    
    let html = `
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 600; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid #ddd;">
            <input type="checkbox" id="selectAllProcessesColumns" ${allSelected ? 'checked' : ''} onchange="toggleAllProcessesColumns(this.checked)">
            <span>Выбрать все</span>
        </label>
    `;
    
    sortedKeys.forEach(key => {
        const isVisible = visibleColumns.has(key);
        const displayName = key === 'process' ? 'UUID процесса' : key;
        html += `
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" class="process-column-checkbox" data-column="${key}" ${isVisible ? 'checked' : ''} onchange="toggleProcessesColumn('${key}', this.checked)">
                <span>${escapeHtml(displayName)}</span>
            </label>
        `;
    });
    
    filterList.innerHTML = html;
}

/**
 * Переключает выбор всех столбцов процессов
 */
function toggleAllProcessesColumns(selectAll) {
    const processes = window._processesData || [];
    if (processes.length === 0) return;
    
    // Собираем все уникальные ключи (включая UUID процесса)
    const allKeys = new Set();
    processes.forEach(process => {
        Object.keys(process.data || {}).forEach(key => allKeys.add(key));
    });
    allKeys.add('process');
    
    const sortedKeys = Array.from(allKeys).sort();
    
    if (!window._processesVisibleColumns) {
        window._processesVisibleColumns = new Set();
    }
    
    if (selectAll) {
        // Добавляем все столбцы
        sortedKeys.forEach(key => window._processesVisibleColumns.add(key));
    } else {
        // Удаляем все столбцы
        sortedKeys.forEach(key => window._processesVisibleColumns.delete(key));
    }
    
    // Обновляем чекбоксы в фильтре
    document.querySelectorAll('.process-column-checkbox').forEach(checkbox => {
        checkbox.checked = selectAll;
    });
    
    // Перерисовываем таблицу
    const connectionId = window._currentProcessesConnectionId;
    const clusterUuid = window._currentProcessesClusterUuid;
    
    if (connectionId && clusterUuid) {
        const processes = window._processesData || [];
        renderProcessesTable(processes, connectionId, clusterUuid);
        filterProcessesTable(); // Применяем фильтр если есть
    }
}

/**
 * Фильтрует столбец процессов по значению поиска
 */
function filterProcessesColumn(columnKey, searchValue) {
    const table = document.getElementById('processesTable');
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    const searchLower = searchValue.toLowerCase();
    
    rows.forEach(row => {
        const cell = row.querySelector(`td[data-column="${columnKey}"]`);
        if (cell) {
            const cellText = cell.textContent.toLowerCase();
            if (searchValue === '' || cellText.includes(searchLower)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    });
}

/**
 * Переключает видимость столбца процессов
 */
function toggleProcessesColumn(columnKey, isVisible) {
    if (!window._processesVisibleColumns) {
        window._processesVisibleColumns = new Set();
    }
    
    if (isVisible) {
        window._processesVisibleColumns.add(columnKey);
    } else {
        window._processesVisibleColumns.delete(columnKey);
    }
    
    // Перерисовываем таблицу
    const connectionId = window._currentProcessesConnectionId;
    const clusterUuid = window._currentProcessesClusterUuid;
    
    if (connectionId && clusterUuid) {
        const processes = window._processesData || [];
        renderProcessesTable(processes, connectionId, clusterUuid);
        filterProcessesTable(); // Применяем фильтр если есть
    }
}

/**
 * Открывает модальное окно с детальной информацией о процессе
 */
async function openProcessInfoModal(connectionId, clusterUuid, processUuid) {
    closeContextMenu();
    
    // Удаляем предыдущее модальное окно если есть
    const existingModal = document.getElementById('processInfoModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'processInfoModal';
    modal.style.zIndex = '10002';
    modal.innerHTML = `
        <div class="modal" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3>🔄 Информация о процессе</h3>
                <button class="modal-close-btn" onclick="closeProcessInfoModal()">×</button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 2rem;">
                    <p>⏳ Загрузка информации...</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    try {
        const response = await fetch(`/api/clusters/processes/${connectionId}/${clusterUuid}/info/?process=${processUuid}`);
        const data = await response.json();
        
        if (data.success) {
            const process = data.process || {};
            const processData = process.data || {};
            
            let infoHtml = `
                <div class="info-card">
                    <h4>📊 Основная информация</h4>
                    <div class="form-row">
                        <label>UUID процесса:</label>
                        <input type="text" class="readonly-field" value="${escapeHtml(process.uuid || processUuid)}" readonly>
                    </div>
            `;
            
            // Сортируем ключи для красивого отображения
            const sortedKeys = Object.keys(processData).sort();
            
            sortedKeys.forEach(key => {
                const value = processData[key] || '';
                infoHtml += `
                    <div class="form-row">
                        <label>${escapeHtml(key)}:</label>
                        <input type="text" class="readonly-field" value="${escapeHtml(value)}" readonly>
                    </div>
                `;
            });
            
            infoHtml += `</div>`;
            
            modal.querySelector('.modal-body').innerHTML = infoHtml;
        } else {
            modal.querySelector('.modal-body').innerHTML = `
                <div class="info-card" style="border-left: 4px solid var(--primary-color);">
                    <h4 style="color: var(--primary-color);">❌ Ошибка</h4>
                    <p style="color: #721c24; margin: 0;">${data.error || 'Неизвестная ошибка'}</p>
                </div>
            `;
        }
    } catch (error) {
        modal.querySelector('.modal-body').innerHTML = `
            <div class="info-card" style="border-left: 4px solid var(--primary-color);">
                <h4 style="color: var(--primary-color);">❌ Ошибка</h4>
                <p style="color: #721c24; margin: 0;">Ошибка загрузки: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Закрывает модальное окно информации о процессе
 */
function closeProcessInfoModal() {
    const modal = document.getElementById('processInfoModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Выгружает таблицу процессов в Excel
 */
function exportProcessesToExcel() {
    const processes = window._processesData || [];
    if (processes.length === 0) {
        showNotification('❌ Нет данных для выгрузки', true);
        return;
    }
    
    const visibleColumns = window._processesVisibleColumns || new Set();
    const allKeys = new Set();
    processes.forEach(process => {
        Object.keys(process.data || {}).forEach(key => allKeys.add(key));
    });
    allKeys.add('process');
    const sortedKeys = Array.from(allKeys).sort().filter(key => visibleColumns.has(key));
    
    // Создаем CSV данные
    let csv = '\uFEFF'; // BOM для правильной кодировки UTF-8 в Excel
    
    // Заголовки (включаем UUID если он видим)
    const headers = [];
    if (visibleColumns.has('process')) {
        headers.push('UUID процесса');
    }
    sortedKeys.forEach(key => {
        if (key !== 'process' && visibleColumns.has(key)) {
            headers.push(key);
        }
    });
    
    // Используем точку с запятой как разделитель для лучшей совместимости с Excel
    const separator = ';';
    
    csv += headers.map(h => h.replace(/"/g, '""')).join(separator) + '\n';
    
    // Данные
    processes.forEach(process => {
        const row = [];
        if (visibleColumns.has('process')) {
            row.push(String(process.uuid || ''));
        }
        sortedKeys.forEach(key => {
            if (key !== 'process' && visibleColumns.has(key)) {
                const value = process.data[key] || '';
                // Заменяем переносы строк на пробелы
                const cleanValue = String(value).replace(/\n/g, ' ').replace(/\r/g, '');
                row.push(cleanValue);
            }
        });
        csv += row.map(cell => {
            // Если ячейка содержит разделитель, кавычки или перенос строки - оборачиваем в кавычки
            if (cell.includes(separator) || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
                return `"${String(cell).replace(/"/g, '""')}"`;
            }
            return cell;
        }).join(separator) + '\n';
    });
    
    // Создаем blob и скачиваем (CSV формат для Excel)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `processes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('✅ Таблица выгружена в Excel', false);
}

/**
 * Открывает модальное окно с менеджерами кластера
 */
async function openManagersModal(connectionId, clusterUuid) {
    closeContextMenu();
    
    // Удаляем предыдущее модальное окно если есть
    const existingModal = document.getElementById('managersModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Сохраняем глобальные переменные
    window._currentManagersConnectionId = connectionId;
    window._currentManagersClusterUuid = clusterUuid;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay modal-full-screen';
    modal.id = 'managersModal';
    modal.style.zIndex = '10002';
    modal.innerHTML = `
        <div class="modal" style="width: 95vw; height: 95vh; max-width: none; max-height: none; display: flex; flex-direction: column;">
            <div class="modal-header" style="flex-shrink: 0;">
                <h3>🏢 Менеджеры кластера</h3>
                <button class="modal-close-btn" onclick="closeManagersModal()">×</button>
            </div>
            <div class="modal-body" style="flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 1rem;">
                <div style="margin-bottom: 1rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <input type="text" id="managersSearch" placeholder="🔍 Поиск..." style="flex: 1; min-width: 200px; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    <button class="btn btn-secondary" onclick="toggleManagersColumnFilter()" title="Фильтр столбцов">🔍 Фильтр</button>
                    <button class="btn btn-secondary" onclick="exportManagersToExcel()" title="Выгрузить в Excel">📥 Excel</button>
                    <button class="btn btn-secondary" onclick="refreshManagersTable(${connectionId}, '${clusterUuid}')">🔄 Обновить</button>
                </div>
                <div id="managersColumnFilter" style="display: none; margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 6px; max-height: 200px; overflow-y: auto;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">Выберите столбцы для отображения:</div>
                    <div id="managersColumnFilterList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.5rem;"></div>
                </div>
                <div id="managersTableContainer" style="flex: 1; overflow: auto;">
                    <div style="text-align: center; padding: 2rem;">
                        <p>⏳ Загрузка данных...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Добавляем обработчик поиска
    const searchInput = document.getElementById('managersSearch');
    if (searchInput) {
        searchInput.addEventListener('input', filterManagersTable);
    }
    
    // Загружаем данные
    await loadManagersTable(connectionId, clusterUuid);
}

/**
 * Закрывает модальное окно менеджеров
 */
function closeManagersModal() {
    const modal = document.getElementById('managersModal');
    if (modal) {
        modal.remove();
    }
    
    // Очищаем глобальные переменные
    window._currentManagersConnectionId = null;
    window._currentManagersClusterUuid = null;
    window._managersData = null;
}

/**
 * Загружает таблицу менеджеров
 */
async function loadManagersTable(connectionId, clusterUuid) {
    const container = document.getElementById('managersTableContainer');
    if (!container) return;
    
    try {
        const response = await fetch(`/api/clusters/managers/${connectionId}/?cluster=${clusterUuid}`);
        const data = await response.json();
        
        if (data.success) {
            const managers = data.managers || [];
            renderManagersTable(managers, connectionId, clusterUuid);
        } else {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <p>❌ Ошибка загрузки: ${data.error || 'Неизвестная ошибка'}</p>
                </div>
            `;
        }
    } catch (error) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <p>❌ Ошибка загрузки: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Обновляет таблицу менеджеров
 */
async function refreshManagersTable(connectionId, clusterUuid) {
    await loadManagersTable(connectionId, clusterUuid);
}

/**
 * Рендерит таблицу менеджеров
 */
function renderManagersTable(managers, connectionId, clusterUuid) {
    const container = document.getElementById('managersTableContainer');
    if (!container) return;
    
    if (managers.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem;">
                <p>Менеджеров не найдено</p>
            </div>
        `;
        return;
    }
    
    // Собираем все уникальные ключи
    const allKeys = new Set();
    managers.forEach(manager => {
        Object.keys(manager.data || {}).forEach(key => allKeys.add(key));
    });
    
    // Добавляем UUID менеджера в список ключей для управления через фильтр
    allKeys.add('manager');
    const sortedKeys = Array.from(allKeys).sort();
    
    // Получаем сохраненное состояние видимости столбцов
    // По умолчанию UUID выключен, остальные включены
    if (!window._managersVisibleColumns) {
        window._managersVisibleColumns = new Set(sortedKeys.filter(k => k !== 'manager'));
    }
    const visibleColumns = window._managersVisibleColumns;
    
    // Проверяем, есть ли видимые столбцы
    const hasVisibleColumns = visibleColumns.size > 0;
    
    // Получаем сохраненный порядок столбцов
    const columnOrderKey = `managers_column_order_${connectionId}_${clusterUuid}`;
    let columnOrder = JSON.parse(localStorage.getItem(columnOrderKey) || 'null');
    if (!columnOrder || !Array.isArray(columnOrder)) {
        columnOrder = sortedKeys.filter(k => visibleColumns.has(k));
    } else {
        // Фильтруем порядок, оставляя только видимые столбцы
        columnOrder = columnOrder.filter(k => visibleColumns.has(k));
        // Добавляем новые столбцы в конец
        sortedKeys.forEach(k => {
            if (visibleColumns.has(k) && !columnOrder.includes(k)) {
                columnOrder.push(k);
            }
        });
    }
    
    let html = '';
    
    if (!hasVisibleColumns) {
        html = `
            <div style="text-align: center; padding: 2rem; background: #f8f9fa; border-radius: 6px;">
                <p style="color: #6c757d; margin: 0;">Нет данных для отображения</p>
            </div>
        `;
    } else {
        html = `
            <table id="managersTable" style="width: 100%; border-collapse: collapse; background: white; table-layout: auto;">
                <thead>
                    <tr style="background: #f8f9fa; position: sticky; top: 0; z-index: 10;">
        `;
        
        // Добавляем заголовки в сохраненном порядке
        columnOrder.forEach((key, index) => {
            if (visibleColumns.has(key)) {
                html += `<th class="resizable-column draggable-column" draggable="true" data-column="${key}" data-index="${index}" style="padding: 0.5rem; text-align: left; border: 1px solid #ddd; min-width: 120px; position: relative; vertical-align: top; cursor: move;">
                    <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                        <div style="text-align: center; font-size: 0.85rem; cursor: pointer;" onclick="sortManagersTable('${key}')" title="Сортировать">↕️</div>
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                            <input type="text" class="column-search-input" placeholder="🔍" style="flex: 1; padding: 0.25rem; font-size: 0.75rem; border: 1px solid #ccc; border-radius: 3px;" onkeyup="filterManagersColumn('${key}', this.value)" data-column="${key}">
                        </div>
                        <div style="font-weight: 600; word-wrap: break-word; white-space: normal;">${escapeHtml(key === 'manager' ? 'UUID менеджера' : key)}</div>
                    </div>
                    <div class="resize-handle" style="position: absolute; right: 0; top: 0; bottom: 0; width: 5px; cursor: col-resize; background: transparent; z-index: 1;"></div>
                </th>`;
            }
        });
    
        html += `
                    </tr>
                </thead>
                <tbody>
        `;
        
        managers.forEach((manager, index) => {
            html += `
                <tr class="manager-row" data-manager-uuid="${manager.uuid}" data-index="${index}" style="cursor: pointer;">
            `;
            
            // Используем сохраненный порядок столбцов
            columnOrder.forEach(key => {
                if (visibleColumns.has(key)) {
                    let value = '';
                    if (key === 'manager') {
                        value = manager.uuid;
                    } else {
                        value = manager.data[key] || '';
                    }
                    
                    // Добавляем tooltip для длинных значений
                    const titleAttr = value ? `title="${escapeHtml(value)}"` : '';
                    
                    html += `<td style="padding: 0.5rem; border: 1px solid #ddd; word-wrap: break-word; white-space: normal; max-width: 300px; font-size: 0.9rem;" ${titleAttr} data-column="${key}">${escapeHtml(value)}</td>`;
                }
            });
            
            html += `</tr>`;
        });
        
        html += `
                </tbody>
            </table>
        `;
    }
    
    container.innerHTML = html;
    
    if (hasVisibleColumns) {
        // Добавляем обработчики кликов на строки
        container.querySelectorAll('.manager-row').forEach(row => {
            row.addEventListener('click', (e) => {
                // Если клик по resize handle или по полю поиска - не открываем модальное окно
                if (e.target.classList.contains('resize-handle') || e.target.closest('.resize-handle') || 
                    e.target.classList.contains('column-search-input') || e.target.closest('.column-search-input')) {
                    return;
                }
                // Иначе открываем модальное окно с детальной информацией
                const uuid = row.getAttribute('data-manager-uuid');
                openManagerInfoModal(connectionId, clusterUuid, uuid);
            });
        });
        
        // Добавляем обработчики для изменения размера столбцов
        initColumnResize('#managersTable');
        
        // Добавляем обработчики drag and drop для перестановки столбцов
        initColumnDragDrop('#managersTable', columnOrderKey);
    }
    
    // Сохраняем данные для фильтрации и сортировки
    window._managersData = managers;
    window._managersColumnOrder = columnOrder;
}

/**
 * Фильтрует столбец менеджеров по значению поиска
 */
function filterManagersColumn(columnKey, searchValue) {
    const table = document.getElementById('managersTable');
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    const searchLower = searchValue.toLowerCase();
    
    rows.forEach(row => {
        const cell = row.querySelector(`td[data-column="${columnKey}"]`);
        if (cell) {
            const cellText = cell.textContent.toLowerCase();
            if (searchValue === '' || cellText.includes(searchLower)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    });
}

/**
 * Сортирует таблицу менеджеров
 */
function sortManagersTable(columnKey) {
    const managers = window._managersData || [];
    const currentSort = window._managersSort || { column: null, direction: 'asc' };
    
    let direction = 'asc';
    if (currentSort.column === columnKey && currentSort.direction === 'asc') {
        direction = 'desc';
    }
    
    managers.sort((a, b) => {
        let aVal = '';
        let bVal = '';
        
        if (columnKey === 'manager') {
            aVal = a.uuid || '';
            bVal = b.uuid || '';
        } else {
            aVal = a.data[columnKey] || '';
            bVal = b.data[columnKey] || '';
        }
        
        if (direction === 'asc') {
            return aVal.localeCompare(bVal);
        } else {
            return bVal.localeCompare(aVal);
        }
    });
    
    window._managersSort = { column: columnKey, direction };
    
    // Перерисовываем таблицу
    const connectionId = window._currentManagersConnectionId;
    const clusterUuid = window._currentManagersClusterUuid;
    
    if (connectionId && clusterUuid) {
        renderManagersTable(managers, connectionId, clusterUuid);
        filterManagersTable(); // Применяем фильтр если есть
    }
}

/**
 * Фильтрует таблицу менеджеров
 */
function filterManagersTable() {
    const searchInput = document.getElementById('managersSearch');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    const table = document.getElementById('managersTable');
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

/**
 * Переключает фильтр столбцов менеджеров
 */
function toggleManagersColumnFilter() {
    const filterDiv = document.getElementById('managersColumnFilter');
    if (!filterDiv) return;
    
    const isVisible = filterDiv.style.display !== 'none';
    filterDiv.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
        updateManagersColumnFilterList();
    }
}

/**
 * Обновляет список столбцов в фильтре менеджеров
 */
function updateManagersColumnFilterList() {
    const filterList = document.getElementById('managersColumnFilterList');
    if (!filterList) return;
    
    const managers = window._managersData || [];
    if (managers.length === 0) return;
    
    // Собираем все уникальные ключи (включая UUID менеджера)
    const allKeys = new Set();
    managers.forEach(manager => {
        Object.keys(manager.data || {}).forEach(key => allKeys.add(key));
    });
    allKeys.add('manager');
    
    const sortedKeys = Array.from(allKeys).sort();
    
    // Получаем сохраненное состояние видимости столбцов
    // По умолчанию UUID выключен, остальные включены
    if (!window._managersVisibleColumns) {
        window._managersVisibleColumns = new Set(sortedKeys.filter(k => k !== 'manager'));
    }
    const visibleColumns = window._managersVisibleColumns;
    
    // Проверяем, все ли столбцы выбраны
    const allSelected = sortedKeys.length > 0 && sortedKeys.every(key => visibleColumns.has(key));
    
    let html = `
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 600; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid #ddd;">
            <input type="checkbox" id="selectAllManagersColumns" ${allSelected ? 'checked' : ''} onchange="toggleAllManagersColumns(this.checked)">
            <span>Выбрать все</span>
        </label>
    `;
    
    sortedKeys.forEach(key => {
        const isVisible = visibleColumns.has(key);
        const displayName = key === 'manager' ? 'UUID менеджера' : key;
        html += `
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" class="manager-column-checkbox" data-column="${key}" ${isVisible ? 'checked' : ''} onchange="toggleManagersColumn('${key}', this.checked)">
                <span>${escapeHtml(displayName)}</span>
            </label>
        `;
    });
    
    filterList.innerHTML = html;
}

/**
 * Переключает выбор всех столбцов менеджеров
 */
function toggleAllManagersColumns(selectAll) {
    const managers = window._managersData || [];
    if (managers.length === 0) return;
    
    // Собираем все уникальные ключи (включая UUID менеджера)
    const allKeys = new Set();
    managers.forEach(manager => {
        Object.keys(manager.data || {}).forEach(key => allKeys.add(key));
    });
    allKeys.add('manager');
    
    const sortedKeys = Array.from(allKeys).sort();
    
    if (!window._managersVisibleColumns) {
        window._managersVisibleColumns = new Set();
    }
    
    if (selectAll) {
        // Добавляем все столбцы
        sortedKeys.forEach(key => window._managersVisibleColumns.add(key));
    } else {
        // Удаляем все столбцы
        sortedKeys.forEach(key => window._managersVisibleColumns.delete(key));
    }
    
    // Обновляем чекбоксы в фильтре
    document.querySelectorAll('.manager-column-checkbox').forEach(checkbox => {
        checkbox.checked = selectAll;
    });
    
    // Перерисовываем таблицу
    const connectionId = window._currentManagersConnectionId;
    const clusterUuid = window._currentManagersClusterUuid;
    
    if (connectionId && clusterUuid) {
        const managers = window._managersData || [];
        renderManagersTable(managers, connectionId, clusterUuid);
        filterManagersTable(); // Применяем фильтр если есть
    }
}

/**
 * Переключает видимость столбца менеджеров
 */
function toggleManagersColumn(columnKey, isVisible) {
    if (!window._managersVisibleColumns) {
        window._managersVisibleColumns = new Set();
    }
    
    if (isVisible) {
        window._managersVisibleColumns.add(columnKey);
    } else {
        window._managersVisibleColumns.delete(columnKey);
    }
    
    // Перерисовываем таблицу
    const connectionId = window._currentManagersConnectionId;
    const clusterUuid = window._currentManagersClusterUuid;
    
    if (connectionId && clusterUuid) {
        const managers = window._managersData || [];
        renderManagersTable(managers, connectionId, clusterUuid);
        filterManagersTable(); // Применяем фильтр если есть
    }
}

/**
 * Открывает модальное окно с детальной информацией о менеджере
 */
async function openManagerInfoModal(connectionId, clusterUuid, managerUuid) {
    closeContextMenu();
    
    // Удаляем предыдущее модальное окно если есть
    const existingModal = document.getElementById('managerInfoModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'managerInfoModal';
    modal.style.zIndex = '10002';
    modal.innerHTML = `
        <div class="modal" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3>🏢 Информация о менеджере</h3>
                <button class="modal-close-btn" onclick="closeManagerInfoModal()">×</button>
            </div>
            <div class="modal-body">
                <div style="text-align: center; padding: 2rem;">
                    <p>⏳ Загрузка информации...</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    try {
        const response = await fetch(`/api/clusters/managers/${connectionId}/${clusterUuid}/info/?manager=${managerUuid}`);
        const data = await response.json();
        
        if (data.success) {
            const manager = data.manager || {};
            const managerData = manager.data || {};
            
            let infoHtml = `
                <div class="info-card">
                    <h4>📊 Основная информация</h4>
                    <div class="form-row">
                        <label>UUID менеджера:</label>
                        <input type="text" class="readonly-field" value="${escapeHtml(manager.uuid || managerUuid)}" readonly>
                    </div>
            `;
            
            // Сортируем ключи для красивого отображения
            const sortedKeys = Object.keys(managerData).sort();
            
            sortedKeys.forEach(key => {
                const value = managerData[key] || '';
                infoHtml += `
                    <div class="form-row">
                        <label>${escapeHtml(key)}:</label>
                        <input type="text" class="readonly-field" value="${escapeHtml(value)}" readonly>
                    </div>
                `;
            });
            
            infoHtml += `</div>`;
            
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = infoHtml;
            }
        } else {
            const modalBody = modal.querySelector('.modal-body');
            if (modalBody) {
                modalBody.innerHTML = `
                    <div style="text-align: center; padding: 2rem;">
                        <p>❌ Ошибка загрузки: ${data.error || 'Неизвестная ошибка'}</p>
                    </div>
                `;
            }
        }
    } catch (error) {
        const modalBody = modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.innerHTML = `
                <div style="text-align: center; padding: 2rem;">
                    <p>❌ Ошибка загрузки: ${error.message}</p>
                </div>
            `;
        }
    }
}

/**
 * Закрывает модальное окно информации о менеджере
 */
function closeManagerInfoModal() {
    const modal = document.getElementById('managerInfoModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Выгружает таблицу менеджеров в Excel
 */
function exportManagersToExcel() {
    const managers = window._managersData || [];
    if (managers.length === 0) {
        showNotification('❌ Нет данных для выгрузки', true);
        return;
    }
    
    const visibleColumns = window._managersVisibleColumns || new Set();
    const allKeys = new Set();
    managers.forEach(manager => {
        Object.keys(manager.data || {}).forEach(key => allKeys.add(key));
    });
    allKeys.add('manager');
    const sortedKeys = Array.from(allKeys).sort().filter(key => visibleColumns.has(key));
    
    // Создаем CSV данные
    let csv = '\uFEFF'; // BOM для правильной кодировки UTF-8 в Excel
    
    // Заголовки (включаем UUID если он видим)
    const headers = [];
    if (visibleColumns.has('manager')) {
        headers.push('UUID менеджера');
    }
    sortedKeys.forEach(key => {
        if (key !== 'manager' && visibleColumns.has(key)) {
            headers.push(key);
        }
    });
    // Используем точку с запятой как разделитель для лучшей совместимости с Excel
    const separator = ';';
    
    csv += headers.map(h => h.replace(/"/g, '""')).join(separator) + '\n';
    
    // Данные
    managers.forEach(manager => {
        const row = [];
        if (visibleColumns.has('manager')) {
            row.push(String(manager.uuid || ''));
        }
        sortedKeys.forEach(key => {
            if (key !== 'manager' && visibleColumns.has(key)) {
                const value = manager.data[key] || '';
                // Заменяем переносы строк на пробелы
                const cleanValue = String(value).replace(/\n/g, ' ').replace(/\r/g, '');
                row.push(cleanValue);
            }
        });
        csv += row.map(cell => {
            // Если ячейка содержит разделитель, кавычки или перенос строки - оборачиваем в кавычки
            if (cell.includes(separator) || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
                return `"${String(cell).replace(/"/g, '""')}"`;
            }
            return cell;
        }).join(separator) + '\n';
    });
    
    // Создаем blob и скачиваем (CSV формат для Excel)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `managers_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('✅ Таблица выгружена в Excel', false);
}
