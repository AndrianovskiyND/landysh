/**
 * Управление группами - Ландыш
 * CRUD операции для групп пользователей
 */

// Хранилище выбранных групп для объединения
let selectedGroupsForMerge = [];

// ============================================
// Отображение списка групп
// ============================================

/**
 * Показать раздел управления группами
 */
async function showGroupManagement() {
    currentView = 'groups';
    if (typeof saveCurrentView === 'function') {
        saveCurrentView('groups');
    }
    updateNavigation();
    selectedGroupsForMerge = [];
    
    try {
        const response = await fetch('/api/users/groups/all/');
        const data = await response.json();
        
        if (data.success) {
            renderGroupManagement(data.groups);
        } else {
            showNotification('Ошибка загрузки групп: ' + data.error, true);
        }
    } catch (error) {
        showNotification('Ошибка загрузки групп: ' + error.message, true);
    }
}

/**
 * Отрисовать таблицу групп
 * @param {Array} groups - Массив групп
 */
function renderGroupManagement(groups) {
    const contentArea = document.getElementById('contentArea');
    
    // Сохраняем группы глобально для модального окна
    window._allGroups = groups;
    
    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h2 style="margin: 0;">Управление группами</h2>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-primary" onclick="showCreateGroupForm()">+ Создать группу</button>
                <button class="btn btn-secondary" onclick="openMergeGroupsModal()" id="mergeBtn" disabled>
                    Объединить группы
                </button>
            </div>
        </div>
        
        <div id="selectedGroupsInfo" style="display: none; margin-bottom: 1rem; padding: 0.75rem; background: #e8f4ff; border-radius: 6px; border: 1px solid #b8daff;">
            <span>Выбрано групп: <strong id="selectedCount">0</strong></span>
            <button class="btn btn-sm" onclick="clearGroupSelection()" style="margin-left: 1rem;">Сбросить выбор</button>
        </div>
        
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 40px;">
                        <input type="checkbox" id="selectAllGroups" onchange="toggleSelectAllGroups(this.checked)" title="Выбрать все">
                    </th>
                    <th>Название</th>
                    <th>Создатель</th>
                    <th>Участников</th>
                    <th>Дата создания</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    if (groups.length === 0) {
        html += `
            <tr>
                <td colspan="6" style="text-align: center; color: #666; padding: 2rem;">
                    Нет созданных групп
                </td>
            </tr>
        `;
    } else {
        groups.forEach(group => {
            const escapedName = group.name.replace(/'/g, "\\'");
            html += `
                <tr>
                    <td>
                        <input type="checkbox" 
                               class="group-checkbox" 
                               data-group-id="${group.id}"
                               data-group-name="${escapedName}"
                               onchange="toggleGroupSelection(${group.id}, '${escapedName}')">
                    </td>
                    <td>
                        <strong>${group.name}</strong>
                    </td>
                    <td>${group.created_by}</td>
                    <td>${group.members_count}</td>
                    <td>${new Date(group.created_at).toLocaleDateString('ru-RU')}</td>
                    <td>
                        <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                            <button class="btn btn-sm" onclick="editGroupName(${group.id}, '${escapedName}')">Изменить</button>
                            <button class="btn btn-sm btn-secondary" onclick="copyGroup(${group.id})">Копировать</button>
                            <button class="btn btn-sm btn-danger" onclick="deleteGroup(${group.id}, '${escapedName}')">Удалить</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    }
    
    html += '</tbody></table>';
    contentArea.innerHTML = html;
}

// ============================================
// Выбор групп для объединения
// ============================================

function toggleGroupSelection(groupId, groupName) {
    const index = selectedGroupsForMerge.findIndex(g => g.id === groupId);
    
    if (index === -1) {
        selectedGroupsForMerge.push({ id: groupId, name: groupName });
    } else {
        selectedGroupsForMerge.splice(index, 1);
    }
    
    updateMergeButtonState();
}

function toggleSelectAllGroups(checked) {
    const checkboxes = document.querySelectorAll('.group-checkbox');
    selectedGroupsForMerge = [];
    
    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked) {
            selectedGroupsForMerge.push({
                id: parseInt(cb.dataset.groupId),
                name: cb.dataset.groupName
            });
        }
    });
    
    updateMergeButtonState();
}

function clearGroupSelection() {
    selectedGroupsForMerge = [];
    document.querySelectorAll('.group-checkbox').forEach(cb => cb.checked = false);
    document.getElementById('selectAllGroups').checked = false;
    updateMergeButtonState();
}

function updateMergeButtonState() {
    const mergeBtn = document.getElementById('mergeBtn');
    const infoBlock = document.getElementById('selectedGroupsInfo');
    const countEl = document.getElementById('selectedCount');
    
    if (mergeBtn) {
        mergeBtn.disabled = selectedGroupsForMerge.length < 2;
    }
    
    if (infoBlock && countEl) {
        if (selectedGroupsForMerge.length > 0) {
            infoBlock.style.display = 'block';
            countEl.textContent = selectedGroupsForMerge.length;
        } else {
            infoBlock.style.display = 'none';
        }
    }
}

// ============================================
// Создание группы
// ============================================

function showCreateGroupForm() {
    const modalHtml = `
        <div class="modal-overlay" id="createGroupModal">
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>Создание группы</h3>
                    <button class="modal-close-btn" onclick="closeModal('createGroupModal')">×</button>
                </div>
                <div class="modal-body">
                    <div class="edit-form">
                        <div class="form-row">
                            <label for="newGroupName">Название группы</label>
                            <input type="text" id="newGroupName" placeholder="Введите название">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="closeModal('createGroupModal')">Отмена</button>
                    <button class="btn btn-primary" onclick="createGroup()">Создать</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('modal-container').innerHTML = modalHtml;
    document.getElementById('newGroupName').focus();
}

async function createGroup() {
    const name = document.getElementById('newGroupName').value.trim();
    
    if (!name) {
        showNotification('❌ Введите название группы', true);
        return;
    }
    
    try {
        const response = await fetch('/api/users/groups/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ name })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Группа создана');
            closeModal('createGroupModal');
            showGroupManagement();
        } else {
            showNotification('❌ Ошибка: ' + result.error, true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

// ============================================
// Редактирование группы
// ============================================

function editGroupName(groupId, currentName) {
    // Функция escapeHtml может быть не определена, определяем её если нужно
    if (typeof escapeHtml === 'undefined') {
        window.escapeHtml = function(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
    }
    
    // Экранируем имя для безопасного использования в HTML
    const escapedName = escapeHtml(currentName);
    
    const modalHtml = `
        <div class="modal-overlay" id="editGroupModal">
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>Изменение группы</h3>
                    <button class="modal-close-btn" id="closeEditGroupModal">×</button>
                </div>
                <div class="modal-body">
                    <div class="edit-form">
                        <div class="form-row">
                            <label for="editGroupName">Название группы</label>
                            <input type="text" id="editGroupName" value="${escapedName}">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" id="cancelEditGroup">Отмена</button>
                    <button class="btn btn-primary" id="saveEditGroup">Сохранить</button>
                </div>
            </div>
        </div>
    `;
    
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) {
        console.error('Modal container not found');
        return;
    }
    
    modalContainer.innerHTML = modalHtml;
    
    // Добавляем обработчики событий
    const modal = document.getElementById('editGroupModal');
    const closeBtn = document.getElementById('closeEditGroupModal');
    const cancelBtn = document.getElementById('cancelEditGroup');
    const saveBtn = document.getElementById('saveEditGroup');
    const nameInput = document.getElementById('editGroupName');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeModal('editGroupModal'));
    }
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeModal('editGroupModal'));
    }
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            saveGroupName(groupId, currentName);
        });
    }
    if (nameInput) {
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveGroupName(groupId, currentName);
            }
        });
        nameInput.focus();
        nameInput.select();
    }
}

