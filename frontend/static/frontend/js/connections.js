/**
 * Управление подключениями - Ландыш
 * Работа с подключениями к серверам 1С
 * 
 * Примечание: Функции для работы с подключениями перенесены в connections-core.js:
 * - loadConnections
 * - renderConnectionsTree
 * - updateConnectionSelection
 * - toggleSelectAllConnections
 * - openConnectionModal
 * - openConnectionEditModal
 * - toggleAgentAuthFields
 * - saveConnection
 * - closeConnectionModal
 * - createConnection
 * - deleteSelectedConnections
 * 
 * Переменные connectionSelectionMode и selectedConnections также определены в connections-core.js
 */

// ============================================
// Функции для работы с информационными базами, серверами, сеансами и процессами
// ============================================

// Примечание: Функции для работы с инфобазами находятся в connections-infobases.js
// Примечание: Функции для работы с серверами находятся в connections-servers.js
// Примечание: Функции для работы с сеансами и процессами пока остаются здесь
// (модули connections-sessions.js и connections-processes.js еще не заполнены)

// Примечание: Все функции для работы с подключениями (renderConnectionsTree, updateConnectionSelection,
// toggleSelectAllConnections, openConnectionModal, openConnectionEditModal, toggleAgentAuthFields,
// saveConnection, closeConnectionModal) перенесены в connections-core.js

// ============================================
// Модальное окно для редактирования администратора кластера
// ============================================

// Примечание: Функции для работы с администратором кластера перенесены в connections-core.js:
// - getClusterAdminStorageKey
// - saveClusterAdminToStorage
// - loadClusterAdminFromStorage
// - openClusterAdminModal
// - toggleClusterAdminAuthFields
// - saveClusterAdminSettings
// - closeClusterAdminModal
// - getClusterAdminCredentials
// - addClusterAdminParams

// Примечание: Функция createConnection также перенесена в connections-core.js

// Примечание: Функция loadConnectionData перенесена в connections-clusters.js

// Примечание: Функции parseClusterList, escapeHtml, formatRACOutput перенесены в connections-utils.js

// Примечание: Функции parseClusterList, escapeHtml, formatRACOutput перенесены в connections-utils.js

// Примечание: Функция deleteSelectedConnections перенесена в connections-core.js

// Примечание: Функция setupClusterEventHandlers перенесена в connections-clusters.js

// Примечание: Функции toggleClusterNode, toggleSectionNode, loadSectionData, loadClusterSection 
// перенесены в connections-clusters.js

// Примечание: Функции loadInfobasesIntoTree, loadServersIntoTree, loadInfobases, loadServers
// перенесены в connections-infobases.js и connections-servers.js соответственно

/**
 * Открывает модальное окно сеансов на весь экран
 */
