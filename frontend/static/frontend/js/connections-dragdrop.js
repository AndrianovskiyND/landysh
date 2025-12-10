/**
 * Drag-and-Drop для папок и подключений - Ландыш
 * Перемещение подключений между папками и изменение порядка
 */

let draggedElement = null;
let draggedElementType = null; // 'folder' или 'connection'
let draggedElementId = null;

/**
 * Инициализация drag-and-drop для элемента
 */
function initDragDrop(element, elementType, elementId) {
    element.draggable = true;
    element.dataset.elementType = elementType;
    element.dataset.elementId = elementId;
    
    element.addEventListener('dragstart', handleDragStart);
    element.addEventListener('dragend', handleDragEnd);
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);
    element.addEventListener('dragenter', handleDragEnter);
    element.addEventListener('dragleave', handleDragLeave);
}

/**
 * Обработчик начала перетаскивания
 */
function handleDragStart(e) {
    draggedElement = this;
    draggedElementType = this.dataset.elementType;
    draggedElementId = parseInt(this.dataset.elementId);
    
    this.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

/**
 * Обработчик окончания перетаскивания
 */
function handleDragEnd(e) {
    this.style.opacity = '1';
    
    // Убираем визуальные эффекты со всех элементов
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
    
    draggedElement = null;
    draggedElementType = null;
    draggedElementId = null;
}

/**
 * Обработчик наведения при перетаскивании
 */
function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    
    e.dataTransfer.dropEffect = 'move';
    return false;
}

/**
 * Обработчик входа в зону перетаскивания
 */
function handleDragEnter(e) {
    if (this !== draggedElement) {
        this.classList.add('drag-over');
    }
}

/**
 * Обработчик выхода из зоны перетаскивания
 */
function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

/**
 * Обработчик сброса элемента
 */
async function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    e.preventDefault();
    this.classList.remove('drag-over');
    
    if (draggedElement === this) {
        return false;
    }
    
    const targetType = this.dataset.elementType;
    const targetId = this.dataset.elementId ? parseInt(this.dataset.elementId) : null;
    
    try {
        if (draggedElementType === 'folder' && targetType === 'folder') {
            // Перемещение папки
            await moveFolderOrder(draggedElementId, targetId);
        } else if (draggedElementType === 'connection') {
            if (targetType === 'folder') {
                // Перемещение подключения в папку
                await moveConnectionToFolder(draggedElementId, targetId);
            } else if (targetType === 'connection') {
                // Перемещение подключения относительно другого подключения
                await moveConnectionOrder(draggedElementId, targetId);
            } else {
                // Перемещение подключения вне папок
                await moveConnectionToFolder(draggedElementId, null);
            }
        }
        
        // Обновляем дерево
        loadConnections();
    } catch (error) {
        showNotification('❌ Ошибка перемещения: ' + error.message, true);
        console.error('Ошибка перемещения:', error);
    }
    
    return false;
}

/**
 * Переместить папку (изменить порядок)
 */
async function moveFolderOrder(folderId, targetFolderId) {
    // Получаем текущий порядок папок
    const folders = Array.from(document.querySelectorAll('[data-element-type="folder"]'));
    const draggedIndex = folders.findIndex(f => parseInt(f.dataset.elementId) === folderId);
    const targetIndex = folders.findIndex(f => parseInt(f.dataset.elementId) === targetFolderId);
    
    if (targetIndex === -1) {
        throw new Error('Целевая папка не найдена');
    }
    
    // Если перетаскиваем на ту же позицию, ничего не делаем
    if (draggedIndex === targetIndex) {
        return;
    }
    
    const csrfToken = getCSRFToken();
    if (!csrfToken) {
        throw new Error('CSRF токен не найден');
    }
    
    const response = await fetch(`/api/clusters/folders/${folderId}/move/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            order: targetIndex
        })
    });
    
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.error || 'Ошибка перемещения папки');
    }
}

/**
 * Переместить подключение в папку или изменить порядок
 */
async function moveConnectionToFolder(connectionId, folderId) {
    // Определяем порядок в целевой папке
    let order = 0;
    if (folderId) {
        const folderConnections = document.querySelectorAll(`[data-folder-id="${folderId}"][data-element-type="connection"]`);
        order = folderConnections.length;
    } else {
        const rootConnections = document.querySelectorAll('[data-folder-id=""][data-element-type="connection"]');
        order = rootConnections.length;
    }
    
    const csrfToken = getCSRFToken();
    if (!csrfToken) {
        throw new Error('CSRF токен не найден');
    }
    
    const response = await fetch(`/api/clusters/connections/${connectionId}/move/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            folder_id: folderId,
            order: order
        })
    });
    
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.error || 'Ошибка перемещения подключения');
    }
}

/**
 * Переместить подключение относительно другого подключения
 */
async function moveConnectionOrder(connectionId, targetConnectionId) {
    // Находим целевое подключение
    const targetElement = document.querySelector(`[data-element-type="connection"][data-element-id="${targetConnectionId}"]`);
    if (!targetElement) {
        throw new Error('Целевое подключение не найдено');
    }
    
    const folderId = targetElement.dataset.folderId || null;
    
    // Определяем порядок
    const folderConnections = Array.from(document.querySelectorAll(`[data-folder-id="${folderId || ''}"][data-element-type="connection"]`));
    const targetIndex = folderConnections.findIndex(c => parseInt(c.dataset.elementId) === targetConnectionId);
    
    if (targetIndex === -1) {
        throw new Error('Не удалось определить порядок');
    }
    
    const csrfToken = getCSRFToken();
    if (!csrfToken) {
        throw new Error('CSRF токен не найден');
    }
    
    const response = await fetch(`/api/clusters/connections/${connectionId}/move/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({
            folder_id: folderId,
            order: targetIndex
        })
    });
    
    const result = await response.json();
    
    if (!result.success) {
        throw new Error(result.error || 'Ошибка перемещения подключения');
    }
}

