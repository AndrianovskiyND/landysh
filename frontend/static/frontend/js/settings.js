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
                        <input type="text" id="rac_path" value="${settings.rac_path || ''}" placeholder="/opt/1cv8/x86_64/8.3.27.1860/rac">
                        <small style="color: #888; font-size: 0.75rem; margin-top: 0.25rem;">Абсолютный путь к исполняемому файлу rac</small>
                    </div>
                </div>
            </div>
            
            <!-- Парольная политика -->
            <div class="info-card" style="margin-bottom: 1rem;">
                <h4 style="border-bottom-color: var(--primary-color);">🔐 Парольная политика</h4>
                <div class="edit-form">
                    <div class="form-row">
                        <label>Минимальная длина пароля</label>
                        <input type="number" id="password_min_length" value="${settings.password_min_length || '8'}" min="1" max="128">
                        <small style="color: #888; font-size: 0.75rem; margin-top: 0.25rem;">Минимальное количество символов в пароле</small>
                    </div>
                    
                    <div class="form-row">
                        <label>Сложность пароля</label>
                        <select id="password_complexity">
                            <option value="low" ${settings.password_complexity === 'low' ? 'selected' : ''}>Низкая (только буквы и цифры)</option>
                            <option value="medium" ${settings.password_complexity === 'medium' ? 'selected' : ''}>Средняя (буквы, цифры, спецсимволы)</option>
                            <option value="high" ${settings.password_complexity === 'high' ? 'selected' : ''}>Высокая (обязательны буквы, цифры, спецсимволы, регистры)</option>
                        </select>
                    </div>
                    
                    <div class="form-row">
                        <label>Срок действия пароля (дней)</label>
                        <input type="number" id="password_expiry_days" value="${settings.password_expiry_days || '90'}" min="1">
                        <small style="color: #888; font-size: 0.75rem; margin-top: 0.25rem;">Через сколько дней требуется смена пароля</small>
                    </div>
                    
                    <div class="form-row">
                        <label>Ограничение количества неудачных попыток входа</label>
                        <input type="number" id="password_max_failed_attempts" value="${settings.password_max_failed_attempts || '5'}" min="1" max="20">
                        <small style="color: #888; font-size: 0.75rem; margin-top: 0.25rem;">После скольких неудачных попыток блокировать учетную запись</small>
                    </div>
                    
                    <div class="form-row">
                        <label>Количество дней блокировки после неудачной попытки</label>
                        <input type="number" id="password_lockout_days" value="${settings.password_lockout_days || '1'}" min="0">
                        <small style="color: #888; font-size: 0.75rem; margin-top: 0.25rem;">0 = бесконечно (блокировка до разблокировки администратором)</small>
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
        password_min_length: document.getElementById('password_min_length').value,
        password_complexity: document.getElementById('password_complexity').value,
        password_expiry_days: document.getElementById('password_expiry_days').value,
        password_max_failed_attempts: document.getElementById('password_max_failed_attempts').value,
        password_lockout_days: document.getElementById('password_lockout_days').value,
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

