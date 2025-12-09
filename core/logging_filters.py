"""
Фильтры для логирования
"""
import logging


class RequireLoggingEnabled(logging.Filter):
    """
    Фильтр, который проверяет, включено ли логирование в настройках системы
    """
    def __init__(self):
        super().__init__()
        self._apps_ready = None
        self._settings_cache = {}
    
    def _is_apps_ready(self):
        """Проверяет, загружены ли приложения Django"""
        if self._apps_ready is None:
            try:
                from django.apps import apps
                self._apps_ready = apps.apps.ready
            except Exception:
                self._apps_ready = False
        return self._apps_ready
    
    def _get_setting(self, key, default):
        """Получает настройку из кэша или базы данных"""
        # Если приложения не готовы - используем значение по умолчанию
        if not self._is_apps_ready():
            return default
        
        # Проверяем кэш
        if key in self._settings_cache:
            return self._settings_cache[key]
        
        try:
            from core.models import SystemSettings
            value = SystemSettings.get_setting(key, default)
            self._settings_cache[key] = value
            return value
        except Exception:
            # В случае ошибки возвращаем значение по умолчанию
            return default
    
    def filter(self, record):
        # На этапе инициализации Django - пропускаем все логи
        if not self._is_apps_ready():
            return True
        
        try:
            # Проверяем, включено ли логирование
            logging_enabled = self._get_setting('logging_enabled', 'true')
            if logging_enabled.lower() != 'true':
                return False
            
            # Проверяем уровень логирования
            log_level = self._get_setting('logging_level', 'INFO').upper()
            level_map = {
                'DEBUG': logging.DEBUG,
                'INFO': logging.INFO,
                'WARNING': logging.WARNING,
                'ERROR': logging.ERROR,
                'CRITICAL': logging.CRITICAL,
            }
            min_level = level_map.get(log_level, logging.INFO)
            
            # Проверяем, соответствует ли уровень записи минимальному уровню
            if record.levelno < min_level:
                return False
            
            # Проверяем, что нужно логировать (RAC команды, запросы или оба)
            log_what = self._get_setting('logging_what', 'both')
            
            # Если это логгер RAC команд
            if 'rac_client' in record.name or 'RAC' in str(record.getMessage()):
                if log_what in ['rac', 'both']:
                    return True
                return False
            
            # Если это логгер запросов (views)
            if 'views' in record.name or 'request' in str(record.getMessage()).lower():
                if log_what in ['requests', 'both']:
                    return True
                return False
            
            # Для остальных логгеров - логируем если включено "both" или если это не относится к RAC/запросам
            if log_what == 'both':
                return True
            
            return False
        except Exception:
            # В случае любой ошибки - пропускаем все логи (безопасный режим)
            return True

