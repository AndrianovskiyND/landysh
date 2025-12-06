/**
 * Системные настройки - Ландыш
 * Управление настройками системы
 */

// ============================================
// Отображение настроек
// ============================================

/**
 * Показать раздел системных настроек
 */
async function showSystemSettings() {
    currentView = 'settings';
    if (typeof saveCurrentView === 'function') {
        saveCurrentView('settings');
    }
    updateNavigation();
    
    try {
        const response = await fetch('/api/system/settings/');
        const data = await response.json();
        
        if (data.success) {
            renderSystemSettings(data.settings);
        } else {
            showNotification('Ошибка загрузки настроек: ' + data.error, true);
        }
    } catch (error) {
        showNotification('Ошибка загрузки настроек: ' + error.message, true);
    }
}

/**
 * Отрисовать форму системных настроек
 * @param {Object} settings - Объект с настройками
 */
function renderSystemSettings(settings) {
    const contentArea = document.getElementById('contentArea');
    
    let html = `
        <div style="margin-bottom: 1.5rem;">
            <h2>⚙️ Настройки системы</h2>
        </div>
        
        <div style="max-width: 700px;">
            <!-- Основные настройки -->
            <div class="info-card" style="margin-bottom: 1rem;">
                <h4>🔧 Основные настройки</h4>
                <div class="edit-form">
                    <div class="form-row">
                        <label>Путь к утилите RAC</label>
                        <input type="text" id="rac_path" value="${settings.rac_path}" placeholder="/opt/1cv8/x86_64/8.3.27.1860/rac">
                        <small style="color: #888; font-size: 0.75rem; margin-top: 0.25rem;">Абсолютный путь к исполняемому файлу rac</small>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                        <div class="form-row">
                            <label>Таймаут сессии (сек)</label>
                            <input type="number" id="session_timeout" value="${settings.session_timeout}">
                        </div>
                        <div class="form-row">
                            <label>Макс. подключений</label>
                            <input type="number" id="max_connections" value="${settings.max_connections}">
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Настройки уведомлений -->
            <div class="info-card" style="margin-bottom: 1rem;">
                <h4 style="border-bottom-color: var(--secondary-color);">📧 Настройки уведомлений</h4>
                <div class="edit-form">
                    <div class="form-row">
                        <label>SMTP сервер</label>
                        <input type="text" id="smtp_server" value="${settings.smtp_server}" placeholder="smtp.example.com">
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                        <div class="form-row">
                            <label>SMTP порт</label>
                            <input type="number" id="smtp_port" value="${settings.smtp_port}">
                        </div>
                        <div class="form-row">
                            <label>Email для уведомлений</label>
                            <input type="email" id="notification_email" value="${settings.notification_email}" placeholder="admin@example.com">
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Прочие настройки -->
            <div class="info-card" style="margin-bottom: 1rem;">
                <h4 style="border-bottom-color: #6366f1;">⚡ Прочие настройки</h4>
                <div class="edit-form">
                    <div class="form-row">
                        <label>Уровень логирования</label>
                        <select id="log_level">
                            <option value="DEBUG" ${settings.log_level === 'DEBUG' ? 'selected' : ''}>DEBUG</option>
                            <option value="INFO" ${settings.log_level === 'INFO' ? 'selected' : ''}>INFO</option>
                            <option value="WARNING" ${settings.log_level === 'WARNING' ? 'selected' : ''}>WARNING</option>
                            <option value="ERROR" ${settings.log_level === 'ERROR' ? 'selected' : ''}>ERROR</option>
                        </select>
                    </div>
                    
                    <div class="form-row">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; text-transform: none; letter-spacing: normal;">
                            <input type="checkbox" id="backup_enabled" ${settings.backup_enabled === 'true' ? 'checked' : ''} style="width: 18px; height: 18px;">
                            <span style="font-weight: 500; color: #333;">Резервное копирование настроек</span>
                        </label>
                    </div>
                </div>
            </div>
            
            <!-- Кнопки действий -->
            <div class="info-card">
                <h4>💾 Сохранение</h4>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary" onclick="saveSystemSettings()" style="flex: 1;">
                        💾 Сохранить настройки
                    </button>
                    <button class="btn" onclick="showDashboard()" style="background: #6c757d; color: white;">
                        Отмена
                    </button>
                </div>
            </div>
        </div>
    `;
    
    contentArea.innerHTML = html;
}

// ============================================
// Сохранение настроек
// ============================================

/**
 * Сохранить системные настройки
 */
async function saveSystemSettings() {
    const settings = {
        rac_path: document.getElementById('rac_path').value,
        session_timeout: document.getElementById('session_timeout').value,
        max_connections: document.getElementById('max_connections').value,
        log_level: document.getElementById('log_level').value,
        backup_enabled: document.getElementById('backup_enabled').checked ? 'true' : 'false',
        smtp_server: document.getElementById('smtp_server').value,
        smtp_port: document.getElementById('smtp_port').value,
        notification_email: document.getElementById('notification_email').value,
    };
    
    try {
        // Сохраняем каждую настройку отдельно
        const promises = Object.entries(settings).map(([key, value]) => 
            fetch('/api/system/settings/update/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify({ key, value })
            })
        );
        
        const results = await Promise.all(promises);
        const allSuccess = results.every(response => response.ok);
        
        if (allSuccess) {
            showNotification('✅ Настройки успешно сохранены');
        } else {
            showNotification('❌ Ошибка при сохранении некоторых настроек', true);
        }
    } catch (error) {
        showNotification('❌ Ошибка сохранения настроек: ' + error.message, true);
    }
}

