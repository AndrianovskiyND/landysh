/**
 * Управление требованиями назначения функциональности (ТНФ)
 */

// Функция escapeHtml, если не определена
if (typeof escapeHtml === 'undefined') {
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    window.escapeHtml = escapeHtml;
}

// Типы объектов требований
const RULE_OBJECT_TYPES = [
    { russian: "Сервис номеров имен таблиц и полей базы данных", english: "DatabaseTableNumberingService" },
    { russian: "Сервис времени копий базы данных", english: "DbCopiesTimeService" },
    { russian: "Сервис координации полнотекстового поиска, версия 2", english: "FullTextSearchCoordinationServiceV2" },
    { russian: "Сервис блокировки объектов", english: "DataEditLockService" },
    { russian: "Сервис интеграционных данных", english: "IntegrationDataService" },
    { russian: "Сервис сеансовых данных", english: "SessionDataService" },
    { russian: "Сервис тестирования", english: "ClientTestingService" },
    { russian: "Сервис заданий", english: "JobService" },
    { russian: "Сервис получения списка сеансов", english: "GetSessionsService" },
    { russian: "Сервис обновления конфигурации базы данных", english: "DataBaseConfigurationUpdateService" },
    { russian: "Сервис полнотекстового поиска", english: "FulltextSearchService" },
    { russian: "Сервис провайдера OpenID2", english: "OpenID2ProviderContextService" },
    { russian: "Сервис уведомлений клиента", english: "ClientNotificationService" },
    { russian: "Сервис копий базы данных", english: "DbCopiesService" },
    { russian: "Сервис внешнего управления сеансами", english: "ExternalSessionManagerService" },
    { russian: "Сервис вспомогательных функций кластера", english: "AuxiliaryService" },
    { russian: "Сервис работы с внешними источниками данных через ODBC", english: "ExternalDataSourceODBCService" },
    { russian: "Сервис лицензирования", english: "LicenseService" },
    { russian: "Сервис мониторига счетчиков потребления ресурсов", english: "CounterService" },
    { russian: "Сервис времени", english: "TimestampService" },
    { russian: "Сервис журналов регистрации", english: "EventLogService" },
    { russian: "Сервис Дата акселератора", english: "DataAcceleratorService" },
    { russian: "Сервис нумерации", english: "NumerationService" },
    { russian: "Сервис полнотекстового поиска, версия 2", english: "FullTextSearchServiceV2" },
    { russian: "Сервис распознавания речи", english: "SpeechToTextService" },
    { russian: "Сервис пользовательских настроек", english: "SettingsService" },
    { russian: "Сервис хранилища двоичных данных", english: "BinaryDataStorageService" },
    { russian: "Сервис WebSocket", english: "WebSocketService" },
    { russian: "Сервис повторного использования сеансов", english: "SessionReuseService" },
    { russian: "Сервис транзакционных блокировок", english: "TransactionLockService" },
    { russian: "Сервис управления моделями распознавания речи", english: "SpeechToTextModelManagementService" },
    { russian: "Сервис работы с внешними источниками данных через XMLA", english: "ExternalDataSourceXMLAService" },
    { russian: "Клиентское соединение с ИБ", english: "Connection" },
    { russian: "Для всех", english: "" }
];

// Глобальные переменные для хранения состояния
let currentRulesConnectionId = null;
let currentRulesClusterUuid = null;
let currentRulesServerUuid = null;
let currentRulesServerName = null;
let currentRules = [];

/**
 * Открывает модальное окно с таблицей правил
 */
