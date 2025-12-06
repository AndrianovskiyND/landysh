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
            connectionPart.onclick = () => loadConnectionData(conn.id);
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
async function loadConnectionData(connectionId) {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = '<div style="text-align: center; padding: 2rem;"><p>⏳ Выполнение команды RAC...</p></div>';
    
    try {
        const response = await fetch(`/api/clusters/clusters/${connectionId}/`);
        const data = await response.json();
        
        if (data.success) {
            // Отображаем результат команды
            const output = data.output || '';
            const formattedOutput = formatRACOutput(output);
            
            contentArea.innerHTML = `
                <div class="info-card">
                    <h4>📊 Результат выполнения команды: cluster list</h4>
                    <pre style="background: #f5f5f5; padding: 1rem; border-radius: 6px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 0.9rem; white-space: pre-wrap; word-wrap: break-word;">${formattedOutput}</pre>
                </div>
            `;
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
    
    // Удаляем подключения последовательно
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const connectionId of selectedIds) {
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

