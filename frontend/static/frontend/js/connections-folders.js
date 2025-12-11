/**
 * Управление папками подключений - Ландыш
 * CRUD операции для папок
 */

/**
 * Открыть модальное окно для создания новой папки
 */
function openCreateFolderModal() {
    const modalHtml = `
        <div class="modal-overlay optimized" id="createFolderModal">
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>Создать папку</h3>
                    <button class="modal-close-btn" onclick="closeCreateFolderModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="edit-form">
                        <div class="form-row">
                            <label for="newFolderName">Название папки *</label>
                            <input type="text" id="newFolderName" value="" placeholder="Введите название папки">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="closeCreateFolderModal()">Отмена</button>
                    <button class="btn btn-primary" onclick="saveNewFolder()">Создать</button>
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('createFolderModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('newFolderName').focus();
}

/**
 * Закрыть модальное окно создания папки
 */
function closeCreateFolderModal() {
    const modal = document.getElementById('createFolderModal');
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => modal.remove(), 200);
    }
}

/**
 * Сохранить новую папку
 */
async function saveNewFolder() {
    const nameInput = document.getElementById('newFolderName');
    if (!nameInput) {
        return;
    }
    
    const name = nameInput.value.trim();
    if (!name) {
        showNotification('❌ Название папки обязательно', true);
        return;
    }
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден. Обновите страницу.', true);
            return;
        }
        
        const response = await fetch('/api/clusters/folders/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                name: name
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Папка создана');
            closeCreateFolderModal();
            loadConnections();
        } else {
            showNotification('❌ Ошибка создания папки: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка создания папки: ' + error.message, true);
    }
}

/**
 * Создать новую папку (старая функция для обратной совместимости)
 */
async function createFolder() {
    openCreateFolderModal();
}

/**
 * Открыть модальное окно для редактирования названия папки
 */
function openEditFolderModal(folderId, currentName) {
    const modalHtml = `
        <div class="modal-overlay optimized" id="editFolderModal">
            <div class="modal" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>Редактировать папку</h3>
                    <button class="modal-close-btn" onclick="closeEditFolderModal()">×</button>
                </div>
                <div class="modal-body">
                    <div class="edit-form">
                        <div class="form-row">
                            <label for="folderName">Название папки *</label>
                            <input type="text" id="folderName" value="${escapeHtml(currentName)}" placeholder="Введите название папки">
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="closeEditFolderModal()">Отмена</button>
                    <button class="btn btn-primary" onclick="saveFolderName(${folderId})">Сохранить</button>
                </div>
            </div>
        </div>
    `;
    
    const existingModal = document.getElementById('editFolderModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('folderName').focus();
    document.getElementById('folderName').select();
}

/**
 * Закрыть модальное окно редактирования папки
 */
function closeEditFolderModal() {
    const modal = document.getElementById('editFolderModal');
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => modal.remove(), 200);
    }
}

/**
 * Сохранить название папки
 */
async function saveFolderName(folderId) {
    const nameInput = document.getElementById('folderName');
    if (!nameInput) {
        return;
    }
    
    const name = nameInput.value.trim();
    if (!name) {
        showNotification('❌ Название папки обязательно', true);
        return;
    }
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден. Обновите страницу.', true);
            return;
        }
        
        const response = await fetch(`/api/clusters/folders/${folderId}/update/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
                name: name
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Название папки обновлено');
            closeEditFolderModal();
            loadConnections();
        } else {
            showNotification('❌ Ошибка обновления папки: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка обновления папки: ' + error.message, true);
    }
}

/**
 * Удалить папку
 */
async function deleteFolder(folderId, folderName) {
    if (!confirm(`Вы уверены, что хотите удалить папку "${folderName}"?\n\nПодключения в папке сохранятся, но потеряют привязку к папке.`)) {
        return;
    }
    
    try {
        const csrfToken = getCSRFToken();
        if (!csrfToken) {
            showNotification('❌ Ошибка: CSRF токен не найден. Обновите страницу.', true);
            return;
        }
        
        const response = await fetch(`/api/clusters/folders/${folderId}/delete/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Удаляем состояние папки из localStorage
            if (typeof getFoldersState === 'function' && typeof saveFoldersState === 'function') {
                const state = getFoldersState();
                delete state[folderId];
                saveFoldersState(state);
            }
            
            showNotification('✅ ' + (result.message || 'Папка удалена'));
            loadConnections();
        } else {
            showNotification('❌ Ошибка удаления папки: ' + (result.error || 'Неизвестная ошибка'), true);
        }
    } catch (error) {
        showNotification('❌ Ошибка удаления папки: ' + error.message, true);
    }
}

/**
 * Экранирование HTML для безопасности
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