async function openRulesModal(connectionId, clusterUuid, serverUuid, serverName = null) {
    closeContextMenu();
    
    // Удаляем предыдущее модальное окно если есть
    const existingModal = document.getElementById('rulesModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Сохраняем глобальные переменные
    currentRulesConnectionId = connectionId;
    currentRulesClusterUuid = clusterUuid;
    currentRulesServerUuid = serverUuid;
    currentRulesServerName = serverName || 'Сервер';
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay optimized modal-full-screen';
    modal.id = 'rulesModal';
    modal.style.zIndex = '10003';
    modal.innerHTML = `
        <div class="modal" style="width: 95vw; height: 95vh; max-width: none; max-height: none; display: flex; flex-direction: column;">
            <div class="modal-header" style="flex-shrink: 0;">
                <h3>📐 Требования назначения функциональности для сервера: ${escapeHtml(currentRulesServerName)}</h3>
                <button class="modal-close-btn" onclick="closeRulesModal()">×</button>
            </div>
            <div class="modal-body" style="flex: 1; overflow: hidden; display: flex; flex-direction: column; padding: 1rem;">
                <div style="margin-bottom: 1rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <button class="btn btn-secondary" onclick="toggleRulesColumnFilter()" title="Фильтр столбцов">🔍 Фильтр</button>
                    <button class="btn btn-primary" onclick="openCreateRuleModal()">+ Создать</button>
                    <button class="btn btn-secondary" onclick="openApplyRulesModal()">✅ Применить</button>
                    <button class="btn btn-secondary" onclick="refreshRulesTable()">🔄 Обновить</button>
                </div>
                <div id="rulesColumnFilter" style="display: none; margin-bottom: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 6px; max-height: 200px; overflow-y: auto;">
                    <div style="font-weight: 600; margin-bottom: 0.5rem;">Выберите столбцы для отображения:</div>
                    <div id="rulesColumnFilterList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.5rem;"></div>
                </div>
                <div id="rulesTableContainer" style="flex: 1; overflow: auto;">
                    <div style="text-align: center; padding: 2rem; color: #666;">
                        Загрузка...
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Загружаем правила
    await loadRules();
}

/**
 * Закрывает модальное окно правил
 */
function closeRulesModal() {
    const modal = document.getElementById('rulesModal');
    if (modal) {
        modal.remove();
    }
    currentRulesConnectionId = null;
    currentRulesClusterUuid = null;
    currentRulesServerUuid = null;
    currentRules = [];
}

/**
 * Загружает список правил
 */
async function loadRules() {
    try {
        let url = `/api/clusters/rules/${currentRulesConnectionId}/${currentRulesClusterUuid}/${currentRulesServerUuid}/`;
        url = addClusterAdminParams(url, currentRulesConnectionId, currentRulesClusterUuid);
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            currentRules = data.rules || [];
            renderRulesTable();
        } else {
            document.getElementById('rulesTableContainer').innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #d32f2f;">
                    ❌ Ошибка загрузки: ${data.error || 'Неизвестная ошибка'}
                </div>
            `;
        }
    } catch (error) {
        document.getElementById('rulesTableContainer').innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #d32f2f;">
                ❌ Ошибка загрузки: ${error.message}
            </div>
        `;
    }
}

/**
 * Отображает таблицу правил
 */
function renderRulesTable() {
    const container = document.getElementById('rulesTableContainer');
    if (!container) return;
    
    if (currentRules.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                Требования назначения функциональности не назначены
            </div>
        `;
        return;
    }
    
    // Собираем все уникальные ключи
    const allKeys = new Set();
    currentRules.forEach(rule => {
        Object.keys(rule.data || {}).forEach(key => allKeys.add(key));
    });
    allKeys.add('rule'); // UUID правила
    if (currentRules.length > 0) {
        allKeys.add('position'); // Позиция (только если есть правила)
    }
    const sortedKeys = Array.from(allKeys).sort();
    
    // Получаем сохраненное состояние видимости столбцов
    // По умолчанию UUID выключен, остальные включены
    if (!window._rulesVisibleColumns) {
        window._rulesVisibleColumns = new Set(sortedKeys.filter(k => k !== 'rule'));
    }
    const visibleColumns = window._rulesVisibleColumns;
    
    // Получаем сохраненный порядок столбцов
    const columnOrderKey = `rules_column_order_${currentRulesConnectionId}_${currentRulesClusterUuid}_${currentRulesServerUuid}`;
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
    
    // Маппинг названий столбцов
    const columnMapping = {
        'rule': 'UUID правила',
        'position': 'Позиция',
        'object-type': 'Объект требования',
        'infobase-name': 'Имя инф. базы',
        'rule-type': 'Тип правила',
        'application-ext': 'Приложение',
        'priority': 'Приоритет'
    };
    
    let html = '';
    
    if (!hasVisibleColumns) {
        html = `
            <div style="text-align: center; padding: 2rem; color: #666;">
                Нет данных для отображения. Выберите столбцы в фильтре.
            </div>
        `;
    } else {
        html = `
            <table class="data-table" id="rulesTable" style="width: 100%;">
                <thead>
                    <tr>
                        ${columnOrder.map(key => `
                            <th class="draggable-column" data-column="${key}" draggable="true" style="cursor: move; user-select: none; position: relative;">
                                <div style="display: flex; align-items: center; gap: 0.5rem;">
                                    <span>${columnMapping[key] || key}</span>
                                </div>
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody>
        `;
        
        currentRules.forEach((rule, index) => {
            const ruleData = rule.data || {};
            html += `
                <tr oncontextmenu="showRuleContextMenu(event, '${rule.uuid}', ${index}); return false;" style="cursor: pointer;">
                    ${columnOrder.map(key => {
                        let value = '';
                        if (key === 'rule') {
                            value = rule.uuid;
                        } else if (key === 'position') {
                            // Позиция - номер по порядку (начиная с 0)
                            value = index;
                        } else {
                            value = ruleData[key] || '';
                            // Преобразуем rule-type для отображения
                            if (key === 'rule-type') {
                                const typeMap = {'auto': 'Авто', 'always': 'Назначать', 'never': 'Не назначать'};
                                value = typeMap[value] || value;
                            }
                            // Преобразуем object-type для отображения (английское название в русское)
                            if (key === 'object-type' && value) {
                                // Убираем кавычки и пробелы, если есть
                                const cleanValue = String(value).trim().replace(/^["']|["']$/g, '');
                                // Ищем соответствие в массиве типов
                                const objectType = RULE_OBJECT_TYPES.find(type => 
                                    type.english === cleanValue || 
                                    type.english.toLowerCase() === cleanValue.toLowerCase()
                                );
                                if (objectType) {
                                    value = objectType.russian;
                                } else {
                                    // Если не найдено соответствие, оставляем оригинальное значение
                                    // но логируем для отладки
                                    console.warn('Не найдено русское название для object-type:', cleanValue);
                                }
                            }
                        }
                    return `<td data-column="${key}">${escapeHtml(String(value))}</td>`;
                }).join('')}
            </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
        `;
    }
    
    container.innerHTML = html;
    
    // Инициализируем drag-and-drop для столбцов
    if (hasVisibleColumns && typeof initColumnDragDrop === 'function') {
        initColumnDragDrop('#rulesTable', columnOrderKey);
    }
    
}

/**
 * Показывает контекстное меню для правила
 */
function showRuleContextMenu(event, ruleUuid, index) {
    event.preventDefault();
    event.stopPropagation();
    
    const existingMenu = document.getElementById('ruleContextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.id = 'ruleContextMenu';
    menu.className = 'context-menu';
    menu.style.position = 'fixed';
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
    menu.style.zIndex = '10004';
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="openEditRuleModal('${ruleUuid}', ${index}); closeContextMenu();">
            ✏️ Изменить
        </div>
        <div class="context-menu-item" onclick="moveRuleUp('${ruleUuid}', ${index}); closeContextMenu();" ${index === 0 ? 'style="opacity: 0.5; cursor: not-allowed;"' : ''}>
            ⬆️ Повысить
        </div>
        <div class="context-menu-item" onclick="moveRuleDown('${ruleUuid}', ${index}); closeContextMenu();" ${index === currentRules.length - 1 ? 'style="opacity: 0.5; cursor: not-allowed;"' : ''}>
            ⬇️ Понизить
        </div>
        <div class="context-menu-item" onclick="deleteRule('${ruleUuid}'); closeContextMenu();">
            🗑️ Удалить
        </div>
    `;
    
    document.body.appendChild(menu);
    
    // Закрываем меню при клике вне его
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        });
    }, 100);
}