async function saveGroupName(groupId, originalName) {
    console.log('saveGroupName called:', { groupId, originalName });
    
    // Находим элементы формы
    const modal = document.getElementById('editGroupModal');
    if (!modal) {
        console.error('Modal not found');
        showNotification('❌ Модальное окно не найдено', true);
        return;
    }
    
    const newNameInput = modal.querySelector('#editGroupName');
    if (!newNameInput) {
        console.error('Input field not found');
        showNotification('❌ Поле ввода не найдено', true);
        return;
    }
    
    const newName = newNameInput.value.trim();
    console.log('New name:', newName);
    
    if (!newName) {
        showNotification('❌ Введите название группы', true);
        return;
    }
    
    // Если имя не изменилось - просто закрываем окно
    if (newName === originalName) {
        console.log('Name unchanged, closing modal');
        closeModal('editGroupModal');
        return;
    }
    
    // Блокируем кнопку сохранения
    const saveButton = modal.querySelector('.btn-primary');
    const originalButtonText = saveButton ? saveButton.textContent : 'Сохранить';
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Сохранение...';
    }
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            console.error('CSRF token not found');
            showNotification('❌ Ошибка: CSRF токен не найден', true);
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = originalButtonText;
            }
            return;
        }
        
        console.log('Sending request:', { group_id: groupId, new_name: newName });
        
        const response = await fetch('/api/users/groups/update/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                group_id: groupId,
                new_name: newName
            })
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('HTTP error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Response data:', result);
        
        if (result.success) {
            showNotification('✅ Группа обновлена', false);
            closeModal('editGroupModal');
            // Перезагружаем список групп
            await showGroupManagement();
        } else {
            console.error('Server returned error:', result.error);
            showNotification('❌ Ошибка: ' + (result.error || 'Неизвестная ошибка'), true);
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = originalButtonText;
            }
        }
    } catch (error) {
        console.error('Error saving group name:', error);
        showNotification('❌ Ошибка: ' + error.message, true);
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = originalButtonText;
        }
    }
}

