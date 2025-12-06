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

/**
 * Отрисовать дерево подключений в боковой панели
 * @param {Array} connections - Массив подключений
 */
function renderConnectionsTree(connections) {
    const treeContainer = document.getElementById('connectionsTree');
    if (!treeContainer) return;
    
    treeContainer.innerHTML = '';
    
    connections.forEach(conn => {
        const node = document.createElement('div');
        node.className = 'tree-node';
        node.style.position = 'relative';
        node.innerHTML = `
            <div style="flex: 1; cursor: pointer;">
                <strong>${conn.display_name}</strong>
                <div style="font-size: 0.8rem; color: #666;">${conn.server_host}:${conn.ras_port}</div>
            </div>
            <button class="btn btn-sm" onclick="event.stopPropagation(); openConnectionEditModal(${conn.id})" 
                    style="padding: 0.25rem 0.5rem; margin: 0; background: transparent; border: none; color: #666; cursor: pointer; font-size: 1rem;">
                ⚙️
            </button>
        `;
        node.style.display = 'flex';
        node.style.alignItems = 'center';
        node.style.justifyContent = 'space-between';
        
        // Клик на подключение (не на кнопку редактирования) - выполняет команду
        const connectionPart = node.querySelector('div');
        connectionPart.onclick = () => loadConnectionData(conn.id);
        
        treeContainer.appendChild(node);
    });
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
        <div class="modal-overlay" id="connectionModal" onclick="closeConnectionModalOnOverlay(event)">
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
                        <div class="form-row">
                            <label for="modalClusterAdmin">Логин кластера (необязательно)</label>
                            <input type="text" id="modalClusterAdmin" value="${connectionData?.cluster_admin || ''}" placeholder="admin">
                        </div>
                        <div class="form-row">
                            <label for="modalClusterPassword">Пароль кластера (необязательно)</label>
                            <input type="password" id="modalClusterPassword" value="" placeholder="••••••••">
                            <small style="color: #888; font-size: 0.75rem; margin-top: 0.25rem;">Оставьте пустым, чтобы не изменять</small>
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
}

/**
 * Сохранить подключение (создать или обновить)
 */
async function saveConnection(connectionId) {
    const displayName = document.getElementById('modalDisplayName').value;
    const serverHost = document.getElementById('modalServerHost').value;
    const rasPort = document.getElementById('modalRasPort').value;
    const clusterAdmin = document.getElementById('modalClusterAdmin').value;
    const clusterPassword = document.getElementById('modalClusterPassword').value;
    
    if (!displayName || !serverHost || !rasPort) {
        showNotification('❌ Заполните обязательные поля: Отображаемое имя, Сервер и Порт RAS', true);
        return;
    }
    
    const connectionData = {
        display_name: displayName,
        server_host: serverHost,
        ras_port: parseInt(rasPort),
        cluster_admin: clusterAdmin || ''
    };
    
    // Пароль добавляем только если указан (при редактировании пустое поле означает "не менять")
    if (clusterPassword) {
        connectionData.cluster_password = clusterPassword;
    }
    
    try {
        let response;
        if (connectionId) {
            // Обновление существующего подключения
            response = await fetch(`/api/clusters/connections/update/${connectionId}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify(connectionData)
            });
        } else {
            // Создание нового подключения - пароль может быть пустым
            connectionData.cluster_password = clusterPassword || '';
            response = await fetch('/api/clusters/connections/create/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify(connectionData)
            });
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

function closeConnectionModalOnOverlay(event) {
    if (event.target.id === 'connectionModal') {
        closeConnectionModal();
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
            hideConnectionForm();
            loadConnections();
            loadStatistics();
            
            // Очистить форму
            document.getElementById('displayName').value = '';
            document.getElementById('serverHost').value = '';
            document.getElementById('rasPort').value = '1545';
            document.getElementById('clusterAdmin').value = '';
            document.getElementById('clusterPassword').value = '';
        } else {
            showNotification('❌ Ошибка создания подключения: ' + result.error, true);
        }
    } catch (error) {
        showNotification('❌ Ошибка создания подключения: ' + error.message, true);
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