/**
 * Открывает модальное окно для создания правила
 */
function openCreateRuleModal() {
    const modalHtml = `
        <div class="modal-overlay optimized" id="createRuleModal" style="z-index: 10005;">
            <div class="modal" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Создание требования назначения</h3>
                    <button class="modal-close-btn" onclick="closeCreateRuleModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="createRuleForm">
                        <div class="form-row">
                            <label for="createRulePosition">Позиция <span style="color: red;">*</span></label>
                            <input type="number" id="createRulePosition" value="0" min="0" required>
                        </div>
                        <div class="form-row">
                            <label for="createRuleObjectType">Объект требования</label>
                            <select id="createRuleObjectType">
                                <option value="">Для всех</option>
                                ${RULE_OBJECT_TYPES.filter(type => type.english !== '').map(type => 
                                    `<option value="${escapeHtml(type.english)}">${escapeHtml(type.russian)}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="form-row">
                            <label for="createRuleInfobaseName">Имя информационной базы</label>
                            <input type="text" id="createRuleInfobaseName">
                        </div>
                        <div class="form-row">
                            <label for="createRuleType">Тип правила <span style="color: red;">*</span></label>
                            <select id="createRuleType" required>
                                <option value="Авто">Авто</option>
                                <option value="Назначать">Назначать</option>
                                <option value="Не назначать">Не назначать</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label for="createRuleApplicationExt">Приложение</label>
                            <input type="text" id="createRuleApplicationExt">
                        </div>
                        <div class="form-row">
                            <label for="createRulePriority">Приоритет</label>
                            <input type="number" id="createRulePriority" min="0">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="closeCreateRuleModal()">Отмена</button>
                    <button class="btn btn-primary" onclick="saveCreateRule()">Создать</button>
                </div>
            </div>
        </div>
    `;
    
    // Добавляем модальное окно в body, чтобы оно было поверх основного модального окна
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Закрывает модальное окно создания правила
 */
function closeCreateRuleModal() {
    const modal = document.getElementById('createRuleModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Сохраняет новое правило
 */
async function saveCreateRule() {
    const form = document.getElementById('createRuleForm');
    if (!form) return;
    
    const position = parseInt(document.getElementById('createRulePosition').value) || 0;
    const objectTypeSelect = document.getElementById('createRuleObjectType');
    const objectType = objectTypeSelect ? objectTypeSelect.value.trim() || null : null;
    const infobaseName = document.getElementById('createRuleInfobaseName').value.trim() || null;
    const ruleType = document.getElementById('createRuleType').value;
    const applicationExt = document.getElementById('createRuleApplicationExt').value.trim() || null;
    const priority = document.getElementById('createRulePriority').value.trim() || null;
    
    const data = {
        position: position,
        rule_type: ruleType
    };
    
    if (objectType) data.object_type = objectType;
    if (infobaseName) data.infobase_name = infobaseName;
    if (applicationExt) data.application_ext = applicationExt;
    if (priority) data.priority = parseInt(priority);
    
    try {
        // Добавляем учетные данные администратора кластера
        const adminParams = addClusterAdminParams('', currentRulesConnectionId, currentRulesClusterUuid, 'POST');
        Object.assign(data, adminParams);
        
        const response = await fetch(`/api/clusters/rules/${currentRulesConnectionId}/${currentRulesClusterUuid}/${currentRulesServerUuid}/create/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP error response:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Сервер вернул не JSON ответ');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Правило создано', false);
            closeCreateRuleModal();
            await loadRules();
        } else {
            showNotification('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        console.error('Error creating rule:', error);
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

/**
 * Открывает модальное окно для редактирования правила
 */
async function openEditRuleModal(ruleUuid, index) {
    // Загружаем полную информацию о правиле через API
    try {
        let url = `/api/clusters/rules/${currentRulesConnectionId}/${currentRulesClusterUuid}/${currentRulesServerUuid}/${ruleUuid}/info/`;
        url = addClusterAdminParams(url, currentRulesConnectionId, currentRulesClusterUuid);
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success) {
            showNotification('❌ Ошибка загрузки информации о правиле: ' + (data.error || 'Неизвестная ошибка'), true);
            return;
        }
        
        const rule = data.rule;
        if (!rule) {
            showNotification('❌ Информация о правиле не найдена', true);
            return;
        }
        
        const ruleData = rule.data || {};
        const ruleType = ruleData['rule-type'] || 'auto';
        const typeMap = {'auto': 'Авто', 'always': 'Назначать', 'never': 'Не назначать'};
        const ruleTypeDisplay = typeMap[ruleType] || 'Авто';
        
        // Получаем английское название объекта требования для выбора в select
        const objectTypeEnglish = ruleData['object-type'] || '';
        
        const modalHtml = `
        <div class="modal-overlay optimized" id="editRuleModal" style="z-index: 10005;">
            <div class="modal" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Изменение требования назначения</h3>
                    <button class="modal-close-btn" onclick="closeEditRuleModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="editRuleForm">
                        <div class="form-row">
                            <label for="editRulePosition">Позиция <span style="color: red;">*</span></label>
                            <input type="number" id="editRulePosition" value="${index}" min="0" required>
                            <small style="color: #888; font-size: 0.75rem; margin-top: 0.25rem;">Текущая позиция из таблицы: ${index}</small>
                        </div>
                        <div class="form-row">
                            <label for="editRuleObjectType">Объект требования</label>
                            <select id="editRuleObjectType">
                                <option value="">Для всех</option>
                                ${RULE_OBJECT_TYPES.filter(type => type.english !== '').map(type => {
                                    const selected = objectTypeEnglish === type.english ? 'selected' : '';
                                    return `<option value="${escapeHtml(type.english)}" ${selected}>${escapeHtml(type.russian)}</option>`;
                                }).join('')}
                            </select>
                        </div>
                        <div class="form-row">
                            <label for="editRuleInfobaseName">Имя информационной базы</label>
                            <input type="text" id="editRuleInfobaseName" value="${escapeHtml(ruleData['infobase-name'] || '')}">
                        </div>
                        <div class="form-row">
                            <label for="editRuleType">Тип правила <span style="color: red;">*</span></label>
                            <select id="editRuleType" required>
                                <option value="Авто" ${ruleTypeDisplay === 'Авто' ? 'selected' : ''}>Авто</option>
                                <option value="Назначать" ${ruleTypeDisplay === 'Назначать' ? 'selected' : ''}>Назначать</option>
                                <option value="Не назначать" ${ruleTypeDisplay === 'Не назначать' ? 'selected' : ''}>Не назначать</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label for="editRuleApplicationExt">Приложение</label>
                            <input type="text" id="editRuleApplicationExt" value="${escapeHtml(ruleData['application-ext'] || '')}">
                        </div>
                        <div class="form-row">
                            <label for="editRulePriority">Приоритет</label>
                            <input type="number" id="editRulePriority" value="${ruleData.priority || ''}" min="0">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="closeEditRuleModal()">Отмена</button>
                    <button class="btn btn-primary" onclick="saveEditRule('${ruleUuid}')">Сохранить</button>
                </div>
            </div>
        </div>
    `;
    
    // Добавляем модальное окно в body, чтобы оно было поверх основного модального окна
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    } catch (error) {
        console.error('Error loading rule info:', error);
        showNotification('❌ Ошибка загрузки информации о правиле: ' + error.message, true);
    }
}

/**
 * Закрывает модальное окно редактирования правила
 */
function closeEditRuleModal() {
    const modal = document.getElementById('editRuleModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Сохраняет изменения правила
 */
async function saveEditRule(ruleUuid) {
    const form = document.getElementById('editRuleForm');
    if (!form) return;
    
    const position = parseInt(document.getElementById('editRulePosition').value) || 0;
    const objectTypeSelect = document.getElementById('editRuleObjectType');
    const objectType = objectTypeSelect ? objectTypeSelect.value.trim() || null : null;
    const infobaseName = document.getElementById('editRuleInfobaseName').value.trim() || null;
    const ruleType = document.getElementById('editRuleType').value;
    const applicationExt = document.getElementById('editRuleApplicationExt').value.trim() || null;
    const priority = document.getElementById('editRulePriority').value.trim() || null;
    
    const data = {
        position: position,
        rule_type: ruleType
    };
    
    if (objectType) data.object_type = objectType;
    if (infobaseName) data.infobase_name = infobaseName;
    if (applicationExt) data.application_ext = applicationExt;
    if (priority) data.priority = parseInt(priority);
    
    try {
        // Добавляем учетные данные администратора кластера
        const adminParams = addClusterAdminParams('', currentRulesConnectionId, currentRulesClusterUuid, 'POST');
        Object.assign(data, adminParams);
        
        const response = await fetch(`/api/clusters/rules/${currentRulesConnectionId}/${currentRulesClusterUuid}/${currentRulesServerUuid}/${ruleUuid}/update/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP error response:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Сервер вернул не JSON ответ');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Правило обновлено', false);
            closeEditRuleModal();
            await loadRules();
        } else {
            showNotification('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        console.error('Error updating rule:', error);
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

/**
 * Удаляет правило
 */
async function deleteRule(ruleUuid) {
    if (!confirm('Вы уверены, что хотите удалить это требование назначения?')) {
        return;
    }
    
    try {
        // Добавляем учетные данные администратора кластера
        const adminParams = addClusterAdminParams('', currentRulesConnectionId, currentRulesClusterUuid, 'POST');
        
        const response = await fetch(`/api/clusters/rules/${currentRulesConnectionId}/${currentRulesClusterUuid}/${currentRulesServerUuid}/${ruleUuid}/delete/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(adminParams)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP error response:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Сервер вернул не JSON ответ');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Правило удалено', false);
            await loadRules();
        } else {
            showNotification('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        console.error('Error deleting rule:', error);
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

/**
 * Открывает модальное окно для применения правил
 */
function openApplyRulesModal() {
    const modalHtml = `
        <div class="modal-overlay optimized" id="applyRulesModal" style="z-index: 10005;">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Применение требований назначения</h3>
                    <button class="modal-close-btn" onclick="closeApplyRulesModal()">×</button>
                </div>
                <div class="modal-body">
                    <form id="applyRulesForm">
                        <div class="form-row">
                            <label>Режим применения:</label>
                            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                    <input type="radio" name="applyMode" value="full" checked>
                                    <span>Полное применение требований</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                    <input type="radio" name="applyMode" value="partial">
                                    <span>Частичное применение требований</span>
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="closeApplyRulesModal()">Отмена</button>
                    <button class="btn btn-primary" onclick="saveApplyRules()">Применить</button>
                </div>
            </div>
        </div>
    `;
    
    // Добавляем модальное окно в body, чтобы оно было поверх основного модального окна
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Закрывает модальное окно применения правил
 */
function closeApplyRulesModal() {
    const modal = document.getElementById('applyRulesModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Применяет правила
 */
async function saveApplyRules() {
    const form = document.getElementById('applyRulesForm');
    if (!form) return;
    
    const applyMode = form.querySelector('input[name="applyMode"]:checked').value;
    const full = applyMode === 'full';
    
    try {
        // Добавляем учетные данные администратора кластера
        const adminParams = addClusterAdminParams('', currentRulesConnectionId, currentRulesClusterUuid, 'POST');
        const requestData = {
            full: full,
            ...adminParams
        };
        
        const response = await fetch(`/api/clusters/rules/${currentRulesConnectionId}/${currentRulesClusterUuid}/${currentRulesServerUuid}/apply/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(requestData)
        });
        
        // Проверяем, что ответ - это JSON
        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP error response:', response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error('Сервер вернул не JSON ответ');
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Требования применены', false);
            closeApplyRulesModal();
        } else {
            showNotification('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        console.error('Error applying rules:', error);
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

/**
 * Обновляет таблицу правил
 */
async function refreshRulesTable() {
    await loadRules();
}

/**
 * Получает русское название объекта требования по английскому
 */
function getObjectTypeDisplayName(englishValue) {
    if (!englishValue) return 'Для всех';
    const type = RULE_OBJECT_TYPES.find(t => t.english === englishValue);
    return type ? type.russian : englishValue;
}

/**
 * Инициализирует поиск по объектам требований
 */
function initObjectTypeSearch(inputId, hiddenId, dropdownId) {
    const input = document.getElementById(inputId);
    const hidden = document.getElementById(hiddenId);
    const dropdown = document.getElementById(dropdownId);
    
    if (!input || !hidden || !dropdown) return;
    
    // Если значение уже установлено, показываем его
    if (hidden.value) {
        input.value = getObjectTypeDisplayName(hidden.value);
    } else {
        input.value = 'Для всех';
        hidden.value = '';
    }
    
    let filteredTypes = [...RULE_OBJECT_TYPES];
    
    // Функция фильтрации
    function filterTypes(searchTerm) {
        if (!searchTerm || searchTerm.trim() === '') {
            filteredTypes = [...RULE_OBJECT_TYPES];
        } else {
            const term = searchTerm.toLowerCase();
            filteredTypes = RULE_OBJECT_TYPES.filter(type => {
                const russian = type.russian.toLowerCase();
                return russian.includes(term) || russian.startsWith(term);
            });
        }
        renderDropdown();
    }
    
    // Функция отображения выпадающего списка
    function renderDropdown() {
        if (filteredTypes.length === 0) {
            dropdown.style.display = 'none';
            return;
        }
        
        dropdown.innerHTML = filteredTypes.map(type => {
            const isSelected = hidden.value === type.english;
            return `
                <div class="object-type-option" 
                     data-value="${escapeHtml(type.english)}" 
                     data-russian="${escapeHtml(type.russian)}"
                     style="padding: 0.5rem; cursor: pointer; ${isSelected ? 'background: #e8f4ff;' : ''}"
                     onmouseover="this.style.background='#f0f0f0'"
                     onmouseout="this.style.background='${isSelected ? '#e8f4ff' : 'white'}'"
                     onclick="selectObjectType('${inputId}', '${hiddenId}', '${dropdownId}', '${escapeHtml(type.english)}', '${escapeHtml(type.russian)}')">
                    ${escapeHtml(type.russian)}
                </div>
            `;
        }).join('');
        
        dropdown.style.display = filteredTypes.length > 0 ? 'block' : 'none';
    }
    
    // Обработчик ввода
    input.addEventListener('input', (e) => {
        const searchTerm = e.target.value;
        filterTypes(searchTerm);
        
        // Если введено точное совпадение, выбираем его
        const exactMatch = RULE_OBJECT_TYPES.find(type => 
            type.russian.toLowerCase() === searchTerm.toLowerCase()
        );
        
        if (exactMatch) {
            selectObjectType(inputId, hiddenId, dropdownId, exactMatch.english, exactMatch.russian);
        } else if (filteredTypes.length === 1 && searchTerm.length > 0) {
            // Если остался только один вариант, предлагаем его
            const singleMatch = filteredTypes[0];
            if (singleMatch.russian.toLowerCase().startsWith(searchTerm.toLowerCase())) {
                // Автодополнение
                const remaining = singleMatch.russian.substring(searchTerm.length);
                if (remaining.length < 20) { // Автодополняем только если осталось мало символов
                    input.value = searchTerm + remaining;
                    input.setSelectionRange(searchTerm.length, input.value.length);
                }
            }
        }
    });
    
    // Обработчик фокуса
    input.addEventListener('focus', () => {
        filterTypes(input.value);
    });
    
    // Закрываем при клике вне
    document.addEventListener('click', function closeDropdown(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

/**
 * Выбирает объект требования
 */
function selectObjectType(inputId, hiddenId, dropdownId, englishValue, russianValue) {
    const input = document.getElementById(inputId);
    const hidden = document.getElementById(hiddenId);
    const dropdown = document.getElementById(dropdownId);
    
    if (input) input.value = russianValue;
    if (hidden) hidden.value = englishValue;
    if (dropdown) dropdown.style.display = 'none';
}

/**
 * Переключает фильтр столбцов
 */
function toggleRulesColumnFilter() {
    const filterDiv = document.getElementById('rulesColumnFilter');
    if (filterDiv) {
        filterDiv.style.display = filterDiv.style.display === 'none' ? 'block' : 'none';
        
        // Если открываем фильтр, заполняем список столбцов
        if (filterDiv.style.display === 'block') {
            updateRulesColumnFilterList();
        }
    }
}

/**
 * Обновляет список столбцов в фильтре
 */
function updateRulesColumnFilterList() {
    const filterList = document.getElementById('rulesColumnFilterList');
    if (!filterList) return;
    
    if (currentRules.length === 0) return;
    
    // Собираем все уникальные ключи
    const allKeys = new Set();
    currentRules.forEach(rule => {
        Object.keys(rule.data || {}).forEach(key => allKeys.add(key));
    });
    allKeys.add('rule'); // UUID правила
    if (currentRules.length > 0) {
        allKeys.add('position'); // Позиция (только если есть правила)
    }
    
    const sortedKeys = Array.from(allKeys).sort();
    
    // Получаем сохраненное состояние видимости столбцов
    // По умолчанию UUID выключен, остальные включены
    if (!window._rulesVisibleColumns) {
        window._rulesVisibleColumns = new Set(sortedKeys.filter(k => k !== 'rule'));
    }
    const visibleColumns = window._rulesVisibleColumns;
    
    // Маппинг названий столбцов
    const columnMapping = {
        'rule': 'UUID правила',
        'position': 'Позиция',
        'object-type': 'Объект требования',
        'infobase-name': 'Имя инф. базы',
        'rule-type': 'Тип правила',
        'application-ext': 'Приложение',
        'priority': 'Приоритет'
    };
    
    // Проверяем, все ли столбцы выбраны
    const allSelected = sortedKeys.length > 0 && sortedKeys.every(key => visibleColumns.has(key));
    
    let html = `
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: 600; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid #ddd;">
            <input type="checkbox" id="selectAllRulesColumns" ${allSelected ? 'checked' : ''} onchange="toggleAllRulesColumns(this.checked)">
            <span>Выбрать все</span>
        </label>
    `;
    
    sortedKeys.forEach(key => {
        const isVisible = visibleColumns.has(key);
        const displayName = columnMapping[key] || key;
        html += `
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" class="rule-column-checkbox" data-column="${key}" ${isVisible ? 'checked' : ''} onchange="toggleRulesColumn('${key}', this.checked)">
                <span>${escapeHtml(displayName)}</span>
            </label>
        `;
    });
    
    filterList.innerHTML = html;
}

/**
 * Переключает выбор всех столбцов правил
 */
function toggleAllRulesColumns(selectAll) {
    if (!window._rulesVisibleColumns) {
        window._rulesVisibleColumns = new Set();
    }
    
    const filterList = document.getElementById('rulesColumnFilterList');
    if (!filterList) return;
    
    const checkboxes = filterList.querySelectorAll('.rule-column-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll;
        const column = checkbox.getAttribute('data-column');
        if (selectAll) {
            window._rulesVisibleColumns.add(column);
        } else {
            window._rulesVisibleColumns.delete(column);
        }
    });
    
    renderRulesTable();
}

/**
 * Переключает видимость столбца правил
 */
function toggleRulesColumn(column, isVisible) {
    if (!window._rulesVisibleColumns) {
        window._rulesVisibleColumns = new Set();
    }
    
    if (isVisible) {
        window._rulesVisibleColumns.add(column);
    } else {
        window._rulesVisibleColumns.delete(column);
    }
    
    renderRulesTable();
}

/**
 * Повышает позицию правила (перемещает на одну позицию выше)
 */
async function moveRuleUp(ruleUuid, currentIndex) {
    if (currentIndex === 0) {
        showNotification('❌ Правило уже на первой позиции', true);
        return;
    }
    
    const newPosition = currentIndex - 1; // Новая позиция (был 1, стал 0; был 3, стал 2)
    
    try {
        // Получаем текущие данные правила
        let url = `/api/clusters/rules/${currentRulesConnectionId}/${currentRulesClusterUuid}/${currentRulesServerUuid}/${ruleUuid}/info/`;
        url = addClusterAdminParams(url, currentRulesConnectionId, currentRulesClusterUuid);
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success || !data.rule) {
            showNotification('❌ Ошибка загрузки информации о правиле', true);
            return;
        }
        
        const rule = data.rule;
        const ruleData = rule.data || {};
        
        // Формируем данные для обновления
        const updateData = {
            position: newPosition,
            rule_type: ruleData['rule-type'] || 'auto'
        };
        
        if (ruleData['object-type']) updateData.object_type = ruleData['object-type'];
        if (ruleData['infobase-name']) updateData.infobase_name = ruleData['infobase-name'];
        if (ruleData['application-ext']) updateData.application_ext = ruleData['application-ext'];
        if (ruleData.priority !== undefined) updateData.priority = parseInt(ruleData.priority) || 0;
        
        // Добавляем учетные данные администратора кластера
        const adminParams = addClusterAdminParams('', currentRulesConnectionId, currentRulesClusterUuid, 'POST');
        Object.assign(updateData, adminParams);
        
        // Обновляем правило
        const updateResponse = await fetch(`/api/clusters/rules/${currentRulesConnectionId}/${currentRulesClusterUuid}/${currentRulesServerUuid}/${ruleUuid}/update/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(updateData)
        });
        
        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.error('HTTP error response:', updateResponse.status, errorText);
            throw new Error(`HTTP error! status: ${updateResponse.status}`);
        }
        
        const contentType = updateResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await updateResponse.text();
            console.error('Non-JSON response:', text);
            throw new Error('Сервер вернул не JSON ответ');
        }
        
        const result = await updateResponse.json();
        
        if (result.success) {
            showNotification('✅ Позиция правила повышена', false);
            await loadRules();
        } else {
            showNotification('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        console.error('Error moving rule up:', error);
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

/**
 * Понижает позицию правила (перемещает на одну позицию ниже)
 */
async function moveRuleDown(ruleUuid, currentIndex) {
    if (currentIndex === currentRules.length - 1) {
        showNotification('❌ Правило уже на последней позиции', true);
        return;
    }
    
    const newPosition = currentIndex + 1; // Новая позиция (был 0, стал 1; был 2, стал 3)
    
    try {
        // Получаем текущие данные правила
        let url = `/api/clusters/rules/${currentRulesConnectionId}/${currentRulesClusterUuid}/${currentRulesServerUuid}/${ruleUuid}/info/`;
        url = addClusterAdminParams(url, currentRulesConnectionId, currentRulesClusterUuid);
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success || !data.rule) {
            showNotification('❌ Ошибка загрузки информации о правиле', true);
            return;
        }
        
        const rule = data.rule;
        const ruleData = rule.data || {};
        
        // Формируем данные для обновления
        const updateData = {
            position: newPosition,
            rule_type: ruleData['rule-type'] || 'auto'
        };
        
        if (ruleData['object-type']) updateData.object_type = ruleData['object-type'];
        if (ruleData['infobase-name']) updateData.infobase_name = ruleData['infobase-name'];
        if (ruleData['application-ext']) updateData.application_ext = ruleData['application-ext'];
        if (ruleData.priority !== undefined) updateData.priority = parseInt(ruleData.priority) || 0;
        
        // Добавляем учетные данные администратора кластера
        const adminParams = addClusterAdminParams('', currentRulesConnectionId, currentRulesClusterUuid, 'POST');
        Object.assign(updateData, adminParams);
        
        // Обновляем правило
        const updateResponse = await fetch(`/api/clusters/rules/${currentRulesConnectionId}/${currentRulesClusterUuid}/${currentRulesServerUuid}/${ruleUuid}/update/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify(updateData)
        });
        
        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.error('HTTP error response:', updateResponse.status, errorText);
            throw new Error(`HTTP error! status: ${updateResponse.status}`);
        }
        
        const contentType = updateResponse.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await updateResponse.text();
            console.error('Non-JSON response:', text);
            throw new Error('Сервер вернул не JSON ответ');
        }
        
        const result = await updateResponse.json();
        
        if (result.success) {
            showNotification('✅ Позиция правила понижена', false);
            await loadRules();
        } else {
            showNotification('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        console.error('Error moving rule down:', error);
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