// ============================================
// Копирование группы
// ============================================

async function copyGroup(groupId) {
    if (!confirm('Создать копию этой группы?\n\nБудут скопированы настройки, но не пользователи.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/users/groups/copy/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ group_id: groupId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ ' + result.message);
            showGroupManagement();
        } else {
            showNotification('❌ Ошибка: ' + result.error, true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

// ============================================
// Объединение групп
// ============================================

function openMergeGroupsModal() {
    if (selectedGroupsForMerge.length < 2) {
        showNotification('❌ Выберите минимум 2 группы для объединения', true);
        return;
    }
    
    const groupsList = selectedGroupsForMerge.map(g => `• ${g.name}`).join('\n');
    
    const modalHtml = `
        <div class="modal-overlay" id="mergeGroupsModal">
            <div class="modal" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Объединение групп</h3>
                    <button class="modal-close-btn" onclick="closeModal('mergeGroupsModal')">×</button>
                </div>
                <div class="modal-body">
                    <div class="info-card" style="margin-bottom: 1rem;">
                        <h4>Выбранные группы (${selectedGroupsForMerge.length})</h4>
                        <div style="max-height: 120px; overflow-y: auto; font-size: 0.9rem;">
                            ${selectedGroupsForMerge.map(g => `<div style="padding: 0.25rem 0;">• ${g.name}</div>`).join('')}
                        </div>
                    </div>
                    
                    <div class="edit-form">
                        <div class="form-row">
                            <label for="mergeGroupName">Название новой группы *</label>
                            <input type="text" id="mergeGroupName" placeholder="Введите название объединённой группы">
                        </div>
                        
                        <div class="form-row" style="margin-top: 1rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="transferUsers" checked style="width: 18px; height: 18px;">
                                <span>Перенести пользователей в новую группу</span>
                            </label>
                        </div>
                        
                        <div class="form-row" style="margin-top: 0.75rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="checkbox" id="deleteOldGroups" style="width: 18px; height: 18px;">
                                <span>Удалить старые группы после объединения</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="closeModal('mergeGroupsModal')">Отмена</button>
                    <button class="btn btn-primary" onclick="mergeGroups()">Объединить</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('modal-container').insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('mergeGroupName').focus();
}

async function mergeGroups() {
    const newName = document.getElementById('mergeGroupName').value.trim();
    const transferUsers = document.getElementById('transferUsers').checked;
    const deleteOldGroups = document.getElementById('deleteOldGroups').checked;
    
    if (!newName) {
        showNotification('❌ Введите название новой группы', true);
        return;
    }
    
    // Подтверждение при удалении
    if (deleteOldGroups) {
        if (!confirm('Внимание! Старые группы будут удалены безвозвратно. Продолжить?')) {
            return;
        }
    }
    
    try {
        const response = await fetch('/api/users/groups/merge/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                group_ids: selectedGroupsForMerge.map(g => g.id),
                new_name: newName,
                transfer_users: transferUsers,
                delete_old_groups: deleteOldGroups
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ ' + result.message);
            closeModal('mergeGroupsModal');
            showGroupManagement();
        } else {
            showNotification('❌ Ошибка: ' + result.error, true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

// ============================================
// Удаление группы
// ============================================

async function deleteGroup(groupId, groupName) {
    if (!confirm(`Удалить группу "${groupName}"?\n\nЭто действие нельзя отменить.`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/users/groups/delete/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({ group_id: groupId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Группа удалена');
            showGroupManagement();
        } else {
            showNotification('❌ Ошибка: ' + result.error, true);
        }
    } catch (error) {
        showNotification('❌ Ошибка: ' + error.message, true);
    }
}

// ============================================
// Утилиты для модальных окон
// ============================================

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => modal.remove(), 200);
    }
}