async function openSessionsModal(connectionId, clusterUuid, infobaseUuid = null, infobaseName = null) {
    closeContextMenu();
    
    // Удаляем предыдущее модальное окно если есть
    const existingModal = document.getElementById('sessionsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Формируем заголовок
    let title = '💺 Сеансы';
    if (infobaseUuid && infobaseName) {
        title += ` (фильтр по информационной базе: ${escapeHtml(infobaseName)})`;
    } else if (infobaseUuid) {
        title += ' (фильтр по информационной базе)';
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay optimized';
    modal.id = 'sessionsModal';
    modal.style.zIndex = '10001';
    modal.innerHTML = `
        <div class="modal" style="max-width: 95vw; max-height: 95vh; width: 95vw; height: 95vh; display: flex; flex-direction: column;">
            <div class="modal-header" style="flex-shrink: 0;">
                <h3>${title}</h3>
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
        
        // Добавляем учетные данные администратора кластера
        url = addClusterAdminParams(url, connectionId, clusterUuid);
        
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
 * Получить русское название столбца сеанса
 */
function getSessionColumnDisplayName(key) {
    const columnNames = {
        'infobase': 'Инф. база',
        'user-name': 'Пользователь',
        'username': 'Пользователь', // Альтернативное название
        'app-id': 'Приложение',
        'host': 'Компьютер',
        'client-ip': 'IP Клиента',
        'session-id': 'Номер сеанса',
        'hibernate': 'Спящий',
        'session': 'UUID сеанса'
    };
    return columnNames[key] || key;
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
    
    // Определяем столбцы по умолчанию (в нужном порядке)
    const defaultColumns = ['infobase', 'user-name', 'app-id', 'host', 'client-ip', 'session-id', 'hibernate'];
    // Также проверяем альтернативное название username
    if (!sortedKeys.includes('user-name') && sortedKeys.includes('username')) {
        const index = defaultColumns.indexOf('user-name');
        if (index !== -1) {
            defaultColumns[index] = 'username';
        }
    }
    
    // Получаем сохраненное состояние видимости столбцов
    // По умолчанию показываем только нужные столбцы
    if (!window._sessionsVisibleColumns) {
        // Фильтруем только те столбцы, которые существуют в данных
        const availableDefaultColumns = defaultColumns.filter(col => sortedKeys.includes(col));
        window._sessionsVisibleColumns = new Set(availableDefaultColumns);
    }
    const visibleColumns = window._sessionsVisibleColumns;
    
    // Получаем сохраненный порядок столбцов
    const columnOrderKey = `sessions_column_order_${connectionId}_${clusterUuid}`;
    let columnOrder = JSON.parse(localStorage.getItem(columnOrderKey) || 'null');
    if (!columnOrder || !Array.isArray(columnOrder)) {
        // Используем порядок по умолчанию, фильтруя только видимые столбцы
        const defaultOrder = defaultColumns.filter(col => visibleColumns.has(col) && sortedKeys.includes(col));
        // Добавляем остальные видимые столбцы в конец
        sortedKeys.forEach(k => {
            if (visibleColumns.has(k) && !defaultOrder.includes(k)) {
                defaultOrder.push(k);
            }
        });
        columnOrder = defaultOrder;
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
                        <input type="checkbox" id="selectAllSessionsHeader" onchange="toggleSelectAllSessions()" onfocus="this.blur()" style="cursor: pointer;">
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
                    <div style="font-weight: 600; word-wrap: break-word; white-space: normal;">${escapeHtml(getSessionColumnDisplayName(key))}</div>
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
                <td contenteditable="false" style="padding: 0.5rem; border: 1px solid #ddd; text-align: center; user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none;" onclick="if(event.target.type !== 'checkbox') { event.stopPropagation(); }" onfocus="if(event.target.type !== 'checkbox') { this.blur(); }">
                    <input type="checkbox" class="session-checkbox" value="${session.uuid}" ${isSelected ? 'checked' : ''} onchange="updateSessionSelection('${session.uuid}', this.checked)" onfocus="this.blur()" style="cursor: pointer;">
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
    const confirmed = await showConfirmModal(
        `Вы уверены, что хотите принудительно завершить ${count} сеанс${count > 1 ? 'ов' : ''}?`,
        'Подтверждение завершения сеансов'
    );
    
    if (!confirmed) {
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
    const confirmed = await showConfirmModal(
        `Вы уверены, что хотите прервать текущий серверный вызов для ${count} сеанс${count > 1 ? 'ов' : ''}?`,
        'Подтверждение прерывания серверных вызовов'
    );
    
    if (!confirmed) {
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
    
    // Подтверждение уже запрошено в terminateSelectedSessionsFromTable()
    // Не запрашиваем повторно, чтобы избежать двойного подтверждения
    
    const count = sessionUuids.length;
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден', true);
            return;
        }
        
        // Добавляем учетные данные администратора кластера
        const adminParams = addClusterAdminParams('', connectionId, clusterUuid, 'POST');
        const requestData = {
            connection_id: connectionId,
            cluster_uuid: clusterUuid,
            session_uuids: sessionUuids,
            ...adminParams
        };
        
        const response = await fetch('/api/clusters/sessions/terminate/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(requestData)
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
    modal.className = 'modal-overlay optimized';
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
        let url = `/api/clusters/sessions/${connectionId}/${clusterUuid}/info/?session=${sessionUuid}`;
        url = addClusterAdminParams(url, connectionId, clusterUuid);
        const response = await fetch(url);
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
    
    // Заголовки с русскими названиями (включаем UUID если он видим)
    const headers = [];
    if (visibleColumns.has('session')) {
        headers.push(getSessionColumnDisplayName('session'));
    }
    sortedKeys.forEach(key => {
        if (key !== 'session' && visibleColumns.has(key)) {
            headers.push(getSessionColumnDisplayName(key));
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
    
    // Определяем столбцы по умолчанию (в нужном порядке)
    const defaultColumns = ['infobase', 'user-name', 'app-id', 'host', 'client-ip', 'session-id', 'hibernate'];
    // Также проверяем альтернативное название username
    if (!sortedKeys.includes('user-name') && sortedKeys.includes('username')) {
        const index = defaultColumns.indexOf('user-name');
        if (index !== -1) {
            defaultColumns[index] = 'username';
        }
    }
    
    // Получаем сохраненное состояние видимости столбцов
    // По умолчанию показываем только нужные столбцы
    if (!window._sessionsVisibleColumns) {
        // Фильтруем только те столбцы, которые существуют в данных
        const availableDefaultColumns = defaultColumns.filter(col => sortedKeys.includes(col));
        window._sessionsVisibleColumns = new Set(availableDefaultColumns);
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
        const displayName = getSessionColumnDisplayName(key);
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
                // Добавляем учетные данные администратора кластера
                const adminParams = addClusterAdminParams('', connectionId, clusterUuid, 'POST');
                const requestData = {
                    connection_id: connectionId,
                    cluster_uuid: clusterUuid,
                    session_uuids: [sessionUuid],
                    ...adminParams
                };
                
                const response = await fetch('/api/clusters/sessions/interrupt/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    },
                    body: JSON.stringify(requestData)
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

// Примечание: Функция closeContextMenu перенесена в connections-utils.js

/**
 * Открывает модальное окно свойств кластера
 */
/**
 * Маппинг параметров информационной базы на русские названия
 */
function getInfobaseParamDisplayName(paramKey) {
    const paramNames = {
        'name': 'Имя информационной базы',
        'descr': 'Описание',
        'dbms': 'Тип СУБД',
        'db-server': 'Сервер баз данных',
        'db-name': 'Имя базы данных',
        'db-user': 'Пользователь базы данных',
        'security-level': 'Уровень безопасности',
        'license-distribution': 'Управление выдачей лицензий',
        'scheduled-jobs-deny': 'Блокировка регламентных заданий включена',
        'sessions-deny': 'Блокировка начала сеансов включена',
        'denied-from': 'Начало',
        'denied-message': 'Сообщение',
        'denied-parameter': 'Параметр блокировки',
        'denied-to': 'Конец',
        'permission-code': 'Код разрешения',
        'external-session-manager-connection-string': 'Параметры внешнего управления сеансами',
        'external-session-manager-required': 'Обязательное использование внешнего управления сеансами',
        'reserve-working-processes': 'Резервирование рабочих процессов',
        'security-profile-name': 'Профиль безопасности информационной базы',
        'safe-mode-security-profile-name': 'Профиль безопасности внешнего кода',
        'disable-local-speech-to-text': 'Запретить локальное распознавание речи',
        'configuration-unload-delay-by-working-process-without-active-users': 'Задержка выгрузки конфигурации рабочим процессом без активных пользователей (секунды)',
        'minimum-scheduled-jobs-start-period-without-active-users': 'Минимальный период запуска регламентных заданий без активных пользователей (секунды)',
        'maximum-scheduled-jobs-start-shift-without-active-users': 'Максимальный сдвиг запуска регламентных заданий без активных пользователей (секунды)'
    };
    return paramNames[paramKey] || paramKey;
}

/**
 * Маппинг имени поля формы на имя параметра RAC для информационной базы
 */
function getInfobaseFormFieldName(paramKey) {
    const fieldMapping = {
        'name': 'name',
        'descr': 'descr',
        'dbms': 'dbms',
        'db-server': 'db_server',
        'db-name': 'db_name',
        'db-user': 'db_user',
        'security-level': 'security_level',
        'license-distribution': 'license_distribution',
        'scheduled-jobs-deny': 'scheduled_jobs_deny',
        'sessions-deny': 'sessions_deny',
        'denied-from': 'denied_from',
        'denied-message': 'denied_message',
        'denied-parameter': 'denied_parameter',
        'denied-to': 'denied_to',
        'permission-code': 'permission_code',
        'external-session-manager-connection-string': 'external_session_manager_connection_string',
        'external-session-manager-required': 'external_session_manager_required',
        'reserve-working-processes': 'reserve_working_processes',
        'security-profile-name': 'security_profile_name',
        'safe-mode-security-profile-name': 'safe_mode_security_profile_name',
        'disable-local-speech-to-text': 'disable_local_speech_to_text',
        'configuration-unload-delay-by-working-process-without-active-users': 'configuration_unload_delay_by_working_process_without_active_users',
        'minimum-scheduled-jobs-start-period-without-active-users': 'minimum_scheduled_jobs_start_period_without_active_users',
        'maximum-scheduled-jobs-start-shift-without-active-users': 'maximum_scheduled_jobs_start_shift_without_active_users'
    };
    return fieldMapping[paramKey] || paramKey.replace(/-/g, '_');
}

/**
 * Генерирует HTML для поля параметра информационной базы
 */
function generateInfobaseParamField(paramKey, paramValue) {
    const displayName = getInfobaseParamDisplayName(paramKey);
    const fieldName = getInfobaseFormFieldName(paramKey);
    
    // Пропускаем служебные поля, которые уже обработаны
    if (['infobase', 'name', 'descr', 'dbms', 'db-server', 'db-name', 'db-user'].includes(paramKey)) {
        return '';
    }
    
    // Определяем тип поля
    if (paramKey === 'license-distribution') {
        // Select для управления выдачей лицензий
        return `
            <div class="form-row" style="margin-bottom: 0.75rem;">
                <label>${escapeHtml(displayName)}:</label>
                <select id="${fieldName}" name="${fieldName}">
                    <option value="allow" ${paramValue === 'allow' ? 'selected' : ''}>Разрешена</option>
                    <option value="deny" ${paramValue === 'deny' ? 'selected' : ''}>Запрещена</option>
                </select>
            </div>
        `;
    } else if (paramKey === 'scheduled-jobs-deny' || paramKey === 'sessions-deny') {
        // Checkbox для блокировки (on/off)
        const isChecked = paramValue === 'on' || paramValue === 'yes' || paramValue === '1' || paramValue === 1 || paramValue === true;
        return `
            <div class="form-row" style="display: flex !important; flex-direction: row !important; align-items: center !important; gap: 0.5rem; margin-bottom: 0.75rem;">
                <label style="margin: 0 !important; white-space: nowrap; flex: 1 1 auto; text-align: left;">${escapeHtml(displayName)}:</label>
                <input type="checkbox" id="${fieldName}" name="${fieldName}" value="on" ${isChecked ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer; margin: 0 !important; flex-shrink: 0; padding: 0 !important;">
            </div>
        `;
    } else if (paramKey === 'external-session-manager-required' || paramKey === 'reserve-working-processes' || 
               paramKey === 'disable-local-speech-to-text') {
        // Select для yes/no
        const boolValue = paramValue === 'yes' || paramValue === '1' || paramValue === 1 || paramValue === true;
        return `
            <div class="form-row" style="margin-bottom: 0.75rem;">
                <label>${escapeHtml(displayName)}:</label>
                <select id="${fieldName}" name="${fieldName}">
                    <option value="yes" ${boolValue ? 'selected' : ''}>Да</option>
                    <option value="no" ${!boolValue ? 'selected' : ''}>Нет</option>
                </select>
            </div>
        `;
    } else if (paramKey === 'denied-from' || paramKey === 'denied-to') {
        // Datetime-local для полей даты/времени
        // Преобразуем формат из YYYY-MM-DDTHH:mm:ss в YYYY-MM-DDTHH:mm для datetime-local
        let datetimeValue = '';
        if (paramValue && paramValue.trim()) {
            // Если значение в формате YYYY-MM-DDTHH:mm:ss, убираем секунды
            const trimmedValue = paramValue.trim();
            if (trimmedValue.includes('T')) {
                // Формат может быть YYYY-MM-DDTHH:mm:ss или YYYY-MM-DDTHH:mm
                if (trimmedValue.length >= 19) {
                    // YYYY-MM-DDTHH:mm:ss - убираем секунды
                    datetimeValue = trimmedValue.substring(0, 16); // Берем первые 16 символов (YYYY-MM-DDTHH:mm)
                } else if (trimmedValue.length >= 16) {
                    // YYYY-MM-DDTHH:mm - уже правильный формат
                    datetimeValue = trimmedValue.substring(0, 16);
                } else {
                    datetimeValue = trimmedValue;
                }
            } else {
                datetimeValue = trimmedValue;
            }
        }
        return `
            <div class="form-row" style="margin-bottom: 0.75rem;">
                <label>${escapeHtml(displayName)}:</label>
                <input type="datetime-local" id="${fieldName}" name="${fieldName}" value="${escapeHtml(datetimeValue)}">
            </div>
        `;
    } else if (paramKey === 'security-level' || 
               paramKey === 'configuration-unload-delay-by-working-process-without-active-users' ||
               paramKey === 'minimum-scheduled-jobs-start-period-without-active-users' ||
               paramKey === 'maximum-scheduled-jobs-start-shift-without-active-users') {
        // Number для числовых значений
        return `
            <div class="form-row" style="margin-bottom: 0.75rem;">
                <label>${escapeHtml(displayName)}:</label>
                <input type="number" id="${fieldName}" name="${fieldName}" value="${escapeHtml(paramValue || '0')}" min="0">
            </div>
        `;
    } else {
        // Text для текстовых значений
        return `
            <div class="form-row" style="margin-bottom: 0.75rem;">
                <label>${escapeHtml(displayName)}:</label>
                <input type="text" id="${fieldName}" name="${fieldName}" value="${escapeHtml(paramValue || '')}">
            </div>
        `;
    }
}

/**
 * Генерирует HTML для блока "Блокировка начала сеансов"
 */
function generateInfobaseSessionDenyFields(infobaseParams) {
    // Порядок параметров в блоке
    const paramOrder = ['sessions-deny', 'scheduled-jobs-deny', 'denied-from', 'denied-to', 'denied-message', 'permission-code', 'denied-parameter'];
    
    let sessionDenyHtml = '';
    
    paramOrder.forEach(paramKey => {
        if (paramKey in infobaseParams) {
            sessionDenyHtml += generateInfobaseParamField(paramKey, infobaseParams[paramKey]);
        }
    });
    
    return sessionDenyHtml;
}

/**
 * Генерирует HTML для всех параметров информационной базы
 */
function generateInfobaseParamsFields(infobaseParams) {
    // Параметры, которые уже обработаны в других блоках
    const excludedParams = ['infobase', 'name', 'descr', 'dbms', 'db-server', 'db-name', 'db-user', 
                            'sessions-deny', 'scheduled-jobs-deny', 'denied-from', 'denied-to', 
                            'denied-message', 'permission-code', 'denied-parameter'];
    
    // Определяем порядок параметров (сначала основные, затем остальные)
    const paramOrder = [
        'security-level',
        'license-distribution',
        'external-session-manager-connection-string',
        'external-session-manager-required',
        'reserve-working-processes',
        'security-profile-name',
        'safe-mode-security-profile-name',
        'disable-local-speech-to-text',
        'configuration-unload-delay-by-working-process-without-active-users',
        'minimum-scheduled-jobs-start-period-without-active-users',
        'maximum-scheduled-jobs-start-shift-without-active-users'
    ];
    
    let paramsHtml = '';
    
    // Сначала добавляем параметры в нужном порядке
    paramOrder.forEach(paramKey => {
        if (paramKey in infobaseParams) {
            paramsHtml += generateInfobaseParamField(paramKey, infobaseParams[paramKey]);
        }
    });
    
    // Затем добавляем остальные параметры, которых нет в списке
    Object.keys(infobaseParams).forEach(paramKey => {
        if (!excludedParams.includes(paramKey) && !paramOrder.includes(paramKey)) {
            paramsHtml += generateInfobaseParamField(paramKey, infobaseParams[paramKey]);
        }
    });
    
    return paramsHtml;
}

/**
 * Маппинг параметров кластера на русские названия
 */
function getClusterParamDisplayName(paramKey) {
    const paramNames = {
        'name': 'Имя кластера',
        'expiration-timeout': 'Период принудительного завершения (секунды)',
        'lifetime-limit': 'Период перезапуска рабочих процессов (секунды)',
        'max-memory-size': 'Максимальный объем памяти (КБ)',
        'max-memory-time-limit': 'Максимальный период превышения памяти (секунды)',
        'security-level': 'Уровень безопасности',
        'session-fault-tolerance-level': 'Уровень отказоустойчивости',
        'load-balancing-mode': 'Режим распределения нагрузки',
        'errors-count-threshold': 'Допустимое отклонение ошибок (%)',
        'kill-problem-processes': 'Принудительно завершать проблемные процессы',
        'kill-by-memory-with-dump': 'Формировать дамп при превышении памяти',
        'allow-access-right-audit-events-recording': 'Разрешать запись событий аудита',
        'ping-period': 'Период отправки ping (миллисекунды)',
        'ping-timeout': 'Таймаут ping (миллисекунды)',
        'restart-schedule': 'Расписание перезапуска'
    };
    return paramNames[paramKey] || paramKey;
}

/**
 * Маппинг имени поля формы на имя параметра RAC
 */
function getClusterFormFieldName(paramKey) {
    const fieldMapping = {
        'name': 'name',
        'expiration-timeout': 'expiration_timeout',
        'lifetime-limit': 'lifetime_limit',
        'max-memory-size': 'max_memory_size',
        'max-memory-time-limit': 'max_memory_time_limit',
        'security-level': 'security_level',
        'session-fault-tolerance-level': 'session_fault_tolerance_level',
        'load-balancing-mode': 'load_balancing_mode',
        'errors-count-threshold': 'errors_count_threshold',
        'kill-problem-processes': 'kill_problem_processes',
        'kill-by-memory-with-dump': 'kill_by_memory_with_dump',
        'allow-access-right-audit-events-recording': 'allow_access_right_audit_events_recording',
        'ping-period': 'ping_period',
        'ping-timeout': 'ping_timeout',
        'restart-schedule': 'restart_schedule'
    };
    return fieldMapping[paramKey] || paramKey.replace(/-/g, '_');
}

/**
 * Генерирует HTML для поля параметра кластера
 */
function generateClusterParamField(paramKey, paramValue, cluster) {
    const displayName = getClusterParamDisplayName(paramKey);
    const fieldName = getClusterFormFieldName(paramKey);
    
    // Определяем тип поля
    if (paramKey === 'load-balancing-mode') {
        // Select для режима распределения нагрузки
        return `
            <div class="form-row">
                <label>${escapeHtml(displayName)}:</label>
                <select id="${fieldName}" name="${fieldName}">
                    <option value="performance" ${paramValue === 'performance' ? 'selected' : ''}>Приоритет по производительности</option>
                    <option value="memory" ${paramValue === 'memory' ? 'selected' : ''}>Приоритет по памяти</option>
                </select>
            </div>
        `;
    } else if (paramKey === 'kill-problem-processes' || paramKey === 'kill-by-memory-with-dump' || 
               paramKey === 'allow-access-right-audit-events-recording') {
        // Select для булевых значений
        const boolValue = paramValue === '1' || paramValue === 'yes' || paramValue === 1 || paramValue === true;
        return `
            <div class="form-row">
                <label>${escapeHtml(displayName)}:</label>
                <select id="${fieldName}" name="${fieldName}">
                    <option value="yes" ${boolValue ? 'selected' : ''}>Да</option>
                    <option value="no" ${!boolValue ? 'selected' : ''}>Нет</option>
                </select>
            </div>
        `;
    } else if (paramKey === 'restart-schedule') {
        // Text для расписания перезапуска
        return `
            <div class="form-row">
                <label>${escapeHtml(displayName)}:</label>
                <input type="text" id="${fieldName}" name="${fieldName}" value="${escapeHtml(paramValue || '')}">
            </div>
        `;
    } else {
        // Number для числовых значений
        return `
            <div class="form-row">
                <label>${escapeHtml(displayName)}:</label>
                <input type="number" id="${fieldName}" name="${fieldName}" value="${escapeHtml(paramValue || '0')}">
            </div>
        `;
    }
}

async function openClusterProperties(connectionId, clusterUuid, clusterName) {
    // Загружаем детальную информацию о кластере
    try {
        // Получаем учетные данные администратора кластера
        const clusterAdminParams = addClusterAdminParams('', connectionId, clusterUuid);
        const urlParams = new URLSearchParams(clusterAdminParams.substring(1));
        const url = `/api/clusters/clusters/${connectionId}/${clusterUuid}/?${urlParams.toString()}`;
        
        const response = await fetch(url);
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
        
        // Собираем все параметры из данных кластера (исключаем служебные поля)
        const excludedKeys = ['cluster', 'name', 'host', 'port'];
        const clusterParams = {};
        Object.keys(cluster).forEach(key => {
            if (!excludedKeys.includes(key)) {
                clusterParams[key] = cluster[key];
            }
        });
        
        // Определяем группы параметров
        const restartProcessesParams = ['restart-schedule', 'kill-problem-processes', 'kill-by-memory-with-dump'];
        const connectionTrackingParams = ['ping-period', 'ping-timeout'];
        
        // Параметры для основного блока (все остальные, кроме тех что в специальных блоках)
        const allGroupedParams = [...restartProcessesParams, ...connectionTrackingParams];
        
        // Генерируем HTML для блока "Перезапускать рабочие процессы"
        let restartProcessesHtml = '';
        restartProcessesParams.forEach(paramKey => {
            if (paramKey in clusterParams) {
                restartProcessesHtml += generateClusterParamField(paramKey, clusterParams[paramKey], cluster);
            }
        });
        
        // Генерируем HTML для блока "Отслеживание разрыва соединений"
        let connectionTrackingHtml = '';
        connectionTrackingParams.forEach(paramKey => {
            if (paramKey in clusterParams) {
                connectionTrackingHtml += generateClusterParamField(paramKey, clusterParams[paramKey], cluster);
            }
        });
        
        // Генерируем HTML для блока "Параметры кластера" (все остальные)
        let otherParamsHtml = '';
        Object.keys(clusterParams).forEach(paramKey => {
            if (!allGroupedParams.includes(paramKey)) {
                otherParamsHtml += generateClusterParamField(paramKey, clusterParams[paramKey], cluster);
            }
        });
        
        // Создаём модальное окно в стилистике системы
        const modal = document.createElement('div');
        modal.className = 'modal-overlay optimized';
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
                        ${restartProcessesHtml ? `
                        <div class="info-card">
                            <h4>🔄 Перезапускать рабочие процессы</h4>
                            ${restartProcessesHtml}
                        </div>
                        ` : ''}
                        ${connectionTrackingHtml ? `
                        <div class="info-card">
                            <h4>🔗 Отслеживание разрыва соединений</h4>
                            ${connectionTrackingHtml}
                        </div>
                        ` : ''}
                        ${otherParamsHtml ? `
                        <div class="info-card">
                            <h4>⚙️ Параметры кластера</h4>
                            ${otherParamsHtml}
                        </div>
                        ` : ''}
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
        
        // Получаем учетные данные администратора кластера
        const clusterAdminParams = addClusterAdminParams('', connectionId, clusterUuid);
        const urlParams = new URLSearchParams(clusterAdminParams.substring(1));
        const clusterAdmin = urlParams.get('cluster_admin');
        const clusterPassword = urlParams.get('cluster_password');
        
        // Добавляем учетные данные администратора кластера в тело запроса
        if (clusterAdmin) {
            data.cluster_admin = clusterAdmin;
        }
        if (clusterPassword) {
            data.cluster_password = clusterPassword;
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
    modal.className = 'modal-overlay optimized';
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

// Примечание: Функции showInfobaseContextMenu и showServerContextMenu перенесены 
// в connections-infobases.js и connections-servers.js соответственно

// Примечание: Функция closeContextMenu перенесена в connections-utils.js

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
    modal.className = 'modal-overlay optimized';
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
        
        // Добавляем учетные данные администратора кластера
        const adminParams = addClusterAdminParams('', connectionId, clusterUuid, 'POST');
        Object.assign(data, adminParams);
        
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
async function openInfobaseProperties(connectionId, clusterUuid, infobaseUuid, infobaseUser = null, infobasePwd = null) {
    closeContextMenu();
    
    // Если учетные данные не переданы, пытаемся загрузить сохраненные
    if (!infobaseUser) {
        const savedCredentials = loadInfobaseCredentialsFromStorage(connectionId, infobaseUuid);
        if (savedCredentials.user) {
            infobaseUser = savedCredentials.user;
            infobasePwd = savedCredentials.password || '';
        }
    }
    
    try {
        let url = `/api/clusters/infobases/${connectionId}/${clusterUuid}/info/?infobase=${infobaseUuid}`;
        if (infobaseUser) {
            url += `&infobase_user=${encodeURIComponent(infobaseUser)}`;
        }
        // Пароль может быть пустой строкой, передаем его всегда, если указан пользователь
        if (infobaseUser && infobasePwd !== null && infobasePwd !== undefined) {
            url += `&infobase_pwd=${encodeURIComponent(infobasePwd)}`;
        }
        
        // Добавляем учетные данные администратора кластера
        url = addClusterAdminParams(url, connectionId, clusterUuid);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success) {
            const errorText = (data.error || '').toLowerCase();
            const errorOriginal = data.error || '';
            
            // Проверяем, требуется ли ввод учетных данных
            // Проверяем как флаг из backend, так и текст ошибки напрямую
            // Упрощенная проверка: если есть "недостаточно прав" и упоминание информационной базы или пользователя
            const hasInsufficientRights = errorText.includes('недостаточно') && errorText.includes('прав');
            const hasUserOrInfobase = errorText.includes('пользователя') || 
                                     errorText.includes('информационную') || 
                                     errorText.includes('информационной');
            
            // Если backend явно указал requires_credentials, или мы видим признаки ошибки недостаточности прав
            let needsCredentials = data.requires_credentials === true || (hasInsufficientRights && hasUserOrInfobase);
            
            // Универсальная проверка: если в ошибке есть "недостаточно" и "прав" и упоминание базы или пользователя
            // Это должно сработать для текста "Недостаточно прав пользователя на информационную базу infobase_01"
            if (!needsCredentials && errorText) {
                const hasInsufficient = errorText.includes('недостаточно');
                const hasRights = errorText.includes('прав');
                const hasInfobase = errorText.includes('информационную') || errorText.includes('информационной') || errorText.includes('базу');
                const hasUser = errorText.includes('пользователя');
                
                // Если есть "недостаточно" и "прав" и (упоминание базы или пользователя)
                if (hasInsufficient && hasRights && (hasInfobase || hasUser)) {
                    needsCredentials = true;
                }
            }
            
            // Финальная проверка на всякий случай - если есть "недостаточно прав" в любом контексте с упоминанием базы
            if (!needsCredentials && errorText.includes('недостаточно') && errorText.includes('прав') && 
                (errorText.includes('базу') || errorText.includes('информационную') || errorText.includes('пользователя'))) {
                needsCredentials = true;
            }
            
            if (needsCredentials) {
                // Если использовались сохраненные данные и они не сработали, очищаем их
                if (infobaseUser) {
                    saveInfobaseCredentialsToStorage(connectionId, infobaseUuid, '', '');
                }
                
                // Показываем модальное окно для ввода учетных данных
                if (typeof showInfobaseCredentialsModal === 'function') {
                    showInfobaseCredentialsModal(connectionId, clusterUuid, infobaseUuid, errorOriginal);
                } else {
                    console.error('showInfobaseCredentialsModal function not found');
                    showNotification('❌ Ошибка загрузки свойств информационной базы: ' + errorOriginal + ' (требуются учетные данные)', true);
                }
                return false; // Возвращаем false при ошибке
            }
            
            showNotification('❌ Ошибка загрузки свойств информационной базы: ' + errorOriginal, true);
            return false; // Возвращаем false при ошибке
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
        
        // Собираем все параметры из данных информационной базы (исключаем служебные поля)
        const excludedKeys = ['infobase', 'name'];
        const infobaseParams = {};
        Object.keys(infobaseData).forEach(key => {
            if (!excludedKeys.includes(key)) {
                infobaseParams[key] = infobaseData[key];
            }
        });
        
        // Генерируем HTML для основных полей
        const basicInfoHtml = `
            <div class="form-row">
                <label>UUID информационной базы:</label>
                <input type="text" class="readonly-field" value="${escapeHtml(infobase.uuid || infobaseUuid)}" readonly>
            </div>
            <div class="form-row">
                <label>Имя информационной базы:</label>
                <input type="text" id="infobaseName" name="name" value="${escapeHtml(infobaseNameValue)}">
            </div>
            ${infobaseParams['descr'] !== undefined ? `
            <div class="form-row">
                <label>Описание:</label>
                <input type="text" id="infobaseDescr" name="descr" value="${escapeHtml(infobaseParams['descr'] || '')}">
            </div>
            ` : ''}
        `;
        
        // Генерируем HTML для блока "Блокировка начала сеансов"
        const sessionDenyHtml = generateInfobaseSessionDenyFields(infobaseParams);
        
        // Генерируем HTML для полей СУБД (только для чтения)
        const dbInfoHtml = `
            ${infobaseParams['dbms'] !== undefined ? `
            <div class="form-row">
                <label>Тип СУБД:</label>
                <input type="text" class="readonly-field" value="${escapeHtml(infobaseParams['dbms'] || '')}" readonly>
            </div>
            ` : ''}
            ${infobaseParams['db-server'] !== undefined ? `
            <div class="form-row">
                <label>Сервер баз данных:</label>
                <input type="text" class="readonly-field" value="${escapeHtml(infobaseParams['db-server'] || '')}" readonly>
            </div>
            ` : ''}
            ${infobaseParams['db-name'] !== undefined ? `
            <div class="form-row">
                <label>Имя базы данных:</label>
                <input type="text" class="readonly-field" value="${escapeHtml(infobaseParams['db-name'] || '')}" readonly>
            </div>
            ` : ''}
            ${infobaseParams['db-user'] !== undefined ? `
            <div class="form-row">
                <label>Пользователь базы данных:</label>
                <input type="text" class="readonly-field" value="${escapeHtml(infobaseParams['db-user'] || '')}" readonly>
            </div>
            ` : ''}
        `;
        
        // Генерируем HTML для остальных параметров
        const otherParamsHtml = generateInfobaseParamsFields(infobaseParams);
        
        // Удаляем предыдущее модальное окно если есть
        const existingModal = document.getElementById('infobasePropertiesModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Сохраняем учетные данные в localStorage при успешной загрузке
        if (infobaseUser) {
            saveInfobaseCredentialsToStorage(connectionId, infobaseUuid, infobaseUser, infobasePwd || '');
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay optimized';
        modal.id = 'infobasePropertiesModal';
        // Сохраняем учетные данные в data-атрибутах для использования при сохранении
        modal.setAttribute('data-infobase-user', infobaseUser || '');
        modal.setAttribute('data-infobase-pwd', infobasePwd || '');
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
                            ${basicInfoHtml}
                        </div>
                        ${sessionDenyHtml ? `
                        <div class="info-card">
                            <h4>🚫 Блокировка начала сеансов</h4>
                            ${sessionDenyHtml}
                        </div>
                        ` : ''}
                        ${dbInfoHtml.trim() ? `
                        <div class="info-card">
                            <h4>📊 Основная информация СУБД</h4>
                            ${dbInfoHtml}
                        </div>
                        ` : ''}
                        ${otherParamsHtml ? `
                        <div class="info-card">
                            <h4>⚙️ Параметры информационной базы</h4>
                            ${otherParamsHtml}
                        </div>
                        ` : ''}
                        <div class="form-actions" style="margin-top: 1.5rem;">
                            <button type="button" class="btn btn-secondary" onclick="closeInfobasePropertiesModal()">Отмена</button>
                            <button type="button" class="btn btn-primary" onclick="saveInfobaseProperties('${connectionId}', '${clusterUuid}', '${infobaseUuid}', '${infobaseUser || ''}', '${infobasePwd || ''}')">Сохранить</button>
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
async function saveInfobaseProperties(connectionId, clusterUuid, infobaseUuid, infobaseUser = null, infobasePwd = null) {
    const form = document.getElementById('infobasePropertiesForm');
    if (!form) return;
    
    // Если учетные данные не переданы, пытаемся получить их из модального окна
    if (!infobaseUser) {
        const modal = document.getElementById('infobasePropertiesModal');
        if (modal) {
            infobaseUser = modal.getAttribute('data-infobase-user') || null;
            infobasePwd = modal.getAttribute('data-infobase-pwd') || null;
        }
    }
    
    const formData = new FormData(form);
    const data = {
        infobase_uuid: infobaseUuid
    };
    
    // Сначала обрабатываем чекбоксы (они могут не попасть в FormData если не отмечены)
    const scheduledJobsDenyCheckbox = form.querySelector('[name="scheduled_jobs_deny"]');
    const sessionsDenyCheckbox = form.querySelector('[name="sessions_deny"]');
    if (scheduledJobsDenyCheckbox) {
        data.scheduled_jobs_deny = scheduledJobsDenyCheckbox.checked ? 'on' : 'off';
    }
    if (sessionsDenyCheckbox) {
        data.sessions_deny = sessionsDenyCheckbox.checked ? 'on' : 'off';
    }
    
    // Собираем данные формы
    for (let [key, value] of formData.entries()) {
        // Пропускаем чекбоксы, они уже обработаны выше
        if (key === 'scheduled_jobs_deny' || key === 'sessions_deny') {
            continue;
        }
        
        // Для полей даты обрабатываем отдельно (могут быть пустыми для очистки)
        if (key === 'denied_from' || key === 'denied_to') {
            const trimmedValue = value ? value.trim() : '';
            // Если значение пустое, передаем пустую строку для очистки даты на сервере
            if (!trimmedValue) {
                data[key] = ''; // Передаем пустую строку для очистки
                continue;
            }
            // Преобразуем формат даты из YYYY-MM-DDTHH:mm (datetime-local) в YYYY-MM-DDTHH:mm:ss
            // datetime-local всегда возвращает формат YYYY-MM-DDTHH:mm (16 символов)
            if (trimmedValue.includes('T')) {
                if (trimmedValue.length === 16) {
                    // YYYY-MM-DDTHH:mm - добавляем :00 для секунд
                    data[key] = trimmedValue + ':00';
                } else if (trimmedValue.length === 19 && trimmedValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
                    // YYYY-MM-DDTHH:mm:ss - уже правильный формат (19 символов)
                    data[key] = trimmedValue;
                } else {
                    // Другой формат - пытаемся исправить или передаем как есть
                    // Если есть только один двоеточие, добавляем секунды
                    if (trimmedValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
                        data[key] = trimmedValue + ':00';
                    } else {
                        data[key] = trimmedValue;
                    }
                }
            } else {
                // Если нет 'T', это не правильный формат datetime
                // Передаем пустую строку для очистки
                data[key] = '';
            }
        } else if (value) {
            // Для остальных полей передаем только непустые значения
            data[key] = value;
        }
    }
    
    // Добавляем учетные данные администратора ИБ, если они были указаны
    if (infobaseUser) {
        data.infobase_user = infobaseUser;
    }
    if (infobasePwd !== null && infobasePwd !== undefined) {
        data.infobase_pwd = infobasePwd;
    }
    
    // Добавляем учетные данные администратора кластера
    const adminParams = addClusterAdminParams('', connectionId, clusterUuid, 'POST');
    Object.assign(data, adminParams);
    
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
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Update infobase error:', errorText);
            showNotification('❌ Ошибка обновления информационной базы: HTTP ' + response.status, true);
            return;
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const errorText = await response.text();
            console.error('Update infobase non-JSON response:', errorText);
            showNotification('❌ Ошибка обновления информационной базы: Неверный формат ответа', true);
            return;
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Сохраняем учетные данные в localStorage при успешном сохранении
            if (infobaseUser) {
                saveInfobaseCredentialsToStorage(connectionId, infobaseUuid, infobaseUser, infobasePwd || '');
            }
            
            showNotification('✅ Параметры информационной базы успешно обновлены', false);
            closeInfobasePropertiesModal();
            // Обновляем дерево
            const clusterId = `cluster-${connectionId}-${clusterUuid}`;
            const sectionId = `infobases-${clusterId}`;
            await loadInfobasesIntoTree(connectionId, clusterUuid, sectionId);
        } else {
            const errorText = (result.error || '').toLowerCase();
            const errorOriginal = result.error || '';
            
            // Проверяем, требуется ли ввод учетных данных
            const hasInsufficientRights = errorText.includes('недостаточно') && errorText.includes('прав');
            const hasUserOrInfobase = errorText.includes('пользователя') || 
                                     errorText.includes('информационную') || 
                                     errorText.includes('информационной');
            
            let needsCredentials = result.requires_credentials === true || (hasInsufficientRights && hasUserOrInfobase);
            
            // Универсальная проверка
            if (!needsCredentials && errorText) {
                const hasInsufficient = errorText.includes('недостаточно');
                const hasRights = errorText.includes('прав');
                const hasInfobase = errorText.includes('информационную') || errorText.includes('информационной') || errorText.includes('базу');
                const hasUser = errorText.includes('пользователя');
                
                if (hasInsufficient && hasRights && (hasInfobase || hasUser)) {
                    needsCredentials = true;
                }
            }
            
            if (needsCredentials) {
                // Показываем модальное окно для ввода учетных данных
                if (typeof showInfobaseCredentialsModal === 'function') {
                    showInfobaseCredentialsModal(connectionId, clusterUuid, infobaseUuid, errorOriginal, true);
                } else {
                    showNotification('❌ Ошибка обновления информационной базы: ' + errorOriginal + ' (требуются учетные данные)', true);
                }
                return;
            }
            
            showNotification('❌ Ошибка обновления информационной базы: ' + errorOriginal, true);
        }
    } catch (error) {
        showNotification('❌ Ошибка сохранения: ' + error.message, true);
    }
}

/**
 * Закрывает модальное окно свойств информационной базы
 */
/**
 * Получить ключ для хранения учетных данных администратора ИБ в localStorage
 */
function getInfobaseCredentialsStorageKey(connectionId, infobaseUuid) {
    return `infobase_credentials_${connectionId}_${infobaseUuid}`;
}

/**
 * Сохранить учетные данные администратора ИБ в localStorage
 */
function saveInfobaseCredentialsToStorage(connectionId, infobaseUuid, user, password) {
    const key = getInfobaseCredentialsStorageKey(connectionId, infobaseUuid);
    const data = {
        user: user || '',
        password: password || ''
    };
    localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Загрузить учетные данные администратора ИБ из localStorage
 */
function loadInfobaseCredentialsFromStorage(connectionId, infobaseUuid) {
    const key = getInfobaseCredentialsStorageKey(connectionId, infobaseUuid);
    const stored = localStorage.getItem(key);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Ошибка парсинга данных из localStorage:', e);
        }
    }
    return { user: '', password: '' };
}

/**
 * Показать модальное окно для ввода учетных данных администратора ИБ
 */
function showInfobaseCredentialsModal(connectionId, clusterUuid, infobaseUuid, errorMessage, isUpdate = false) {
    // Загружаем сохраненные учетные данные
    const savedCredentials = loadInfobaseCredentialsFromStorage(connectionId, infobaseUuid);
    const savedUser = savedCredentials.user || '';
    const savedPwd = savedCredentials.password || '';
    
    const modalHtml = `
        <div class="modal-overlay optimized" id="infobaseCredentialsModal" style="z-index: 10010;">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>🔐 Учетные данные администратора ИБ</h3>
                    <button class="modal-close-btn" onclick="closeInfobaseCredentialsModal()">×</button>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 1rem; padding: 0.75rem; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
                        <strong>⚠️ Требуется аутентификация</strong>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; color: #856404;">
                            ${escapeHtml(errorMessage || 'Недостаточно прав пользователя на информационную базу')}
                        </p>
                        <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; color: #856404;">
                            Введите учетные данные администратора информационной базы для доступа к свойствам.
                        </p>
                    </div>
                    <div class="edit-form">
                        <div class="form-row">
                            <label for="infobaseUserInput">Имя администратора ИБ</label>
                            <input type="text" id="infobaseUserInput" placeholder="Администратор" autocomplete="username" value="${escapeHtml(savedUser)}">
                        </div>
                        <div class="form-row">
                            <label for="infobasePwdInput">Пароль администратора ИБ</label>
                            <input type="password" id="infobasePwdInput" placeholder="Введите пароль" autocomplete="current-password" ${savedPwd ? 'value="********" data-was-changed="false"' : ''}>
                            ${savedPwd ? '<small style="color: #666; font-size: 0.85rem; margin-top: 0.25rem;">Используется сохраненный пароль. Введите новый, если нужно изменить.</small>' : ''}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" onclick="submitInfobaseCredentials(${connectionId}, '${clusterUuid}', '${infobaseUuid}', ${isUpdate ? 'true' : 'false'})">
                        🔓 Войти
                    </button>
                    <button class="btn" onclick="closeInfobaseCredentialsModal()" style="background: #6c757d; color: white;">
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) {
        modalContainer.insertAdjacentHTML('beforeend', modalHtml);
    } else {
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    // Фокус на поле ввода пользователя
    setTimeout(() => {
        const userInput = document.getElementById('infobaseUserInput');
        const pwdInput = document.getElementById('infobasePwdInput');
        if (userInput) {
            userInput.focus();
        }
        
        // Отслеживаем изменение пароля (если он был предзаполнен звездочками)
        if (pwdInput && savedPwd) {
            pwdInput.addEventListener('input', function() {
                if (this.value !== '********') {
                    this.dataset.wasChanged = 'true';
                } else {
                    this.dataset.wasChanged = 'false';
                }
            });
        }
        
        // Обработка Enter для отправки формы
        if (userInput) {
            userInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (pwdInput) {
                        pwdInput.focus();
                    }
                }
            });
        }
        
        if (pwdInput) {
            pwdInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    submitInfobaseCredentials(connectionId, clusterUuid, infobaseUuid, isUpdate);
                }
            });
        }
    }, 100);
}

