/**
 * Прогресс-бар для длительных операций
 * Показывается автоматически во время выполнения API-запросов
 */

// ============================================
// Управление прогресс-баром
// ============================================

let progressBarElement = null;
let activeRequests = 0;

/**
 * Показать прогресс-бар
 */
function showProgressBar() {
    activeRequests++;
    
    // Создаем элемент прогресс-бара, если его еще нет
    if (!progressBarElement) {
        progressBarElement = document.createElement('div');
        progressBarElement.id = 'progressBar';
        progressBarElement.style.position = 'fixed';
        progressBarElement.style.bottom = '20px';
        progressBarElement.style.left = '50%';
        progressBarElement.style.transform = 'translateX(-50%)';
        progressBarElement.style.width = '200px';
        progressBarElement.style.height = '4px';
        progressBarElement.style.background = '#e0e0e0';
        progressBarElement.style.borderRadius = '2px';
        progressBarElement.style.overflow = 'hidden';
        progressBarElement.style.zIndex = '99998';
        progressBarElement.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        progressBarElement.style.opacity = '0';
        progressBarElement.style.transition = 'opacity 0.3s ease';
        
        // Анимированная полоса прогресса
        const progressLine = document.createElement('div');
        progressLine.id = 'progressLine';
        progressLine.style.width = '100%';
        progressLine.style.height = '100%';
        progressLine.style.background = 'linear-gradient(90deg, var(--primary-color) 0%, #4a90e2 50%, var(--primary-color) 100%)';
        progressLine.style.backgroundSize = '200% 100%';
        progressLine.style.animation = 'progressAnimation 1.5s linear infinite';
        
        progressBarElement.appendChild(progressLine);
        document.body.appendChild(progressBarElement);
        
        // Добавляем CSS анимацию, если её еще нет
        if (!document.getElementById('progressAnimationStyle')) {
            const style = document.createElement('style');
            style.id = 'progressAnimationStyle';
            style.textContent = `
                @keyframes progressAnimation {
                    0% {
                        background-position: 200% 0;
                    }
                    100% {
                        background-position: -200% 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Показываем прогресс-бар, если он скрыт
    if (progressBarElement.style.display === 'none' || !progressBarElement.style.display) {
        progressBarElement.style.display = 'block';
        // Анимация появления
        setTimeout(() => {
            if (progressBarElement) {
                progressBarElement.style.opacity = '1';
            }
        }, 10);
    }
}

/**
 * Скрыть прогресс-бар
 */
function hideProgressBar() {
    if (activeRequests > 0) {
        activeRequests--;
    }
    
    // Скрываем только если нет активных запросов
    if (activeRequests <= 0) {
        activeRequests = 0;
        
        if (progressBarElement) {
            // Анимация исчезновения
            progressBarElement.style.opacity = '0';
            setTimeout(() => {
                if (progressBarElement && activeRequests === 0) {
                    progressBarElement.style.display = 'none';
                }
            }, 300);
        }
    }
}

/**
 * Сбросить счетчик активных запросов (на случай ошибок)
 */
function resetProgressBar() {
    activeRequests = 0;
    if (progressBarElement) {
        progressBarElement.style.display = 'none';
    }
}

// ============================================
// Обертка для fetch с автоматическим прогресс-баром
// ============================================

/**
 * Выполнить fetch-запрос с автоматическим показом прогресс-бара
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции для fetch (как в обычном fetch)
 * @returns {Promise<Response>} - Promise с ответом
 */
async function fetchWithProgress(url, options = {}) {
    showProgressBar();
    
    try {
        const response = await fetch(url, options);
        return response;
    } catch (error) {
        hideProgressBar();
        throw error;
    } finally {
        // Небольшая задержка перед скрытием, чтобы пользователь увидел завершение
        setTimeout(() => {
            hideProgressBar();
        }, 200);
    }
}

/**
 * Выполнить fetch-запрос и обработать JSON-ответ с автоматическим показом прогресс-бара
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции для fetch
 * @returns {Promise<Object>} - Promise с распарсенным JSON
 */
async function fetchJSONWithProgress(url, options = {}) {
    showProgressBar();
    
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        return { response, data };
    } catch (error) {
        hideProgressBar();
        throw error;
    } finally {
        // Небольшая задержка перед скрытием, чтобы пользователь увидел завершение
        setTimeout(() => {
            hideProgressBar();
        }, 200);
    }
}

// ============================================
// Глобальная обертка для fetch (автоматически для всех API-запросов)
// ============================================

/**
 * Инициализация глобальной обертки для fetch
 * Автоматически показывает прогресс-бар для всех запросов к /api/
 */
(function() {
    // Сохраняем оригинальный fetch
    const originalFetch = window.fetch;
    
    // Переопределяем fetch
    window.fetch = function(url, options = {}) {
        // Проверяем, является ли это запросом к нашему API
        const urlString = typeof url === 'string' ? url : url.toString();
        const isAPIRequest = urlString.includes('/api/');
        
        // Если это не API-запрос, используем оригинальный fetch
        if (!isAPIRequest) {
            return originalFetch.apply(this, arguments);
        }
        
        // Для API-запросов показываем прогресс-бар
        showProgressBar();
        
        // Выполняем оригинальный fetch
        const fetchPromise = originalFetch.apply(this, arguments);
        
        // Флаг, чтобы hideProgressBar вызывался только один раз
        let isHandled = false;
        
        const handleCompletion = () => {
            if (!isHandled) {
                isHandled = true;
                // Небольшая задержка перед скрытием, чтобы пользователь увидел завершение
                setTimeout(() => {
                    hideProgressBar();
                }, 200);
            }
        };
        
        // Обрабатываем завершение запроса (успешное или с ошибкой)
        fetchPromise
            .then(response => {
                handleCompletion();
                return response;
            })
            .catch(error => {
                handleCompletion();
                throw error;
            });
        
        return fetchPromise;
    };
})();

