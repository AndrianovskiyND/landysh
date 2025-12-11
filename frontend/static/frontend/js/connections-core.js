/**
 * Основная работа с подключениями - Ландыш
 * CRUD операции для подключений
 */

// Режим выбора подключений для массового удаления
let connectionSelectionMode = false;
let selectedConnections = new Set();

// Состояние сворачивания папок (хранится в localStorage)
const FOLDERS_STATE_KEY = 'landysh_folders_state';

/**
 * Получить состояние папок из localStorage
 */
function getFoldersState() {
    try {
        const state = localStorage.getItem(FOLDERS_STATE_KEY);
        return state ? JSON.parse(state) : {};
    } catch (e) {
        return {};
    }
}

/**
 * Сохранить состояние папок в localStorage
 */
function saveFoldersState(state) {
    try {
        localStorage.setItem(FOLDERS_STATE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Ошибка сохранения состояния папок:', e);
    }
}

/**
 * Получить состояние конкретной папки (развернута по умолчанию)
 */
function getFolderState(folderId) {
    const state = getFoldersState();
    // По умолчанию папки развернуты (true = развернута, false = свернута)
    return state[folderId] !== undefined ? state[folderId] : true;
}

/**
 * Переключить состояние папки
 */
function toggleFolderState(folderId) {
    const state = getFoldersState();
    state[folderId] = !getFolderState(folderId);
    saveFoldersState(state);
    return state[folderId];
}

/**
 * Загрузить список подключений и папок
 */
async function loadConnections() {
    try {
        const response = await fetch('/api/clusters/connections/');
        const data = await response.json();
        
        if (data.connections && data.folders) {
            renderConnectionsTree(data.connections, data.folders);
        } else if (data.connections) {
            // Обратная совместимость: если папок нет, передаем пустой массив
            renderConnectionsTree(data.connections, []);
        }
    } catch (error) {
        showNotification('Ошибка загрузки подключений: ' + error.message, true);
    }
}

/**
 * Отрисовать дерево подключений в боковой панели
 * @param {Array} connections - Массив подключений
 * @param {Array} folders - Массив папок
 */
function renderConnectionsTree(connections, folders = []) {
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
        renderConnectionsTree(connections, folders);
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
    
    // Группируем подключения по папкам
    const foldersMap = new Map();
    folders.forEach(folder => {
        foldersMap.set(folder.id, {
            ...folder,
            connections: []
        });
    });
    
    const connectionsWithoutFolder = [];
    connections.forEach(conn => {
        if (conn.folder_id && foldersMap.has(conn.folder_id)) {
            foldersMap.get(conn.folder_id).connections.push(conn);
        } else {
            connectionsWithoutFolder.push(conn);
        }
    });
    
    // Сортируем папки по порядку
    const sortedFolders = Array.from(foldersMap.values()).sort((a, b) => a.order - b.order);
    
    // Сортируем подключения в каждой папке по порядку
    sortedFolders.forEach(folder => {
        folder.connections.sort((a, b) => (a.order || 0) - (b.order || 0));
    });
    
    // Сортируем подключения без папок по порядку
    connectionsWithoutFolder.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Отрисовываем папки с подключениями
    sortedFolders.forEach(folder => {
        const folderNode = createFolderNode(folder, connectionSelectionMode);
        treeContainer.appendChild(folderNode);
        
        // Создаем контейнер для подключений папки
        const folderConnectionsContainer = document.createElement('div');
        folderConnectionsContainer.className = 'folder-connections';
        folderConnectionsContainer.dataset.folderId = folder.id;
        folderConnectionsContainer.id = `folder-connections-${folder.id}`;
        
        // Проверяем состояние папки (свернута/развернута)
        const isExpanded = getFolderState(folder.id);
        if (!isExpanded) {
            folderConnectionsContainer.style.display = 'none';
        }
        
        // Отрисовываем подключения в папке
        folder.connections.forEach(conn => {
            const connNode = createConnectionNode(conn, connectionSelectionMode, folder.id);
            folderConnectionsContainer.appendChild(connNode);
        });
        
        treeContainer.appendChild(folderConnectionsContainer);
    });
    
    // Отрисовываем подключения без папок
    connectionsWithoutFolder.forEach(conn => {
        const connNode = createConnectionNode(conn, connectionSelectionMode, null);
        treeContainer.appendChild(connNode);
    });
}

/**
 * Создать узел папки
 */
function createFolderNode(folder, selectionMode) {
    const node = document.createElement('div');
    node.className = 'tree-node folder-node';
    node.style.position = 'relative';
    node.style.paddingLeft = '1rem';
    node.style.fontWeight = 'bold';
    node.style.backgroundColor = '#f0f0f0';
    node.dataset.folderId = folder.id;
    
    if (!selectionMode) {
        // Проверяем состояние папки
        const isExpanded = getFolderState(folder.id);
        const arrowIcon = isExpanded ? '▼' : '▶';
        const connectionsCount = folder.connections ? folder.connections.length : 0;
        
        // Обычный режим - показываем кнопки редактирования
        node.innerHTML = `
            <div style="flex: 1; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;" onclick="toggleFolder(${folder.id})">
                <span class="folder-arrow" style="font-size: 0.8rem; width: 1rem; text-align: center; user-select: none;">${arrowIcon}</span>
                <span>📁</span>
                <span style="flex: 1;">${escapeHtml(folder.name)}</span>
                <span style="font-size: 0.75rem; color: #666; font-weight: normal;">(${connectionsCount})</span>
            </div>
            <div style="display: flex; gap: 0.25rem;">
                <button class="btn btn-sm" onclick="event.stopPropagation(); openEditFolderModal(${folder.id}, '${escapeHtml(folder.name).replace(/'/g, "\\'")}')" 
                        style="padding: 0.25rem 0.5rem; margin: 0; background: transparent; border: none; color: #666; cursor: pointer; font-size: 0.9rem;"
                        title="Редактировать">
                    ⚙️
                </button>
                <button class="btn btn-sm" onclick="event.stopPropagation(); deleteFolder(${folder.id}, '${escapeHtml(folder.name).replace(/'/g, "\\'")}')" 
                        style="padding: 0.25rem 0.5rem; margin: 0; background: transparent; border: none; color: #dc3545; cursor: pointer; font-size: 0.9rem;"
                        title="Удалить">
                    🗑️
                </button>
            </div>
        `;
        node.style.display = 'flex';
        node.style.alignItems = 'center';
        node.style.justifyContent = 'space-between';
        
        // Инициализируем drag-and-drop
        initDragDrop(node, 'folder', folder.id);
    } else {
        // Режим выбора - папки не показываем
        node.style.display = 'none';
    }
    
    return node;
}

/**
 * Переключить состояние папки (свернуть/развернуть)
 */
function toggleFolder(folderId) {
    const isExpanded = toggleFolderState(folderId);
    const folderConnectionsContainer = document.getElementById(`folder-connections-${folderId}`);
    const folderNode = document.querySelector(`[data-folder-id="${folderId}"].folder-node`);
    
    if (folderConnectionsContainer) {
        if (isExpanded) {
            folderConnectionsContainer.style.display = 'block';
        } else {
            folderConnectionsContainer.style.display = 'none';
        }
    }
    
    // Обновляем иконку стрелки
    if (folderNode) {
        const arrowElement = folderNode.querySelector('.folder-arrow');
        if (arrowElement) {
            arrowElement.textContent = isExpanded ? '▼' : '▶';
        }
    }
}

/**
 * Создать узел подключения
 */
function createConnectionNode(conn, selectionMode, folderId) {
    const node = document.createElement('div');
    node.className = 'tree-node connection-node';
    node.style.position = 'relative';
    if (folderId) {
        node.style.paddingLeft = '2rem';
    }
    node.dataset.folderId = folderId || '';
    
    if (selectionMode) {
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
        
        // Инициализируем drag-and-drop
        initDragDrop(node, 'connection', conn.id);
    }
    
    return node;
}

/**
 * Экранирование HTML для безопасности
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
        <div class="modal-overlay optimized" id="connectionModal">
            <div class="modal" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>${connectionId ? '⚙️ Редактирование подключения' : '➕ Добавить подключение'}</h3>
                    <button class="modal-close-btn" onclick="closeConnectionModal()">×</button>
                </div>
                <div class="modal-body">
                    <!-- Основные настройки -->
                    <div class="info-card" style="margin-bottom: 1rem;">
                        <h4 style="border-bottom-color: var(--primary-color);">🔧 Основные настройки</h4>
                        <div class="edit-form">
                            <div class="form-row">
                                <label for="modalDisplayName">Отображаемое имя *</label>
                                <input type="text" id="modalDisplayName" value="${connectionData?.display_name || ''}" placeholder="Имя для отображения в списке">
                            </div>
                            <div class="form-row">
                                <label for="modalServerHost">Сервер *</label>
                                <input type="text" id="modalServerHost" value="${connectionData?.server_host || ''}" placeholder="app-host.com">
                            </div>
                            <div class="form-row">
                                <label for="modalRasPort">Порт RAS *</label>
                                <input type="number" id="modalRasPort" value="${connectionData?.ras_port || '1545'}" placeholder="1545">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Учетные данные агента кластера -->
                    <div class="info-card" style="margin-bottom: 1rem;">
                        <h4 style="border-bottom-color: var(--primary-color);">🤖 Агент кластера</h4>
                        <div class="edit-form">
                            <div class="form-row checkbox-row" style="margin-top: 0.5rem;">
                                <input type="checkbox" id="modalUseAgentAuth" ${connectionData?.agent_user ? 'checked' : ''} onchange="toggleAgentAuthFields()">
                                <label for="modalUseAgentAuth" style="font-weight: normal; text-transform: none; letter-spacing: normal;">Использовать УЗ агента кластера</label>
                            </div>
                            <div id="agentAuthFields" style="display: ${connectionData?.agent_user ? 'block' : 'none'};">
                                <div class="form-row">
                                    <label for="modalAgentUser">Логин агента</label>
                                    <input type="text" id="modalAgentUser" value="${connectionData?.agent_user || ''}" placeholder="agent">
                                </div>
                                <div class="form-row">
                                    <label for="modalAgentPassword">Пароль агента</label>
                                    <input type="password" id="modalAgentPassword" value="" placeholder="••••••••">
                                    <small style="color: #888; font-size: 0.75rem; margin-top: 0.25rem;">${connectionId ? 'Оставьте пустым, чтобы не изменять' : 'Введите пароль'}</small>
                                </div>
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
    if (connectionData?.agent_user) {
        toggleAgentAuthFields();
    }
}

/**
 * Переключить отображение полей УЗ агента кластера
 */
function toggleAgentAuthFields() {
    const checkbox = document.getElementById('modalUseAgentAuth');
    const fieldsContainer = document.getElementById('agentAuthFields');
    const agentUserInput = document.getElementById('modalAgentUser');
    const agentPasswordInput = document.getElementById('modalAgentPassword');
    
    if (!checkbox || !fieldsContainer || !agentUserInput || !agentPasswordInput) {
        return;
    }
    
    if (checkbox.checked) {
        fieldsContainer.style.display = 'block';
        agentUserInput.disabled = false;
        agentPasswordInput.disabled = false;
    } else {
        fieldsContainer.style.display = 'none';
        agentUserInput.disabled = false;
        agentPasswordInput.disabled = false;
        // Очищаем поля при скрытии
        agentUserInput.value = '';
        agentPasswordInput.value = '';
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
        
        if (!displayNameEl || !serverHostEl || !rasPortEl) {
            showNotification('❌ Ошибка: Не найдены элементы формы. Попробуйте обновить страницу.', true);
            return;
        }
        
        const displayName = displayNameEl.value;
        const serverHost = serverHostEl.value;
        const rasPort = rasPortEl.value;
        const useAgentAuth = document.getElementById('modalUseAgentAuth')?.checked || false;
        const agentUser = useAgentAuth ? (document.getElementById('modalAgentUser')?.value || '') : '';
        const agentPassword = useAgentAuth ? (document.getElementById('modalAgentPassword')?.value || '') : '';
    
        if (!displayName || !serverHost || !rasPort) {
            showNotification('❌ Заполните обязательные поля: Отображаемое имя, Сервер и Порт RAS', true);
            return;
        }
        
        const connectionData = {
            display_name: displayName,
            server_host: serverHost,
            ras_port: parseInt(rasPort),
            agent_user: useAgentAuth ? (agentUser || '') : ''
        };
        
        // Пароль агента добавляем только если галочка включена и указан пароль
        if (useAgentAuth && agentPassword) {
            connectionData.agent_password = agentPassword;
        } else if (!useAgentAuth && connectionId) {
            // Если галочка снята при редактировании - очищаем пароль
            connectionData.agent_password = '';
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
            // Создание нового подключения - пароли добавляем только если галочки включены
            if (useAgentAuth && agentPassword) {
                connectionData.agent_password = agentPassword;
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
        
        // Обработка дубликатов при создании подключения
        if (!result.success && result.has_duplicates && !connectionId) {
            // Показываем модальное окно подтверждения дубликата
            const confirmed = await showDuplicateConnectionModal(result.duplicates, result.duplicates_count);
            if (confirmed) {
                // Повторяем запрос с флагом force_create
                connectionData.force_create = true;
                const retryResponse = await fetch('/api/clusters/connections/create/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify(connectionData)
                });
                
                if (!retryResponse.ok) {
                    throw new Error(`HTTP error! status: ${retryResponse.status}`);
                }
                
                const retryResult = await retryResponse.json();
                if (retryResult.success) {
                    showNotification('✅ Подключение создано успешно');
                    closeConnectionModal();
                    loadConnections();
                    if (window.loadStatistics) {
                        loadStatistics();
                    }
                } else {
                    showNotification('❌ Ошибка: ' + retryResult.error, true);
                }
            }
            return; // Не показываем ошибку, так как пользователь отменил
        }
        
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

/**
 * Показать модальное окно подтверждения создания дублирующего подключения
 * @param {Array<string>} duplicates - Список display_name дублирующих подключений (до 5)
 * @param {number} duplicatesCount - Общее количество дублирующих подключений
 * @returns {Promise<boolean>} - true если пользователь подтвердил, false если отменил
 */
function showDuplicateConnectionModal(duplicates, duplicatesCount) {
    return new Promise((resolve) => {
        // Удаляем предыдущее модальное окно если есть
        const existingModal = document.getElementById('duplicateConnectionModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Формируем список дубликатов
        let duplicatesListHtml = '';
        const displayCount = Math.min(duplicates.length, 5);
        for (let i = 0; i < displayCount; i++) {
            duplicatesListHtml += `<div style="padding: 0.25rem 0;">• ${escapeHtml(duplicates[i])}</div>`;
        }
        
        // Если дубликатов больше 5, добавляем "..."
        if (duplicatesCount > 5) {
            duplicatesListHtml += `<div style="padding: 0.25rem 0; color: #666;">...</div>`;
        }
        
        const modalHtml = `
            <div class="modal-overlay optimized" id="duplicateConnectionModal" style="z-index: 10001;">
                <div class="modal" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>⚠️ Дублирующее подключение</h3>
                        <button class="modal-close-btn" onclick="closeDuplicateConnectionModal(false)">×</button>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 1rem;">Подключение с таким <strong>server_host</strong> и <strong>ras_port</strong> ранее уже было создано.</p>
                        <div style="margin-bottom: 1rem;">
                            <div style="font-weight: 600; margin-bottom: 0.5rem;">Дублирующие подключения:</div>
                            <div style="max-height: 150px; overflow-y: auto; padding: 0.5rem; background: #f8f9fa; border-radius: 4px; font-size: 0.9rem;">
                                ${duplicatesListHtml}
                            </div>
                        </div>
                        <p style="font-weight: 600;">Вы точно хотите создать дублирующую запись?</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeDuplicateConnectionModal(false)">Нет</button>
                        <button class="btn btn-primary" onclick="closeDuplicateConnectionModal(true)">Да</button>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.getElementById('modal-container');
        container.insertAdjacentHTML('beforeend', modalHtml);
        
        // Сохраняем resolve в глобальной переменной для использования в closeDuplicateConnectionModal
        window._duplicateModalResolve = resolve;
    });
}

/**
 * Закрыть модальное окно подтверждения дубликата
 * @param {boolean} confirmed - true если пользователь подтвердил, false если отменил
 */
function closeDuplicateConnectionModal(confirmed) {
    const modal = document.getElementById('duplicateConnectionModal');
    if (modal) {
        modal.remove();
    }
    
    // Вызываем resolve из Promise
    if (window._duplicateModalResolve) {
        window._duplicateModalResolve(confirmed);
        window._duplicateModalResolve = null;
    }
}

/**
 * Получить ключ для localStorage для учетных данных администратора кластера
 */
function getClusterAdminStorageKey(connectionId, clusterUuid) {
    return `cluster_admin_${connectionId}_${clusterUuid}`;
}

/**
 * Сохранить учетные данные администратора кластера в localStorage
 */
function saveClusterAdminToStorage(connectionId, clusterUuid, admin, password) {
    const key = getClusterAdminStorageKey(connectionId, clusterUuid);
    const data = {
        admin: admin || '',
        password: password || ''
    };
    localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Загрузить учетные данные администратора кластера из localStorage
 */
function loadClusterAdminFromStorage(connectionId, clusterUuid) {
    const key = getClusterAdminStorageKey(connectionId, clusterUuid);
    const stored = localStorage.getItem(key);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Ошибка парсинга данных из localStorage:', e);
        }
    }
    return { admin: '', password: '' };
}

/**
 * Открыть модальное окно для редактирования администратора кластера
 */
async function openClusterAdminModal(connectionId, clusterUuid, clusterName) {
    // Загружаем сохраненные данные из localStorage
    let storedData = loadClusterAdminFromStorage(connectionId, clusterUuid);
    
    // Если данных нет в localStorage, но есть в подключении - переносим для первого кластера
    if (!storedData.admin) {
        try {
            const connResponse = await fetch('/api/clusters/connections/');
            const connData = await connResponse.json();
            const connection = connData.connections?.find(c => c.id === connectionId);
            
            // Проверяем, это первый кластер?
            const clustersResponse = await fetch(`/api/clusters/clusters/${connectionId}/`);
            const clustersData = await clustersResponse.json();
            let clusters = clustersData.clusters || [];
            if (clusters.length === 0 && clustersData.output) {
                // Парсим вывод вручную если структурированных данных нет
                clusters = parseClusterList(clustersData.output);
            }
            
            // Если это первый кластер и в подключении есть администратор - переносим
            if (clusters.length > 0 && clusters[0].uuid === clusterUuid && connection?.cluster_admin) {
                storedData = {
                    admin: connection.cluster_admin || '',
                    password: '' // Пароль не хранится в подключении в открытом виде
                };
                // Сохраняем в localStorage
                saveClusterAdminToStorage(connectionId, clusterUuid, storedData.admin, storedData.password);
            }
        } catch (error) {
            console.error('Ошибка загрузки данных подключения:', error);
        }
    }
    
    // Сохраняем исходный пароль для отслеживания изменений
    const originalPassword = storedData.password || '';
    const hasPassword = originalPassword.length > 0;
    
    const modalHtml = `
        <div class="modal-overlay optimized" id="clusterAdminModal" data-original-password="${escapeHtml(originalPassword)}">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>⚙️ Администратор кластера: ${escapeHtml(clusterName)}</h3>
                    <button class="modal-close-btn" onclick="closeClusterAdminModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="info-card" style="margin-bottom: 1rem;">
                        <h4 style="border-bottom-color: var(--secondary-color);">👤 Администратор кластера</h4>
                        <div class="edit-form">
                            <div class="form-row checkbox-row" style="margin-top: 0.5rem;">
                                <input type="checkbox" id="clusterAdminUseAuth" ${storedData.admin ? 'checked' : ''} onchange="toggleClusterAdminAuthFields()">
                                <label for="clusterAdminUseAuth" style="font-weight: normal; text-transform: none; letter-spacing: normal;">Использовать УЗ админа кластера</label>
                            </div>
                            <div id="clusterAdminAuthFields" style="display: ${storedData.admin ? 'block' : 'none'};">
                                <div class="form-row">
                                    <label for="clusterAdminName">Логин кластера</label>
                                    <input type="text" id="clusterAdminName" value="${storedData.admin || ''}" placeholder="admin">
                                </div>
                                <div class="form-row">
                                    <label for="clusterAdminPassword">Пароль кластера</label>
                                    <input type="password" id="clusterAdminPassword" value="${hasPassword ? '********' : ''}" placeholder="${hasPassword ? '********' : 'Введите пароль'}" data-has-original-password="${hasPassword ? 'true' : 'false'}">
                                    <small style="color: #888; font-size: 0.75rem; margin-top: 0.25rem;">${hasPassword ? 'Оставьте без изменений, чтобы сохранить текущий пароль. Введите новый пароль для изменения.' : 'Введите пароль'}</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeClusterAdminModal()">Отмена</button>
                    <button class="btn btn-primary" onclick="saveClusterAdminSettings(${connectionId}, '${clusterUuid}')">
                        💾 Сохранить
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const container = document.getElementById('modal-container');
    container.insertAdjacentHTML('beforeend', modalHtml);
    
    // Инициализируем состояние полей при загрузке
    if (storedData.admin) {
        toggleClusterAdminAuthFields();
    }
    
    // Настраиваем обработчик для отслеживания изменений пароля
    const passwordInput = document.getElementById('clusterAdminPassword');
    const modal = document.getElementById('clusterAdminModal');
    if (passwordInput && modal && hasPassword) {
        // Сохраняем исходный пароль в data-атрибуте модального окна
        modal.dataset.originalPassword = originalPassword;
        passwordInput.dataset.wasChanged = 'false';
        
        // Обработчик для фокуса - если пользователь кликнул в поле, очищаем его для ввода
        passwordInput.addEventListener('focus', function() {
            if (this.value === '********' && this.dataset.wasChanged === 'false') {
                this.value = '';
            }
        });
        
        // Обработчик для отслеживания изменений
        passwordInput.addEventListener('input', function() {
            // Если пользователь начал вводить, отмечаем что поле было изменено
            this.dataset.wasChanged = 'true';
        });
        
        // Обработчик для blur - если поле пустое и не было изменено, возвращаем звёздочки
        passwordInput.addEventListener('blur', function() {
            if (this.value === '' && this.dataset.wasChanged === 'false') {
                this.value = '********';
            }
        });
    }
}

/**
 * Переключить отображение полей УЗ админа кластера
 */
function toggleClusterAdminAuthFields() {
    const checkbox = document.getElementById('clusterAdminUseAuth');
    const fieldsContainer = document.getElementById('clusterAdminAuthFields');
    const adminInput = document.getElementById('clusterAdminName');
    const passwordInput = document.getElementById('clusterAdminPassword');
    
    if (!checkbox || !fieldsContainer || !adminInput || !passwordInput) {
        return;
    }
    
    if (checkbox.checked) {
        fieldsContainer.style.display = 'block';
        adminInput.disabled = false;
        passwordInput.disabled = false;
    } else {
        fieldsContainer.style.display = 'none';
        adminInput.disabled = false;
        passwordInput.disabled = false;
        // Очищаем поля при скрытии
        adminInput.value = '';
        passwordInput.value = '';
    }
}

/**
 * Сохранить учетные данные администратора кластера
 */
function saveClusterAdminSettings(connectionId, clusterUuid) {
    const useAuth = document.getElementById('clusterAdminUseAuth')?.checked || false;
    
    // Если чекбокс выключен - просто очищаем данные
    if (!useAuth) {
        saveClusterAdminToStorage(connectionId, clusterUuid, '', '');
        showNotification('✅ Учетные данные администратора кластера очищены', false);
        closeClusterAdminModal();
        
        // Перезагружаем данные кластера, чтобы применить изменения
        if (window._currentConnectionId == connectionId) {
            loadConnectionData(connectionId);
        }
        return;
    }
    
    // Если чекбокс включен - проверяем, что логин заполнен
    const admin = document.getElementById('clusterAdminName')?.value || '';
    const passwordInput = document.getElementById('clusterAdminPassword');
    const passwordValue = passwordInput?.value || '';
    
    if (!admin) {
        showNotification('❌ Логин обязателен для заполнения', true);
        return;
    }
    
    // Получаем исходный пароль из модального окна или localStorage
    const modal = document.getElementById('clusterAdminModal');
    const originalPassword = modal?.dataset.originalPassword || 
                            loadClusterAdminFromStorage(connectionId, clusterUuid).password || '';
    
    // Определяем, был ли пароль изменен
    let passwordToSave = originalPassword; // По умолчанию сохраняем исходный пароль
    
    const wasChanged = passwordInput?.dataset.wasChanged === 'true';
    
    // Если поле пароля содержит звёздочки и не было изменено - сохраняем исходный пароль
    if (passwordValue === '********' && !wasChanged) {
        passwordToSave = originalPassword; // Сохраняем исходный пароль
    } 
    // Если пользователь ввел новый пароль (не звёздочки и не пустое) - сохраняем его
    else if (passwordValue && passwordValue !== '********') {
        passwordToSave = passwordValue;
    } 
    // Если поле пустое и было изменено - пользователь хочет удалить пароль
    else if (!passwordValue && wasChanged) {
        passwordToSave = '';
    }
    // Если поле пустое, но не было изменено и был исходный пароль - сохраняем исходный (не удаляем)
    else if (!passwordValue && !wasChanged && originalPassword) {
        passwordToSave = originalPassword;
    }
    // Если пароля не было изначально и не введен новый - оставляем пустым
    else if (!passwordValue && !originalPassword) {
        passwordToSave = '';
    }
    
    // Сохраняем в localStorage
    saveClusterAdminToStorage(connectionId, clusterUuid, admin, passwordToSave);
    showNotification('✅ Учетные данные администратора кластера сохранены', false);
    
    closeClusterAdminModal();
    
    // Перезагружаем данные кластера, чтобы применить изменения
    if (window._currentConnectionId == connectionId) {
        loadConnectionData(connectionId);
    }
}

/**
 * Закрыть модальное окно администратора кластера
 */
function closeClusterAdminModal() {
    const modal = document.getElementById('clusterAdminModal');
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => modal.remove(), 200);
    }
}

/**
 * Получить учетные данные администратора кластера для использования в RAC командах
 */
function getClusterAdminCredentials(connectionId, clusterUuid) {
    return loadClusterAdminFromStorage(connectionId, clusterUuid);
}

/**
 * Добавить параметры администратора кластера к URL или body запроса
 */
function addClusterAdminParams(url, connectionId, clusterUuid, method = 'GET') {
    const credentials = getClusterAdminCredentials(connectionId, clusterUuid);
    
    if (method === 'GET') {
        // Для GET запросов добавляем параметры в URL
        if (!credentials.admin) {
            return url; // Если нет данных - возвращаем URL как есть
        }
        const urlObj = new URL(url, window.location.origin);
        urlObj.searchParams.set('cluster_admin', credentials.admin);
        if (credentials.password) {
            urlObj.searchParams.set('cluster_password', credentials.password);
        }
        // Возвращаем только путь с параметрами (без origin)
        return urlObj.pathname + urlObj.search;
    } else {
        // Для POST/PUT/DELETE запросов возвращаем объект для добавления в body
        const params = {};
        if (credentials.admin) {
            params.cluster_admin = credentials.admin;
            if (credentials.password) {
                params.cluster_password = credentials.password;
            }
        }
        return params;
    }
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
                total_connections_in_group: conn.user_connections_in_group || 0,
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
        const totalConnectionsInGroup = groupInfo.total_connections_in_group;
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
    const groupsToProtect = [];
    const protectedConnectionIds = new Set();
    
    Object.values(groupsInfo).forEach(groupInfo => {
        const totalConnectionsInGroup = groupInfo.total_connections_in_group;
        const selectedInGroup = groupInfo.connections.length;
        
        // Если удаляются все подключения группы и в группе 2+ участников
        if (selectedInGroup === totalConnectionsInGroup && groupInfo.members_count > 1) {
            const groupId = groupInfo.connections[0].group_id;
            const connectionIds = groupInfo.connections.map(c => c.id);
            groupsToProtect.push({
                groupId: groupId,
                groupName: groupInfo.name,
                connectionIds: connectionIds,
                remainingMembers: groupInfo.members_count - 1
            });
            connectionIds.forEach(id => protectedConnectionIds.add(id));
        }
    });
    
    // Если есть защищённые группы, обрабатываем их отдельно ПЕРЕД удалением
    const errors = [];
    if (groupsToProtect.length > 0) {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден. Обновите страницу.', true);
            return;
        }
        
        // Для защищённых групп: не удаляем подключения, только исключаем пользователя
        for (const protectedGroup of groupsToProtect) {
            try {
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
                // Если 404 (Not Found), подключение уже удалено - считаем успехом
                if (response.status === 404) {
                    successCount++;
                    continue;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                successCount++;
            } else {
                // Если подключение не найдено, это может означать, что оно уже было удалено
                // (например, через CASCADE при удалении группы). Считаем это успешным удалением.
                const errorMsg = result.error || '';
                if (errorMsg.includes('не найдено') || errorMsg.includes('нет доступа')) {
                    // Подключение уже удалено (цель достигнута) - считаем успехом
                    successCount++;
                } else {
                    errorCount++;
                    errors.push(errorMsg || 'Неизвестная ошибка');
                }
            }
        } catch (error) {
            // Если ошибка связана с тем, что подключение не найдено, считаем успехом
            const errorMsg = error.message || '';
            if (errorMsg.includes('404') || errorMsg.includes('не найдено') || errorMsg.includes('Not Found')) {
                successCount++;
            } else {
                errorCount++;
                errors.push(errorMsg || 'Ошибка сети');
            }
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
        showNotification('❌ Не удалось удалить подключения: ' + (errors[0] || 'Неизвестная ошибка'), true);
    }
}

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