/**
 * Закрыть модальное окно ввода учетных данных ИБ
 */
function closeInfobaseCredentialsModal() {
    const modal = document.getElementById('infobaseCredentialsModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Отправить учетные данные и повторить запрос
 */
async function submitInfobaseCredentials(connectionId, clusterUuid, infobaseUuid, isUpdate = false) {
    const infobaseUserInput = document.getElementById('infobaseUserInput');
    const infobasePwdInput = document.getElementById('infobasePwdInput');
    
    const infobaseUser = infobaseUserInput ? infobaseUserInput.value.trim() : '';
    let infobasePwd = infobasePwdInput ? infobasePwdInput.value : '';
    
    if (!infobaseUser) {
        showNotification('❌ Введите имя администратора ИБ', true);
        return;
    }
    
    // Если пароль содержит только звездочки (сохраненный пароль не был изменен),
    // загружаем сохраненный пароль
    if (infobasePwd === '********') {
        const savedCredentials = loadInfobaseCredentialsFromStorage(connectionId, infobaseUuid);
        infobasePwd = savedCredentials.password || '';
    }
    
    // Пароль может быть пустым, если в базе нет пароля для администраторской УЗ
    
    // Закрываем модальное окно ввода учетных данных
    closeInfobaseCredentialsModal();
    
    if (isUpdate) {
        // Если это обновление, вызываем сохранение с учетными данными
        await saveInfobaseProperties(connectionId, clusterUuid, infobaseUuid, infobaseUser, infobasePwd);
        // Сохраняем учетные данные при успешном обновлении
        // (сохранение произойдет после успешного ответа в saveInfobaseProperties)
    } else {
        // Если это открытие свойств, повторяем запрос с учетными данными
        const success = await openInfobaseProperties(connectionId, clusterUuid, infobaseUuid, infobaseUser, infobasePwd);
        // Сохраняем учетные данные только при успешном открытии
        // (сохранение произойдет внутри openInfobaseProperties после успешного ответа)
    }
}

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
    modal.className = 'modal-overlay optimized';
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
        
        // Добавляем учетные данные администратора кластера
        const adminParams = addClusterAdminParams('', connectionId, clusterUuid, 'POST');
        const requestData = {
            infobase_uuid: infobaseUuid,
            drop_database: dropDatabase,
            clear_database: clearDatabase,
            ...adminParams
        };
        
        const response = await fetch(`/api/clusters/infobases/${connectionId}/${clusterUuid}/drop/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(requestData)
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
    modal.className = 'modal-overlay optimized';
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
        
        // Добавляем учетные данные администратора кластера
        const adminParams = addClusterAdminParams('', connectionId, clusterUuid, 'POST');
        Object.assign(data, adminParams);
        
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
        let url = `/api/clusters/servers/${connectionId}/${clusterUuid}/${serverUuid}/info/`;
        url = addClusterAdminParams(url, connectionId, clusterUuid);
        const response = await fetch(url);
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
        modal.className = 'modal-overlay optimized';
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
        
        // Добавляем учетные данные администратора кластера
        const adminParams = addClusterAdminParams('', connectionId, clusterUuid, 'POST');
        Object.assign(data, adminParams);
        
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
        
        // Добавляем учетные данные администратора кластера
        const adminParams = addClusterAdminParams('', connectionId, clusterUuid, 'POST');
        
        const response = await fetch(`/api/clusters/servers/${connectionId}/${clusterUuid}/${serverUuid}/remove/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(adminParams)
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
async function openProcessesModal(connectionId, clusterUuid, serverUuid = null, serverName = null) {
    closeContextMenu();
    
    // Удаляем предыдущее модальное окно если есть
    const existingModal = document.getElementById('processesModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Формируем заголовок
    let title = '🔄 Рабочие процессы';
    if (serverUuid && serverName) {
        title += ` (фильтр по серверу: ${escapeHtml(serverName)})`;
    } else if (serverUuid) {
        title += ' (фильтр по серверу)';
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay optimized';
    modal.id = 'processesModal';
    modal.style.zIndex = '10001';
    modal.innerHTML = `
        <div class="modal" style="max-width: 95vw; max-height: 95vh; width: 95vw; height: 95vh; display: flex; flex-direction: column;">
            <div class="modal-header" style="flex-shrink: 0;">
                <h3>${title}</h3>
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
        
        // Добавляем учетные данные администратора кластера
        url = addClusterAdminParams(url, connectionId, clusterUuid);
        
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
/**
 * Получить отображаемое имя столбца процесса
 */
function getProcessColumnDisplayName(key) {
    const columnNames = {
        'host': 'Компьютер',
        'port': 'Порт',
        'use': 'Использование',
        'turned-on': 'Включён',
        'running': 'Активен',
        'reserve': 'Резервный',
        'pid': 'PID',
        'available-perfomance': 'Дост.произв.',
        'process': 'UUID процесса'
    };
    return columnNames[key] || key;
}

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
    
    // Определяем столбцы по умолчанию (в нужном порядке)
    const defaultColumns = ['host', 'port', 'use', 'turned-on', 'running', 'reserve', 'pid', 'available-perfomance'];
    
    // Получаем сохраненное состояние видимости столбцов
    // По умолчанию показываем только нужные столбцы
    if (!window._processesVisibleColumns) {
        // Фильтруем только те столбцы, которые существуют в данных
        const availableDefaultColumns = defaultColumns.filter(col => sortedKeys.includes(col));
        window._processesVisibleColumns = new Set(availableDefaultColumns);
    }
    const visibleColumns = window._processesVisibleColumns;
    
    // Проверяем, есть ли видимые столбцы
    const hasVisibleColumns = visibleColumns.size > 0;
    
    // Получаем сохраненный порядок столбцов
    const columnOrderKey = `processes_column_order_${connectionId}_${clusterUuid}`;
    let columnOrder = JSON.parse(localStorage.getItem(columnOrderKey) || 'null');
    if (!columnOrder || !Array.isArray(columnOrder)) {
        // Используем порядок по умолчанию, фильтруя только видимые столбцы
        const defaultOrder = defaultColumns.filter(col => visibleColumns.has(col) && sortedKeys.includes(col));
        // Добавляем остальные видимые столбцы в конец
        sortedKeys.forEach(k => {
            if (visibleColumns.has(k) && !defaultOrder.includes(k)) {
                defaultOrder.push(k);
            }
        });
        columnOrder = defaultOrder;
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
                        <div style="font-weight: 600; word-wrap: break-word; white-space: normal;">${escapeHtml(getProcessColumnDisplayName(key))}</div>
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
                <tr class="process-row" data-process-uuid="${process.uuid}" data-index="${index}" style="cursor: pointer;" oncontextmenu="showProcessContextMenu(event, ${connectionId}, '${clusterUuid}', '${process.uuid}'); return false;">
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
 * Показать контекстное меню для процесса
 */
function showProcessContextMenu(event, connectionId, clusterUuid, processUuid) {
    event.preventDefault();
    event.stopPropagation();
    
    const existingMenu = document.getElementById('processContextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.id = 'processContextMenu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.style.zIndex = '10010';
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="openProcessInfoModal(${connectionId}, '${clusterUuid}', '${processUuid}'); closeContextMenu();">
            📋 Свойства
        </div>
        <div class="context-menu-item" onclick="turnOffProcess(${connectionId}, '${clusterUuid}', '${processUuid}'); closeContextMenu();">
            ⛔ Выключить
        </div>
    `;
    
    document.body.appendChild(menu);
    
    // Закрытие меню при клике вне его
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

/**
 * Выключить рабочий процесс
 */
async function turnOffProcess(connectionId, clusterUuid, processUuid) {
    // Показываем модальное окно подтверждения
    const confirmed = await showConfirmModal(
        'Вы уверены что хотите выключить рабочий процесс?',
        'Подтверждение выключения процесса'
    );
    
    if (!confirmed) {
        return;
    }
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден. Обновите страницу.', true);
            return;
        }
        
        // Получаем учетные данные администратора кластера
        const clusterAdminParams = addClusterAdminParams('', connectionId, clusterUuid);
        const urlParams = new URLSearchParams(clusterAdminParams.substring(1)); // Убираем первый '?'
        
        const requestBody = {
            process_uuid: processUuid
        };
        
        // Добавляем учетные данные администратора кластера в тело запроса
        const clusterAdmin = urlParams.get('cluster_admin');
        const clusterPassword = urlParams.get('cluster_password');
        if (clusterAdmin) {
            requestBody.cluster_admin = clusterAdmin;
        }
        if (clusterPassword) {
            requestBody.cluster_password = clusterPassword;
        }
        
        const response = await fetch(`/api/clusters/processes/${connectionId}/${clusterUuid}/turn-off/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Рабочий процесс выключен успешно');
            // Обновляем таблицу процессов
            const serverUuid = window._currentProcessesServerUuid || null;
            await refreshProcessesTable(connectionId, clusterUuid, serverUuid);
        } else {
            showNotification('❌ Ошибка выключения процесса: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
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
    modal.className = 'modal-overlay optimized';
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
        let url = `/api/clusters/processes/${connectionId}/${clusterUuid}/info/?process=${processUuid}`;
        url = addClusterAdminParams(url, connectionId, clusterUuid);
        const response = await fetch(url);
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
    
    // Заголовки (используем маппинг имен столбцов)
    const headers = [];
    const columnOrder = window._processesColumnOrder || sortedKeys;
    
    // Используем сохраненный порядок столбцов
    columnOrder.forEach(key => {
        if (visibleColumns.has(key)) {
            headers.push(getProcessColumnDisplayName(key));
        }
    });
    
    // Используем точку с запятой как разделитель для лучшей совместимости с Excel
    const separator = ';';
    
    csv += headers.map(h => h.replace(/"/g, '""')).join(separator) + '\n';
    
    // Данные (используем тот же порядок что и в заголовках)
    processes.forEach(process => {
        const row = [];
        columnOrder.forEach(key => {
            if (visibleColumns.has(key)) {
                let value = '';
                if (key === 'process') {
                    value = process.uuid || '';
                } else {
                    value = process.data[key] || '';
                }
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
    modal.className = 'modal-overlay optimized modal-full-screen';
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
        let url = `/api/clusters/managers/${connectionId}/?cluster=${clusterUuid}`;
        url = addClusterAdminParams(url, connectionId, clusterUuid);
        const response = await fetch(url);
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
/**
 * Получить отображаемое имя столбца менеджера
 */
function getManagerColumnDisplayName(key) {
    const columnNames = {
        'host': 'Компьютер',
        'descr': 'Описание',
        'pid': 'PID',
        'port': 'IP Порт',
        'manager': 'UUID менеджера'
    };
    return columnNames[key] || key;
}

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
    
    // Определяем столбцы по умолчанию (в нужном порядке)
    const defaultColumns = ['host', 'descr', 'pid', 'port'];
    
    // Получаем сохраненное состояние видимости столбцов
    // По умолчанию показываем только нужные столбцы
    if (!window._managersVisibleColumns) {
        // Фильтруем только те столбцы, которые существуют в данных
        const availableDefaultColumns = defaultColumns.filter(col => sortedKeys.includes(col));
        window._managersVisibleColumns = new Set(availableDefaultColumns);
    }
    const visibleColumns = window._managersVisibleColumns;
    
    // Проверяем, есть ли видимые столбцы
    const hasVisibleColumns = visibleColumns.size > 0;
    
    // Получаем сохраненный порядок столбцов
    const columnOrderKey = `managers_column_order_${connectionId}_${clusterUuid}`;
    let columnOrder = JSON.parse(localStorage.getItem(columnOrderKey) || 'null');
    if (!columnOrder || !Array.isArray(columnOrder)) {
        // Используем порядок по умолчанию, фильтруя только видимые столбцы
        const defaultOrder = defaultColumns.filter(col => visibleColumns.has(col) && sortedKeys.includes(col));
        // Добавляем остальные видимые столбцы в конец
        sortedKeys.forEach(k => {
            if (visibleColumns.has(k) && !defaultOrder.includes(k)) {
                defaultOrder.push(k);
            }
        });
        columnOrder = defaultOrder;
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
                        <div style="font-weight: 600; word-wrap: break-word; white-space: normal;">${escapeHtml(getManagerColumnDisplayName(key))}</div>
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
    modal.className = 'modal-overlay optimized';
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
        let url = `/api/clusters/managers/${connectionId}/${clusterUuid}/info/?manager=${managerUuid}`;
        url = addClusterAdminParams(url, connectionId, clusterUuid);
        const response = await fetch(url);
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
    
    // Заголовки (используем маппинг имен столбцов)
    const headers = [];
    const columnOrder = window._managersColumnOrder || sortedKeys;
    
    // Используем сохраненный порядок столбцов
    columnOrder.forEach(key => {
        if (visibleColumns.has(key)) {
            headers.push(getManagerColumnDisplayName(key));
        }
    });
    // Используем точку с запятой как разделитель для лучшей совместимости с Excel
    const separator = ';';
    
    csv += headers.map(h => h.replace(/"/g, '""')).join(separator) + '\n';
    
    // Данные (используем тот же порядок что и в заголовках)
    managers.forEach(manager => {
        const row = [];
        columnOrder.forEach(key => {
            if (visibleColumns.has(key)) {
                let value = '';
                if (key === 'manager') {
                    value = manager.uuid || '';
                } else {
                    value = manager.data[key] || '';
                }
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

// ============================================
// Агенты кластера
// ============================================

/**
 * Показать таблицу агентов кластера
 */
async function showAgentsTable(connectionId) {
    const contentArea = document.getElementById('contentArea');
    contentArea.innerHTML = '<div style="text-align: center; padding: 2rem;"><p>⏳ Загрузка агентов...</p></div>';
    
    try {
        const response = await fetch(`/api/clusters/agents/${connectionId}/`);
        const data = await response.json();
        
        if (data.success) {
            renderAgentsTable(data.agents || [], connectionId);
        } else {
            contentArea.innerHTML = `
                <div class="info-card" style="border-left: 4px solid var(--primary-color);">
                    <h4 style="color: var(--primary-color);">❌ Ошибка</h4>
                    <p style="color: #721c24; margin: 0;">${data.error || 'Неизвестная ошибка'}</p>
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
 * Отрисовать таблицу агентов
 */
function renderAgentsTable(agents, connectionId) {
    const contentArea = document.getElementById('contentArea');
    
    let html = `
        <div class="info-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="margin: 0;">🤖 Администраторы агента кластера</h4>
                <button class="btn btn-primary" onclick="openCreateAgentModal(${connectionId})">
                    + Создать
                </button>
            </div>
            <div id="agentsTableContainer">
    `;
    
    if (agents.length === 0) {
        html += `
            <div style="padding: 1rem; text-align: center; color: #666;">
                <p>Агентов кластера нету</p>
            </div>
        `;
    } else {
        html += `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Имя</th>
                        <th>Аутентификация</th>
                        <th>Описание</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        agents.forEach(agent => {
            html += `
                <tr style="cursor: pointer;" 
                    oncontextmenu="showAgentContextMenu(event, ${connectionId}, '${escapeHtml(agent.name || '').replace(/'/g, "\\'")}'); return false;">
                    <td><strong>${escapeHtml(agent.name || '—')}</strong></td>
                    <td>${escapeHtml(agent.auth || '—')}</td>
                    <td>${escapeHtml(agent.descr || '—')}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
    }
    
    html += `
            </div>
        </div>
    `;
    
    contentArea.innerHTML = html;
}

/**
 * Открыть модальное окно создания агента
 */
function openCreateAgentModal(connectionId) {
    const modalHtml = `
        <div class="modal-overlay optimized" id="createAgentModal">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>➕ Создать администратора агента</h3>
                    <button class="modal-close-btn" onclick="closeModal('createAgentModal')">×</button>
                </div>
                <div class="modal-body">
                    <div class="info-card">
                        <h4 style="border-bottom-color: var(--primary-color);">📝 Данные администратора</h4>
                        <div class="edit-form">
                            <div class="form-row">
                                <label for="agentName">Имя *</label>
                                <input type="text" id="agentName" placeholder="admin">
                            </div>
                            <div class="form-row">
                                <label for="agentPwd">Пароль</label>
                                <input type="password" id="agentPwd" placeholder="••••••••">
                            </div>
                            <div class="form-row">
                                <label for="agentDescr">Описание</label>
                                <input type="text" id="agentDescr" placeholder="Описание администратора">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal('createAgentModal')">Отмена</button>
                    <button class="btn btn-primary" onclick="saveAgent(${connectionId})">Создать</button>
                </div>
            </div>
        </div>
    `;
    
    const container = document.getElementById('modal-container');
    container.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Сохранить агента
 */
async function saveAgent(connectionId) {
    const name = document.getElementById('agentName')?.value;
    const pwd = document.getElementById('agentPwd')?.value || '';
    const descr = document.getElementById('agentDescr')?.value || '';
    
    if (!name) {
        showNotification('❌ Имя обязательно', true);
        return;
    }
    
    try {
        const response = await fetch(`/api/clusters/agents/${connectionId}/create/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ name, pwd, descr })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Администратор агента создан');
            closeModal('createAgentModal');
            showAgentsTable(connectionId);
        } else {
            showNotification('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

/**
 * Показать контекстное меню для агента
 */
function showAgentContextMenu(event, connectionId, agentName) {
    event.preventDefault();
    event.stopPropagation();
    
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu) {
        contextMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.id = 'contextMenu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.style.zIndex = '10000';
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="deleteAgent(${connectionId}, '${agentName.replace(/'/g, "\\'")}'); closeContextMenu();">
            Удалить
        </div>
    `;
    
    document.body.appendChild(menu);
    
    // Закрываем меню при клике вне его
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            closeContextMenu();
            document.removeEventListener('click', closeMenu);
        });
    }, 0);
}

/**
 * Удалить агента
 */
async function deleteAgent(connectionId, agentName) {
    if (!confirm(`Вы уверены, что хотите удалить администратора агента "${agentName}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/clusters/agents/${connectionId}/delete/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ name: agentName })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Администратор агента удален');
            showAgentsTable(connectionId);
        } else {
            showNotification('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

// ============================================
// Администраторы кластера
// ============================================

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
    
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu) {
        contextMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.id = 'contextMenu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    menu.style.zIndex = '10000';
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="deleteClusterAdmin(${connectionId}, '${clusterUuid}', '${adminName.replace(/'/g, "\\'")}'); closeContextMenu();">
            Удалить
        </div>
    `;
    
    document.body.appendChild(menu);
    
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            closeContextMenu();
            document.removeEventListener('click', closeMenu);
        });
    }, 0);
}

/**
 * Открыть модальное окно создания администратора кластера
 */
async function openCreateClusterAdminModal(connectionId, clusterUuid) {
    // Проверяем, есть ли уже администраторы
    let isFirstAdmin = false;
    try {
        const url = addClusterAdminParams(`/api/clusters/admins/${connectionId}/${clusterUuid}/`, connectionId, clusterUuid);
        const response = await fetch(url);
        const data = await response.json();
        if (data.success && (!data.admins || data.admins.length === 0)) {
            isFirstAdmin = true;
        }
    } catch (error) {
        console.error('Error checking admins:', error);
    }
    
    // Проверяем, есть ли уже сохраненные данные администратора для этого кластера в localStorage
    const storedCredentials = getClusterAdminCredentials(connectionId, clusterUuid);
    const hasClusterAuth = !!(storedCredentials.admin);
    
    const modalHtml = `
        <div class="modal-overlay optimized" id="createClusterAdminModal">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>➕ Создать администратора кластера</h3>
                    <button class="modal-close-btn" onclick="closeModal('createClusterAdminModal')">×</button>
                </div>
                <div class="modal-body">
                    <div class="info-card">
                        <h4 style="border-bottom-color: var(--primary-color);">📝 Данные администратора</h4>
                        <div class="edit-form">
                            <div class="form-row">
                                <label for="clusterAdminName">Имя *</label>
                                <input type="text" id="clusterAdminName" placeholder="admin">
                            </div>
                            <div class="form-row">
                                <label for="clusterAdminPwd">Пароль</label>
                                <input type="password" id="clusterAdminPwd" placeholder="••••••••">
                            </div>
                            <div class="form-row">
                                <label for="clusterAdminDescr">Описание</label>
                                <input type="text" id="clusterAdminDescr" placeholder="Описание администратора">
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal('createClusterAdminModal')">Отмена</button>
                    <button class="btn btn-primary" onclick="saveClusterAdmin(${connectionId}, '${clusterUuid}', ${isFirstAdmin}, ${hasClusterAuth})">Создать</button>
                </div>
            </div>
        </div>
    `;
    
    const container = document.getElementById('modal-container');
    container.insertAdjacentHTML('beforeend', modalHtml);
    
    // Больше не показываем confirm здесь - предложение будет в отдельном модальном окне после создания
}

/**
 * Сохранить администратора кластера
 */
async function saveClusterAdmin(connectionId, clusterUuid, isFirstAdmin, hasClusterAuth) {
    const name = document.getElementById('clusterAdminName')?.value;
    const pwd = document.getElementById('clusterAdminPwd')?.value || '';
    const descr = document.getElementById('clusterAdminDescr')?.value || '';
    
    if (!name) {
        showNotification('❌ Имя обязательно', true);
        return;
    }
    
    const shouldSaveToConnection = document.getElementById('createClusterAdminModal')?.getAttribute('data-save-to-connection') === 'true';
    
    try {
        const adminParams = addClusterAdminParams('', connectionId, clusterUuid, 'POST');
        const response = await fetch(`/api/clusters/admins/${connectionId}/${clusterUuid}/create/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ 
                name, 
                pwd, 
                descr,
                is_first_admin: isFirstAdmin,
                should_save_to_connection: shouldSaveToConnection,
                ...adminParams
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Администратор кластера создан');
            closeModal('createClusterAdminModal');
            
            // Если это первый администратор и пользователь ранее не сохранял данные - предлагаем сохранить
            if (isFirstAdmin && !shouldSaveToConnection) {
                // Проверяем, есть ли уже сохраненные данные для этого кластера
                const storedCredentials = getClusterAdminCredentials(connectionId, clusterUuid);
                if (!storedCredentials.admin) {
                    // Получаем имя кластера из DOM
                    const clusterHeader = document.querySelector(`[data-cluster-uuid="${clusterUuid}"]`);
                    const clusterName = clusterHeader?.getAttribute('data-cluster-name') || 'кластера';
                    // Открываем модальное окно с предложением сохранить данные
                    setTimeout(() => {
                        openSaveClusterAdminModal(connectionId, clusterUuid, name, pwd, clusterName);
                    }, 300);
                }
            } else if (shouldSaveToConnection) {
                // Если пользователь выбрал сохранить - сохраняем в localStorage для этого кластера
                saveClusterAdminToStorage(connectionId, clusterUuid, name, pwd);
            }
            
            // Перезагружаем дерево кластера
            loadConnectionData(connectionId);
        } else {
            showNotification('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

/**
 * Удалить администратора кластера
 */
async function deleteClusterAdmin(connectionId, clusterUuid, adminName) {
    if (!confirm(`Вы уверены, что хотите удалить администратора кластера "${adminName}"?`)) {
        return;
    }
    
    // Проверяем данные ДО удаления, чтобы знать, нужно ли предлагать очистку
    const credentials = getClusterAdminCredentials(connectionId, clusterUuid);
    const hasStoredCredentials = !!credentials.admin;
    
    // Проверяем, сколько администраторов останется после удаления
    let wasLastAdmin = false;
    try {
        const url = addClusterAdminParams(`/api/clusters/admins/${connectionId}/${clusterUuid}/`, connectionId, clusterUuid);
        const checkResponse = await fetch(url);
        const checkData = await checkResponse.json();
        
        if (checkData.success && checkData.admins && checkData.admins.length === 1) {
            // Если остался только один администратор - это будет последний
            wasLastAdmin = true;
        }
    } catch (error) {
        console.error('Ошибка проверки администраторов:', error);
    }
    
    try {
        const adminParams = addClusterAdminParams('', connectionId, clusterUuid, 'POST');
        const response = await fetch(`/api/clusters/admins/${connectionId}/${clusterUuid}/delete/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ 
                name: adminName,
                ...adminParams
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Администратор кластера удален');
            
            // Если это был последний администратор и есть сохраненные данные - предлагаем очистить
            if (wasLastAdmin && hasStoredCredentials) {
                // Получаем имя кластера из DOM
                const clusterHeader = document.querySelector(`[data-cluster-uuid="${clusterUuid}"]`);
                const clusterName = clusterHeader?.getAttribute('data-cluster-name') || 'кластера';
                setTimeout(() => {
                    openClearClusterAdminModal(connectionId, clusterUuid, clusterName);
                }, 300);
            }
            
            // Перезагружаем дерево кластера
            loadConnectionData(connectionId);
        } else {
            showNotification('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

/**
 * Открыть модальное окно с предложением сохранить данные администратора кластера
 */
function openSaveClusterAdminModal(connectionId, clusterUuid, adminName, adminPassword, clusterName = 'кластера') {
    const modalHtml = `
        <div class="modal-overlay optimized" id="saveClusterAdminModal">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>💾 Сохранить данные администратора?</h3>
                    <button class="modal-close-btn" onclick="closeModal('saveClusterAdminModal')">×</button>
                </div>
                <div class="modal-body">
                    <div class="info-card">
                        <p style="margin: 0; font-size: 1rem;">
                            Вы создали первого администратора кластера. Хотите ли вы сохранить указанные данные (логин: <strong>${escapeHtml(adminName)}</strong>) в настройках (кластера: <strong>${escapeHtml(clusterName)}</strong>)?
                        </p>
                        <p style="margin: 1rem 0 0 0; font-size: 0.9rem; color: #666;">
                            Это позволит автоматически использовать эти данные при выполнении команд RAC для этого кластера.
                        </p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal('saveClusterAdminModal')">Нет, не сохранять</button>
                    <button class="btn btn-primary" onclick="saveClusterAdminToSettings(${connectionId}, '${clusterUuid}', '${escapeHtml(adminName).replace(/'/g, "\\'")}', '${escapeHtml(adminPassword).replace(/'/g, "\\'")}')">
                        Да, сохранить
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const container = document.getElementById('modal-container');
    container.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Сохранить данные администратора в настройки кластера
 */
function saveClusterAdminToSettings(connectionId, clusterUuid, adminName, adminPassword) {
    saveClusterAdminToStorage(connectionId, clusterUuid, adminName, adminPassword);
    showNotification('✅ Данные администратора сохранены в настройках кластера', false);
    closeModal('saveClusterAdminModal');
    
    // Перезагружаем данные кластера
    if (window._currentConnectionId == connectionId) {
        loadConnectionData(connectionId);
    }
}

/**
 * Открыть модальное окно с предложением очистить данные администратора кластера
 */
function openClearClusterAdminModal(connectionId, clusterUuid, clusterName = 'кластера') {
    const modalHtml = `
        <div class="modal-overlay optimized" id="clearClusterAdminModal">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>🧹 Очистить данные администратора?</h3>
                    <button class="modal-close-btn" onclick="closeModal('clearClusterAdminModal')">×</button>
                </div>
                <div class="modal-body">
                    <div class="info-card">
                        <p style="margin: 0; font-size: 1rem;">
                            Вы удалили последнего администратора кластера. Хотите ли вы очистить сохраненные данные администратора в настройках (кластера: <strong>${escapeHtml(clusterName)}</strong>)?
                        </p>
                        <p style="margin: 1rem 0 0 0; font-size: 0.9rem; color: #666;">
                            Это очистит логин и пароль администратора кластера из настроек и снимет чекбокс.
                        </p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal('clearClusterAdminModal')">Нет, оставить</button>
                    <button class="btn btn-primary" onclick="clearClusterAdminFromSettings(${connectionId}, '${clusterUuid}')">
                        Да, очистить
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const container = document.getElementById('modal-container');
    container.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Очистить данные администратора из настроек кластера
 */
function clearClusterAdminFromSettings(connectionId, clusterUuid) {
    saveClusterAdminToStorage(connectionId, clusterUuid, '', '');
    showNotification('✅ Данные администратора очищены из настроек кластера', false);
    closeModal('clearClusterAdminModal');
    
    // Перезагружаем данные кластера
    if (window._currentConnectionId == connectionId) {
        loadConnectionData(connectionId);
    }
}
