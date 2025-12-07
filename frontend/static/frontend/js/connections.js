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
                            <div class="tree-item" data-section="infobases" data-connection-id="${connectionId}" data-cluster-uuid="${clusterUuid}">
                                <span class="tree-icon">📁</span>
                                <span>Информационные базы</span>
                            </div>
                            <div class="tree-item" data-section="servers" data-connection-id="${connectionId}" data-cluster-uuid="${clusterUuid}">
                                <span class="tree-icon">⚙️</span>
                                <span>Рабочие серверы</span>
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
        const treeItem = e.target.closest('.tree-item[data-section]');
        if (treeItem) {
            const section = treeItem.dataset.section;
            const connectionId = treeItem.dataset.connectionId;
            const clusterUuid = treeItem.dataset.clusterUuid;
            
            if (section === 'infobases') {
                e.preventDefault();
                showSectionContextMenu(e, connectionId, clusterUuid, 'infobases');
            } else if (section === 'servers') {
                e.preventDefault();
                showSectionContextMenu(e, connectionId, clusterUuid, 'servers');
            }
        }
    });
    
    // Обработчик клика по подразделам
    document.addEventListener('click', (e) => {
        const treeItem = e.target.closest('.tree-item');
        if (treeItem && treeItem.dataset.section) {
            const section = treeItem.dataset.section;
            const connectionId = treeItem.dataset.connectionId;
            const clusterUuid = treeItem.dataset.clusterUuid;
            loadClusterSection(section, connectionId, clusterUuid);
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
 * Загружает данные для подраздела кластера
 */
async function loadClusterSection(section, connectionId, clusterUuid) {
    const contentArea = document.getElementById('contentArea');
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
            case 'sessions':
                await loadSessions(connectionId, clusterUuid);
                break;
            default:
                contentArea.innerHTML = `
                    <div class="info-card">
                        <h4>Раздел "${section}"</h4>
                        <p>Функционал в разработке</p>
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
 * Загружает сеансы
 */
async function loadSessions(connectionId, clusterUuid) {
    const response = await fetch(`/api/clusters/sessions/${connectionId}/?cluster=${clusterUuid}`);
    const data = await response.json();
    
    const contentArea = document.getElementById('contentArea');
    if (data.success) {
        contentArea.innerHTML = `
            <div class="info-card">
                <h4>💺 Сеансы</h4>
                <pre style="background: #f5f5f5; padding: 1rem; border-radius: 6px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 0.9rem; white-space: pre-wrap;">${data.output || 'Нет данных'}</pre>
            </div>
        `;
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
    
    // TODO: Реализовать модальное окно создания информационной базы
    showNotification('Функция создания информационной базы в разработке', false);
}

/**
 * Открывает модальное окно свойств информационной базы
 */
async function openInfobaseProperties(connectionId, clusterUuid, infobaseUuid) {
    closeContextMenu();
    
    // TODO: Реализовать модальное окно свойств информационной базы
    showNotification('Функция свойств информационной базы в разработке', false);
}

/**
 * Удаляет информационную базу
 */
async function deleteInfobase(connectionId, clusterUuid, infobaseUuid, infobaseName) {
    closeContextMenu();
    
    if (!confirm(`Вы уверены, что хотите удалить информационную базу "${infobaseName}"?`)) {
        return;
    }
    
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
                infobase_uuid: infobaseUuid
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Информационная база успешно удалена', false);
            // Перезагружаем список информационных баз
            await loadInfobases(connectionId, clusterUuid);
        } else {
            showNotification('❌ Ошибка удаления: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка удаления: ' + error.message, true);
    }
}

// ============================================
// Функции для работы с рабочими серверами
// ============================================

/**
 * Открывает модальное окно создания рабочего сервера
 */
function openCreateServerModal(connectionId, clusterUuid) {
    closeContextMenu();
    
    // TODO: Реализовать модальное окно создания рабочего сервера
    showNotification('Функция создания рабочего сервера в разработке', false);
}

/**
 * Открывает модальное окно свойств рабочего сервера
 */
async function openServerProperties(connectionId, clusterUuid, serverUuid) {
    closeContextMenu();
    
    // TODO: Реализовать модальное окно свойств рабочего сервера
    showNotification('Функция свойств рабочего сервера в разработке', false);
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

