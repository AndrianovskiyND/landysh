"""
Фильтры для логирования
"""
import logging


class RequireLoggingEnabled(logging.Filter):
    """
    Фильтр, который проверяет, включено ли логирование в настройках системы
    """
    def __init__(self, name=''):
        super().__init__(name)
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
        
        # Не кэшируем настройки логирования, чтобы изменения применялись сразу
        # (для других настроек можно использовать кэш)
        if key.startswith('logging_'):
            try:
                from core.models import SystemSettings
                from django.db import connection
                # Всегда читаем из базы напрямую, не используем кэш для настроек логирования
                # Используем прямой запрос к базе, чтобы избежать кэширования
                # Закрываем соединение после запроса, чтобы при следующем запросе получить свежие данные
                try:
                    # Используем прямой SQL запрос к базе без кэширования ORM
                    # Это гарантирует получение свежих данных из базы
                    from django.db import connection
                    with connection.cursor() as cursor:
                        # Используем параметризованный запрос (Django сам подставит правильный синтаксис)
                        # Для SQLite используем ?, для других БД Django подставит правильный синтаксис
                        if connection.vendor == 'sqlite':
                            cursor.execute("SELECT value FROM core_systemsettings WHERE key = ?", [key])
                        else:
                            cursor.execute("SELECT value FROM core_systemsettings WHERE key = %s", [key])
                        row = cursor.fetchone()
                        if row:
                            return row[0]
                        return default
                except Exception:
                    # Если SQL запрос не сработал, пробуем через ORM
                    try:
                        setting = SystemSettings.objects.get(key=key)
                        return setting.value
                    except SystemSettings.DoesNotExist:
                        return default
            except Exception:
                # В случае ошибки возвращаем значение по умолчанию
                return default
        
        # Проверяем кэш для других настроек
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
            # Проверяем, включено ли логирование (первым делом!)
            logging_enabled = self._get_setting('logging_enabled', 'true')
            # Нормализуем значение: 'true', 'True', 'TRUE', '1' -> True, все остальное -> False
            logging_enabled_str = str(logging_enabled).strip().lower()
            
            # КРИТИЧЕСКИ ВАЖНО: Если логирование выключено - сразу возвращаем False
            # Это должно быть первой проверкой и работать без исключений
            # Проверяем все возможные варианты "выключено"
            if logging_enabled_str in ('false', '0', 'no', 'off', '', 'none', 'null'):
                # Логирование выключено - не логируем
                return False
            
            # Если значение не 'true' и не одно из разрешенных - тоже считаем выключенным
            # (по умолчанию включено, но если явно указано что-то другое - выключаем)
            if logging_enabled_str not in ('true', '1', 'yes', 'on'):
                # Если значение не распознано - считаем выключенным для безопасности
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
            
            # Определяем тип лога
            is_rac = 'rac_client' in record.name or 'RAC' in str(record.getMessage())
            is_request = ('views' in record.name or 
                         'basehttp' in record.name or 
                         'request' in str(record.getMessage()).lower() or
                         'GET' in str(record.getMessage()) or
                         'POST' in str(record.getMessage()))
            
            # Если это логгер RAC команд
            if is_rac:
                if log_what in ['rac', 'both']:
                    return True
                return False
            
            # Если это логгер запросов (views, basehttp)
            if is_request:
                if log_what in ['requests', 'both']:
                    return True
                return False
            
            # Для остальных логгеров (django, core и т.д.) - логируем только если включено "both"
            if log_what == 'both':
                return True
            
            # Если это не RAC и не запросы, и настройка не "both" - не логируем
            return False
        except Exception as e:
            # В случае ошибки при проверке настроек логирования - выключаем логирование
            # (безопасный режим: лучше не логировать, чем логировать все подряд)
            # Только если это критическая ошибка инициализации - пропускаем
            if not self._is_apps_ready():
                return True
            # Если приложения готовы, но ошибка при чтении настроек - выключаем логирование
            return False

