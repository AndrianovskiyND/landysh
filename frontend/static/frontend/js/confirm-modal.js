/**
 * Модальное окно подтверждения - Ландыш
 * Замена стандартного confirm() на кастомное модальное окно
 * 
 * Этот модуль предоставляет функцию showConfirmModal() для замены
 * стандартного confirm() браузера, который может быть заблокирован
 * пользователем через настройки браузера.
 */

/**
 * Показать модальное окно подтверждения
 * @param {string} message - Текст сообщения для отображения
 * @param {string} title - Заголовок модального окна (по умолчанию "Подтверждение")
 * @returns {Promise<boolean>} - Promise, который резолвится с true при подтверждении, false при отмене
 */
function showConfirmModal(message, title = 'Подтверждение') {
    return new Promise((resolve) => {
        // Закрываем предыдущее модальное окно подтверждения, если оно есть
        const existingModal = document.getElementById('confirmModal');
        if (existingModal) {
            closeConfirmModal();
        }
        
        // Создаем модальное окно
        const modalHtml = `
            <div class="modal-overlay optimized" id="confirmModal" style="z-index: 10002;">
                <div class="modal" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3>${escapeHtmlForConfirm(title)}</h3>
                        <button class="modal-close-btn" onclick="closeConfirmModal(false)">×</button>
                    </div>
                    <div class="modal-body">
                        <p style="font-size: 1rem; line-height: 1.5; margin: 0;">
                            ${escapeHtmlForConfirm(message)}
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn" onclick="closeConfirmModal(false)" style="margin-right: 0.5rem;">
                            Отмена
                        </button>
                        <button class="btn btn-danger" onclick="closeConfirmModal(true)">
                            Подтвердить
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Вставляем модальное окно в контейнер
        const modalContainer = document.getElementById('modal-container');
        if (!modalContainer) {
            console.error('Modal container not found');
            resolve(false);
            return;
        }
        
        modalContainer.innerHTML = modalHtml;
        
        // Сохраняем функцию resolve в глобальной области для доступа из обработчиков
        window._confirmModalResolve = resolve;
        
        // Закрытие по клику на overlay (фон)
        const modal = document.getElementById('confirmModal');
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    closeConfirmModal(false);
                }
            });
        }
        
        // Закрытие по Escape
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeConfirmModal(false);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        // Сохраняем обработчик для последующего удаления
        window._confirmModalEscapeHandler = escapeHandler;
    });
}

/**
 * Закрыть модальное окно подтверждения
 * @param {boolean} confirmed - true если пользователь подтвердил, false если отменил
 */
function closeConfirmModal(confirmed = false) {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.classList.add('modal-closing');
        setTimeout(() => {
            modal.remove();
            // Вызываем resolve с результатом
            if (window._confirmModalResolve) {
                window._confirmModalResolve(confirmed);
                window._confirmModalResolve = null;
            }
            // Удаляем обработчик Escape
            if (window._confirmModalEscapeHandler) {
                document.removeEventListener('keydown', window._confirmModalEscapeHandler);
                window._confirmModalEscapeHandler = null;
            }
        }, 200);
    } else {
        // Если модальное окно уже удалено, все равно вызываем resolve
        if (window._confirmModalResolve) {
            window._confirmModalResolve(confirmed);
            window._confirmModalResolve = null;
        }
    }
}

/**
 * Экранирование HTML для безопасности
 * Локальная реализация для использования в модальном окне
 */
function escapeHtmlForConfirm(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

