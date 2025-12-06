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
        node.innerHTML = `
            <div>
                <strong>${conn.display_name}</strong>
                <div style="font-size: 0.8rem; color: #666;">${conn.server_host}:${conn.ras_port}</div>
            </div>
        `;
        node.onclick = () => loadConnectionData(conn.id);
        treeContainer.appendChild(node);
    });
}

// ============================================
// Создание подключения
// ============================================

/**
 * Создать новое подключение
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
 * Загрузить данные подключения
 * @param {number} connectionId - ID подключения
 */
function loadConnectionData(connectionId) {
    showNotification('Загрузка данных подключения ' + connectionId);
    // TODO: Реализовать загрузку и отображение данных подключения
}

