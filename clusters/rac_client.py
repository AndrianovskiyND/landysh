import subprocess
import json
import os
import sys
from django.conf import settings
from core.models import SystemSettings
import logging

logger = logging.getLogger(__name__)

def fix_broken_encoding(text):
    """
    Исправляет текст, который был неправильно декодирован (CP1251 прочитанная как UTF-8).
    Например: "РќРµРґРѕС‚Р°С‚РѕС‡РЅРѕ" -> "Недостаточно"
    """
    if not text:
        return text
    
    # Если это байты, сначала декодируем
    if isinstance(text, bytes):
        # Пробуем разные кодировки для байтов
        for encoding in ['cp1251', 'koi8-r', 'utf-8', 'cp866']:
            try:
                decoded = text.decode(encoding, errors='replace')
                cyrillic_count = sum(1 for char in decoded if '\u0400' <= char <= '\u04FF')
                if cyrillic_count > 0:
                    return decoded
            except (UnicodeDecodeError, LookupError):
                continue
        # Если ничего не подошло, пробуем UTF-8 с заменой
        return text.decode('utf-8', errors='replace')
    
    if not isinstance(text, str):
        return str(text)
    
    # Проверяем на признаки "битой" кодировки
    # Расширенный список "битых" символов и паттернов
    broken_patterns = [
        'Рќ', 'Рµ', 'Рґ', 'Рѕ', 'С‚', 'Р°', 'С‚Рѕ', 'С‡РЅРѕ', 'РїСЂР°РІ', 
        'РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ', 'РЅР°', 'РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅСѓСЋ', 'Р±Р°Р·Сѓ',
        # Паттерны для "Недостаточно прав пользователя на информационную базу"
        'РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ', 'РїСЂР°РІ', 'РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ', 'РёРЅС„РѕСЂРјР°С†РёРѕРЅРЅСѓСЋ', 'Р±Р°Р·Сѓ'
    ]
    broken_count = sum(1 for pattern in broken_patterns if pattern in text)
    cyrillic_count = sum(1 for char in text if '\u0400' <= char <= '\u04FF')
    
    # Также проверяем на отдельные "битые" символы
    broken_chars = ['Р', 'С']
    broken_chars_count = sum(1 for char in text if char in broken_chars)
    
    # Если есть "битые" символы и нет правильной кириллицы - пытаемся исправить
    if (broken_count > 0 or broken_chars_count > 3) and cyrillic_count == 0:
        try:
            # Кодируем обратно в байты как UTF-8, затем декодируем как CP1251
            fixed_bytes = text.encode('utf-8', errors='replace')
            fixed_text = fixed_bytes.decode('cp1251', errors='replace')
            fixed_cyrillic = sum(1 for char in fixed_text if '\u0400' <= char <= '\u04FF')
            if fixed_cyrillic > 0:
                logger.info(f"Fixed broken encoding: {broken_count} broken patterns, {broken_chars_count} broken chars -> {fixed_cyrillic} cyrillic chars")
                return fixed_text
        except (UnicodeEncodeError, UnicodeDecodeError, LookupError) as e:
            logger.debug(f"Failed to fix broken encoding: {e}")
            pass
        
        # Пробуем koi8-r
        try:
            fixed_bytes = text.encode('utf-8', errors='replace')
            fixed_text = fixed_bytes.decode('koi8-r', errors='replace')
            fixed_cyrillic = sum(1 for char in fixed_text if '\u0400' <= char <= '\u04FF')
            if fixed_cyrillic > 0:
                logger.info(f"Fixed broken encoding with koi8-r: {fixed_cyrillic} cyrillic chars")
                return fixed_text
        except (UnicodeEncodeError, UnicodeDecodeError, LookupError):
            pass
    
    return text

class RACClient:
    def __init__(self, server_connection, cluster_admin=None, cluster_password=None):
        self.server_connection = server_connection
        # Получаем путь к RAC из системных настроек
        self.rac_path = SystemSettings.get_setting('rac_path', settings.RAC_PATH)
        # Администратор кластера (передается отдельно, не из server_connection)
        self.cluster_admin = cluster_admin
        self.cluster_password = cluster_password
        
    def _mask_sensitive_data(self, command):
        """Маскирует чувствительные данные в команде для логирования"""
        masked = command
        if self.cluster_admin:
            masked = masked.replace(self.cluster_admin, '***')
        if self.cluster_password:
            masked = masked.replace(str(self.cluster_password), '***')
        if self.server_connection.agent_user:
            masked = masked.replace(self.server_connection.agent_user, '***')
        if self.server_connection.agent_password:
            masked = masked.replace(str(self.server_connection.agent_password), '***')
        return masked
        
    def _execute_command(self, args):
        """Выполняет команду rac и возвращает результат"""
        connection_str = self.server_connection.get_connection_string()
        
        # Формируем базовые аргументы
        cmd_args = [self.rac_path] + args + [connection_str]
        
        # Добавляем аутентификацию только для команд, которые её поддерживают
        # Команда 'cluster list' НЕ поддерживает параметры --cluster-user и --cluster-pwd
        # Проверяем, не является ли это командой 'cluster list'
        is_cluster_list = len(args) >= 2 and args[0] == 'cluster' and args[1] == 'list'
        
        # Добавляем аутентификацию кластера только если это НЕ cluster list
        if not is_cluster_list and self.cluster_admin:
            # Параметры --cluster-user и --cluster-pwd должны идти ПОСЛЕ --cluster=...
            # Ищем позицию параметра --cluster= в аргументах
            cluster_param_index = None
            for i, arg in enumerate(cmd_args):
                if arg.startswith('--cluster='):
                    cluster_param_index = i
                    break
            
            if cluster_param_index is not None:
                # Вставляем после --cluster=
                insert_pos = cluster_param_index + 1
                cmd_args.insert(insert_pos, f'--cluster-user={self.cluster_admin}')
                if self.cluster_password:
                    cmd_args.insert(insert_pos + 1, f'--cluster-pwd={self.cluster_password}')
            else:
                # Если параметра --cluster= нет, вставляем в начало (для обратной совместимости)
                cmd_args.insert(1, f'--cluster-user={self.cluster_admin}')
                if self.cluster_password:
                    cmd_args.insert(2, f'--cluster-pwd={self.cluster_password}')
        
        # Добавляем аутентификацию агента для команд, которые её поддерживают
        # Команда 'cluster list' поддерживает параметры --agent-user и --agent-pwd
        if self.server_connection.agent_user:
            # Параметры --agent-user и --agent-pwd можно добавлять в любом месте команды
            # Добавляем их перед connection_str (в конец аргументов, но перед connection_str)
            insert_pos = len(cmd_args) - 1  # Позиция перед connection_str
            cmd_args.insert(insert_pos, f'--agent-user={self.server_connection.agent_user}')
            if self.server_connection.agent_password:
                cmd_args.insert(insert_pos + 1, f'--agent-pwd={self.server_connection.agent_password}')
        
        # Логируем маскированную команду
        masked_cmd = self._mask_sensitive_data(' '.join(cmd_args))
        logger.info(f"Executing RAC command: {masked_cmd}")
        # Логируем полную команду на уровне DEBUG (если включено логирование RAC)
        logger.debug(f"Full RAC command: {' '.join(cmd_args)}")
        
        try:
            # Определяем кодировку в зависимости от ОС
            # В Windows консоль обычно использует cp866 (DOS кодировка), RAC может использовать cp1251
            # Пробуем сначала cp866, так как это стандартная кодировка консоли Windows
            if sys.platform == 'win32':
                # Пробуем разные кодировки для Windows
                encodings_to_try = ['cp866', 'cp1251', 'utf-8']
            else:
                encodings_to_try = ['utf-8']
            
            # Подготавливаем переменные окружения для subprocess
            # Явно устанавливаем кодировку для Linux, чтобы RAC выводил в правильной кодировке
            env = os.environ.copy()
            if sys.platform != 'win32':
                # Для Linux явно устанавливаем UTF-8, но RAC может все равно выводить в cp1251
                # Используем ru_RU.utf8 (строчными), так как это стандартное имя локали в Linux
                env['LANG'] = 'ru_RU.utf8'
                env['LC_ALL'] = 'ru_RU.utf8'
                env['LC_CTYPE'] = 'ru_RU.utf8'
                env['PYTHONIOENCODING'] = 'utf-8'
            
            # Запускаем команду без text=True, чтобы получить байты
            result = subprocess.run(
                cmd_args,
                capture_output=True,
                env=env,
                timeout=30  # 30 секунд таймаут
            )
            
            def decode_text(data_bytes):
                """Пробует декодировать текст с разными кодировками"""
                if not data_bytes:
                    return ''
                if isinstance(data_bytes, str):
                    return data_bytes
                
                # Определяем основную кодировку в зависимости от ОС
                # Получаем настройки из SystemSettings или используем значения по умолчанию
                if sys.platform == 'win32':
                    # Windows: получаем основную кодировку из настроек
                    primary_encoding = SystemSettings.get_setting('encoding_windows', 'cp866')
                    # Fallback кодировки для Windows (если основная не подходит)
                    fallback_encodings = ['cp1251', 'utf-8', 'latin1']
                else:
                    # Linux (РЕД ОС, CentOS и т.д.): получаем основную кодировку из настроек
                    primary_encoding = SystemSettings.get_setting('encoding_linux', 'utf-8')
                    # Fallback кодировки для Linux (если основная не подходит)
                    fallback_encodings = ['cp1251', 'cp866', 'koi8-r', 'latin1']
                
                # Формируем список кодировок: сначала основная, затем fallback
                all_encodings = [primary_encoding] + [e for e in fallback_encodings if e != primary_encoding]
                
                best_decoded = None
                best_score = 0
                best_encoding = None
                broken_utf8_decoded = None
                broken_utf8_score = 0
                
                # Сначала пробуем декодировать как utf-8, чтобы проверить на "битую" кодировку
                try:
                    utf8_decoded = data_bytes.decode('utf-8', errors='replace')
                    broken_chars = ['Р', 'С', 'Рµ', 'РЅ', 'Рѕ', 'Р°', 'РІ', 'Рё', 'Р»', 'Рј', 'РЅ', 'Рѕ', 'Рї', 'СЂ', 'СЃ', 'С‚', 'Сѓ', 'С„', 'С…', 'С†', 'С‡', 'С€', 'С‰', 'СЉ', 'С‹', 'СЊ', 'СЌ', 'СЋ', 'СЏ']
                    broken_count = sum(1 for char in utf8_decoded if char in broken_chars)
                    utf8_cyrillic = sum(1 for char in utf8_decoded if '\u0400' <= char <= '\u04FF')
                    
                    # Если много "битых" символов и нет кириллицы - это явно cp1251, прочитанная как utf-8
                    # Снижаем порог до 1 для более агрессивного обнаружения
                    if broken_count > 0 and utf8_cyrillic == 0:
                        broken_utf8_decoded = utf8_decoded
                        broken_utf8_score = broken_count
                        logger.debug(f"Detected broken encoding: {broken_count} broken chars, trying cp1251 first")
                except (UnicodeDecodeError, LookupError):
                    pass
                
                # Если обнаружена "битая" кодировка - сразу пробуем cp1251
                if broken_utf8_decoded and broken_utf8_score > 0:
                    try:
                        cp1251_decoded = data_bytes.decode('cp1251', errors='replace')
                        cp1251_cyrillic = sum(1 for char in cp1251_decoded if '\u0400' <= char <= '\u04FF')
                        if cp1251_cyrillic > 0:
                            logger.info(f"Fixed broken encoding: decoded as cp1251 with {cp1251_cyrillic} cyrillic characters (found {broken_utf8_score} broken utf-8 chars)")
                            return cp1251_decoded
                    except (UnicodeDecodeError, LookupError):
                        pass
                    
                    # Пробуем koi8-r для Linux
                    if sys.platform != 'win32':
                        try:
                            koi8_decoded = data_bytes.decode('koi8-r', errors='replace')
                            koi8_cyrillic = sum(1 for char in koi8_decoded if '\u0400' <= char <= '\u04FF')
                            if koi8_cyrillic > 0:
                                logger.info(f"Fixed broken encoding: decoded as koi8-r with {koi8_cyrillic} cyrillic characters")
                                return koi8_decoded
                        except (UnicodeDecodeError, LookupError):
                            pass
                
                # Сначала пробуем основную кодировку из настроек
                # Если она успешно декодирует - используем её (даже если нет кириллицы)
                try:
                    primary_decoded = data_bytes.decode(primary_encoding, errors='replace')
                    primary_cyrillic = sum(1 for char in primary_decoded if '\u0400' <= char <= '\u04FF')
                    # Если основная кодировка успешно декодирует и есть кириллица - используем её
                    if primary_cyrillic > 0:
                        logger.debug(f"Decoded with {primary_cyrillic} cyrillic characters using primary encoding: {primary_encoding}")
                        logger.debug(f"Decoded text (first 200 chars): {primary_decoded[:200]}")
                        return primary_decoded
                    # Если кириллицы нет, но декодирование успешно - тоже используем основную
                    # (возможно, это английский текст или данные без кириллицы)
                    logger.debug(f"Decoded using primary encoding {primary_encoding} (no cyrillic, but successful decode)")
                    return primary_decoded
                except (UnicodeDecodeError, LookupError):
                    logger.debug(f"Primary encoding {primary_encoding} failed, trying fallback encodings")
                    pass
                
                # Если основная кодировка не подошла - пробуем fallback
                for encoding in fallback_encodings:
                    try:
                        decoded = data_bytes.decode(encoding, errors='replace')
                        # Подсчитываем количество кириллических символов
                        cyrillic_count = sum(1 for char in decoded if '\u0400' <= char <= '\u04FF')
                        
                        # Если есть кириллица, это хороший признак
                        if cyrillic_count > best_score:
                            best_decoded = decoded
                            best_score = cyrillic_count
                            best_encoding = encoding
                        elif best_decoded is None:
                            # Если кириллицы нет, но декодирование прошло - сохраняем как запасной вариант
                            best_decoded = decoded
                            best_encoding = encoding
                    except (UnicodeDecodeError, LookupError):
                        continue
                
                # Если нашли вариант с кириллицей - возвращаем его
                if best_decoded and best_score > 0:
                    logger.debug(f"Decoded with {best_score} cyrillic characters using fallback encoding: {best_encoding}")
                    # Логируем результат декодирования на уровне DEBUG
                    logger.debug(f"Decoded text (first 200 chars): {best_decoded[:200]}")
                    return best_decoded
                
                # Возвращаем лучший вариант или строковое представление
                return best_decoded if best_decoded else str(data_bytes)
            
            if result.returncode != 0:
                # Декодируем ошибку с правильной кодировкой
                # Сначала пробуем stderr, если пусто - пробуем stdout
                error_bytes = result.stderr if result.stderr else result.stdout
                
                # Если ошибка уже пришла как строка (не байты), сразу исправляем кодировку
                if isinstance(error_bytes, str):
                    error_text = fix_broken_encoding(error_bytes)
                elif error_bytes:
                    # Логируем сырые байты для отладки (первые 200 байт)
                    logger.debug(f"Raw error bytes (first 200): {error_bytes[:200]}")
                    # Для Linux используем улучшенную логику декодирования
                    if sys.platform != 'win32':
                        # Сначала пробуем декодировать как UTF-8, чтобы проверить на "битую" кодировку
                        try:
                            utf8_decoded = error_bytes.decode('utf-8', errors='replace')
                            # Проверяем на признаки "битой" кодировки (CP1251, прочитанная как UTF-8)
                            broken_chars = ['Р', 'С', 'Рµ', 'РЅ', 'Рѕ', 'Р°', 'РІ', 'Рё', 'Р»', 'Рј', 'РЅ', 'Рѕ', 'Рї', 'СЂ', 'СЃ', 'С‚', 'Сѓ', 'С„', 'С…', 'С†', 'С‡', 'С€', 'С‰', 'СЉ', 'С‹', 'СЊ', 'СЌ', 'СЋ', 'СЏ']
                            broken_count = sum(1 for char in utf8_decoded if char in broken_chars)
                            utf8_cyrillic = sum(1 for char in utf8_decoded if '\u0400' <= char <= '\u04FF')
                            
                            # Если есть "битые" символы и нет кириллицы - это CP1251, прочитанная как UTF-8
                            if broken_count > 0 and utf8_cyrillic == 0:
                                # Пробуем декодировать как CP1251
                                try:
                                    cp1251_text = error_bytes.decode('cp1251', errors='replace')
                                    cp1251_cyrillic = sum(1 for char in cp1251_text if '\u0400' <= char <= '\u04FF')
                                    if cp1251_cyrillic > 0:
                                        logger.info(f"Error fixed: decoded as cp1251 with {cp1251_cyrillic} cyrillic characters (found {broken_count} broken utf-8 chars)")
                                        error_text = cp1251_text
                                    else:
                                        # Пробуем koi8-r
                                        try:
                                            koi8_text = error_bytes.decode('koi8-r', errors='replace')
                                            koi8_cyrillic = sum(1 for char in koi8_text if '\u0400' <= char <= '\u04FF')
                                            if koi8_cyrillic > 0:
                                                logger.info(f"Error decoded as koi8-r with {koi8_cyrillic} cyrillic characters")
                                                error_text = koi8_text
                                            else:
                                                error_text = decode_text(error_bytes)
                                        except (UnicodeDecodeError, LookupError):
                                            error_text = decode_text(error_bytes)
                                except (UnicodeDecodeError, LookupError):
                                    error_text = decode_text(error_bytes)
                            else:
                                # Нет признаков "битой" кодировки, используем стандартное декодирование
                                error_text = decode_text(error_bytes)
                        except (UnicodeDecodeError, LookupError):
                            error_text = decode_text(error_bytes)
                    else:
                        error_text = decode_text(error_bytes)
                else:
                    error_text = "Unknown error (no error output)"
                
                # Проверяем и исправляем "битую" кодировку, если ошибка уже была неправильно декодирована
                error_text = fix_broken_encoding(error_text)
                
                # Логируем с правильной кодировкой
                logger.error(f"RAC command failed: {error_text}")
                return {'success': False, 'error': error_text}
            
            # Декодируем вывод с правильной кодировкой
            output_text = decode_text(result.stdout)
            # Логируем результаты команд RAC на уровне DEBUG
            if output_text:
                logger.debug(f"RAC stdout (first 500 chars): {output_text[:500]}")
            return {'success': True, 'output': output_text}
            
        except subprocess.TimeoutExpired:
            logger.error("RAC command timeout")
            return {'success': False, 'error': 'Timeout exceeded'}
        except Exception as e:
            logger.error(f"RAC command exception: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def get_cluster_list(self):
        """Получает список кластеров"""
        return self._execute_command(['cluster', 'list'])
    
    def get_cluster_info(self, cluster_uuid):
        """Получает детальную информацию о кластере"""
        args = [
            'cluster', 'info',
            f'--cluster={cluster_uuid}'
        ]
        return self._execute_command(args)
    
    def update_cluster(self, cluster_uuid, **kwargs):
        """Обновляет параметры кластера
        
        Args:
            cluster_uuid: UUID кластера
            **kwargs: Параметры для обновления (name, expiration-timeout, и т.д.)
                     Могут быть с подчеркиваниями (expiration_timeout) или дефисами (expiration-timeout)
        """
        args = ['cluster', 'update', f'--cluster={cluster_uuid}']
        
        # Маппинг параметров Python на параметры RAC
        param_mapping = {
            'name': '--name',
            'expiration_timeout': '--expiration-timeout',
            'lifetime_limit': '--lifetime-limit',
            'max_memory_size': '--max-memory-size',
            'max_memory_time_limit': '--max-memory-time-limit',
            'security_level': '--security-level',
            'session_fault_tolerance_level': '--session-fault-tolerance-level',
            'load_balancing_mode': '--load-balancing-mode',
            'errors_count_threshold': '--errors-count-threshold',
            'kill_problem_processes': '--kill-problem-processes',
            'kill_by_memory_with_dump': '--kill-by-memory-with-dump',
            'allow_access_right_audit_events_recording': '--allow-access-right-audit-events-recording',
            'ping_period': '--ping-period',
            'ping_timeout': '--ping-timeout',
            'restart_schedule': '--restart-schedule',
        }
        
        for key, value in kwargs.items():
            if value is not None:
                # Если ключ уже с дефисами (из cluster list), используем его напрямую
                if key.startswith('--'):
                    param_name = key
                elif key in param_mapping:
                    param_name = param_mapping[key]
                elif '-' in key:
                    # Если ключ содержит дефисы, добавляем префикс --
                    param_name = f'--{key}'
                else:
                    # Иначе пропускаем неизвестный параметр
                    continue
                
                # Для булевых значений используем yes/no
                if isinstance(value, bool):
                    value = 'yes' if value else 'no'
                
                value_str = str(value)
                
                # Для строковых значений с пробелами (например, restart-schedule с cron-выражением)
                # передаем параметр и значение отдельно, чтобы RAC правильно распознал значение
                if isinstance(value, str) and ' ' in value_str:
                    # Для строк с пробелами передаем параметр и значение отдельно
                    # Это позволяет RAC правильно распознать значение с пробелами
                    args.append(param_name)
                    args.append(value_str)
                elif isinstance(value, str) and value_str == '' and key == 'restart_schedule':
                    # Для пустого значения restart_schedule передаем параметр с пустым значением для очистки
                    args.append(f'{param_name}=')
                else:
                    # Для остальных значений передаем в формате --param=value
                    args.append(f'{param_name}={value_str}')
        
        return self._execute_command(args)
    
    def insert_cluster(self, host, port, **kwargs):
        """Регистрирует новый кластер
        
        Args:
            host: Имя или IP-адрес компьютера нового кластера (параметр --host)
            port: Основной порт основного менеджера нового кластера (параметр --port)
            **kwargs: Дополнительные параметры (name, expiration-timeout, и т.д.)
        """
        # Получаем host:port из настроек подключения (ServerConnection)
        # Это то, что идёт после 'rac' в команде: rac <host>[:<port>] cluster insert ...
        connection_str = self.server_connection.get_connection_string()
        
        # Аргументы команды cluster insert
        args = ['cluster', 'insert', f'--host={host}', f'--port={port}']
        
        # Маппинг параметров Python на параметры RAC
        param_mapping = {
            'name': '--name',
            'expiration_timeout': '--expiration-timeout',
            'lifetime_limit': '--lifetime-limit',
            'max_memory_size': '--max-memory-size',
            'max_memory_time_limit': '--max-memory-time-limit',
            'security_level': '--security-level',
            'session_fault_tolerance_level': '--session-fault-tolerance-level',
            'load_balancing_mode': '--load-balancing-mode',
            'errors_count_threshold': '--errors-count-threshold',
            'kill_problem_processes': '--kill-problem-processes',
            'kill_by_memory_with_dump': '--kill-by-memory-with-dump',
            'allow_access_right_audit_events_recording': '--allow-access-right-audit-events-recording',
            'ping_period': '--ping-period',
            'ping_timeout': '--ping-timeout',
        }
        
        for key, value in kwargs.items():
            if key in param_mapping and value is not None:
                param_name = param_mapping[key]
                # Для булевых значений используем yes/no
                if isinstance(value, bool):
                    value = 'yes' if value else 'no'
                args.append(f'{param_name}={value}')
        
        # Формируем команду: rac [auth] cluster insert ... <connection_str>
        # где connection_str - это host:port из настроек подключения
        cmd_args = [self.rac_path]
        
        # Добавляем аутентификацию если есть (после rac, перед аргументами команды)
        if self.cluster_admin:
            cmd_args.append(f'--cluster-user={self.cluster_admin}')
            if self.cluster_password:
                cmd_args.append(f'--cluster-pwd={self.cluster_password}')
        
        # Добавляем аргументы команды
        cmd_args.extend(args)
        
        # Добавляем connection_str в конец (host:port из настроек подключения)
        cmd_args.append(connection_str)
        
        # Логируем маскированную команду
        masked_cmd = self._mask_sensitive_data(' '.join(cmd_args))
        logger.info(f"Executing RAC command: {masked_cmd}")
        
        # Выполняем команду напрямую
        try:
            # Определяем кодировку в зависимости от ОС
            if sys.platform == 'win32':
                encodings_to_try = ['cp866', 'cp1251', 'utf-8']
            else:
                encodings_to_try = ['utf-8']
            
            # Подготавливаем переменные окружения для subprocess
            env = os.environ.copy()
            if sys.platform != 'win32':
                # Используем ru_RU.utf8 (строчными), так как это стандартное имя локали в Linux
                env['LANG'] = 'ru_RU.utf8'
                env['LC_ALL'] = 'ru_RU.utf8'
                env['LC_CTYPE'] = 'ru_RU.utf8'
                env['PYTHONIOENCODING'] = 'utf-8'
            
            result = subprocess.run(
                cmd_args,
                capture_output=True,
                env=env,
                timeout=30
            )
            
            def decode_text(data_bytes):
                """Пробует декодировать текст с разными кодировками"""
                if not data_bytes:
                    return ''
                if isinstance(data_bytes, str):
                    return data_bytes
                
                # Определяем основную кодировку в зависимости от ОС
                # Получаем настройки из SystemSettings или используем значения по умолчанию
                if sys.platform == 'win32':
                    # Windows: получаем основную кодировку из настроек
                    primary_encoding = SystemSettings.get_setting('encoding_windows', 'cp866')
                    # Fallback кодировки для Windows (если основная не подходит)
                    fallback_encodings = ['cp1251', 'utf-8', 'latin1']
                else:
                    # Linux (РЕД ОС, CentOS и т.д.): получаем основную кодировку из настроек
                    primary_encoding = SystemSettings.get_setting('encoding_linux', 'utf-8')
                    # Fallback кодировки для Linux (если основная не подходит)
                    fallback_encodings = ['cp1251', 'cp866', 'koi8-r', 'latin1']
                
                best_decoded = None
                best_score = 0
                best_encoding = None
                broken_utf8_decoded = None
                broken_utf8_score = 0
                
                # Сначала пробуем основную кодировку из настроек
                try:
                    primary_decoded = data_bytes.decode(primary_encoding, errors='replace')
                    primary_cyrillic = sum(1 for char in primary_decoded if '\u0400' <= char <= '\u04FF')
                    if primary_cyrillic > 0:
                        return primary_decoded
                    # Если кириллицы нет, но декодирование успешно - тоже используем основную
                    return primary_decoded
                except (UnicodeDecodeError, LookupError):
                    pass
                
                # Сначала пробуем декодировать как utf-8, чтобы проверить на "битую" кодировку
                try:
                    utf8_decoded = data_bytes.decode('utf-8', errors='replace')
                    broken_chars = ['Р', 'С', 'Рµ', 'РЅ', 'Рѕ', 'Р°', 'РІ', 'Рё', 'Р»', 'Рј', 'РЅ', 'Рѕ', 'Рї', 'СЂ', 'СЃ', 'С‚', 'Сѓ', 'С„', 'С…', 'С†', 'С‡', 'С€', 'С‰', 'СЉ', 'С‹', 'СЊ', 'СЌ', 'СЋ', 'СЏ']
                    broken_count = sum(1 for char in utf8_decoded if char in broken_chars)
                    utf8_cyrillic = sum(1 for char in utf8_decoded if '\u0400' <= char <= '\u04FF')
                    
                    # Если много "битых" символов и нет кириллицы - это явно cp1251, прочитанная как utf-8
                    # Снижаем порог до 1 для более агрессивного обнаружения
                    if broken_count > 0 and utf8_cyrillic == 0:
                        broken_utf8_decoded = utf8_decoded
                        broken_utf8_score = broken_count
                        logger.debug(f"Detected broken encoding: {broken_count} broken chars, trying cp1251 first")
                except (UnicodeDecodeError, LookupError):
                    pass
                
                # Если обнаружена "битая" кодировка - сразу пробуем cp1251
                if broken_utf8_decoded and broken_utf8_score > 0:
                    try:
                        cp1251_decoded = data_bytes.decode('cp1251', errors='replace')
                        cp1251_cyrillic = sum(1 for char in cp1251_decoded if '\u0400' <= char <= '\u04FF')
                        if cp1251_cyrillic > 0:
                            logger.info(f"Fixed broken encoding: decoded as cp1251 with {cp1251_cyrillic} cyrillic characters (found {broken_utf8_score} broken utf-8 chars)")
                            return cp1251_decoded
                    except (UnicodeDecodeError, LookupError):
                        pass
                    
                    # Пробуем koi8-r для Linux
                    if sys.platform != 'win32':
                        try:
                            koi8_decoded = data_bytes.decode('koi8-r', errors='replace')
                            koi8_cyrillic = sum(1 for char in koi8_decoded if '\u0400' <= char <= '\u04FF')
                            if koi8_cyrillic > 0:
                                logger.info(f"Fixed broken encoding: decoded as koi8-r with {koi8_cyrillic} cyrillic characters")
                                return koi8_decoded
                        except (UnicodeDecodeError, LookupError):
                            pass
                
                # Если основная кодировка не подошла - пробуем fallback
                for encoding in fallback_encodings:
                    try:
                        decoded = data_bytes.decode(encoding, errors='replace')
                        # Подсчитываем количество кириллических символов
                        cyrillic_count = sum(1 for char in decoded if '\u0400' <= char <= '\u04FF')
                        
                        # Если есть кириллица, это хороший признак
                        if cyrillic_count > best_score:
                            best_decoded = decoded
                            best_score = cyrillic_count
                            best_encoding = encoding
                        elif best_decoded is None:
                            # Если кириллицы нет, но декодирование прошло - сохраняем как запасной вариант
                            best_decoded = decoded
                            best_encoding = encoding
                    except (UnicodeDecodeError, LookupError):
                        continue
                
                # Если нашли вариант с кириллицей - возвращаем его
                if best_decoded and best_score > 0:
                    logger.debug(f"Decoded with {best_score} cyrillic characters using {best_encoding}")
                    # Логируем результат декодирования на уровне DEBUG
                    logger.debug(f"Decoded text (first 200 chars): {best_decoded[:200]}")
                    return best_decoded
                
                return best_decoded if best_decoded else str(data_bytes)
            
            if result.returncode != 0:
                error_bytes = result.stderr if result.stderr else result.stdout
                
                # Логируем сырые байты для отладки (первые 200 байт)
                if error_bytes:
                    logger.debug(f"Raw error bytes (first 200): {error_bytes[:200]}")
                    # Для Linux используем улучшенную логику декодирования
                    if sys.platform != 'win32':
                        # Сначала пробуем декодировать как UTF-8, чтобы проверить на "битую" кодировку
                        try:
                            utf8_decoded = error_bytes.decode('utf-8', errors='replace')
                            # Проверяем на признаки "битой" кодировки (CP1251, прочитанная как UTF-8)
                            broken_chars = ['Р', 'С', 'Рµ', 'РЅ', 'Рѕ', 'Р°', 'РІ', 'Рё', 'Р»', 'Рј', 'РЅ', 'Рѕ', 'Рї', 'СЂ', 'СЃ', 'С‚', 'Сѓ', 'С„', 'С…', 'С†', 'С‡', 'С€', 'С‰', 'СЉ', 'С‹', 'СЊ', 'СЌ', 'СЋ', 'СЏ']
                            broken_count = sum(1 for char in utf8_decoded if char in broken_chars)
                            utf8_cyrillic = sum(1 for char in utf8_decoded if '\u0400' <= char <= '\u04FF')
                            
                            # Если есть "битые" символы и нет кириллицы - это CP1251, прочитанная как UTF-8
                            if broken_count > 0 and utf8_cyrillic == 0:
                                # Пробуем декодировать как CP1251
                                try:
                                    cp1251_text = error_bytes.decode('cp1251', errors='replace')
                                    cp1251_cyrillic = sum(1 for char in cp1251_text if '\u0400' <= char <= '\u04FF')
                                    if cp1251_cyrillic > 0:
                                        logger.info(f"Error fixed: decoded as cp1251 with {cp1251_cyrillic} cyrillic characters (found {broken_count} broken utf-8 chars)")
                                        error_text = cp1251_text
                                    else:
                                        # Пробуем koi8-r
                                        try:
                                            koi8_text = error_bytes.decode('koi8-r', errors='replace')
                                            koi8_cyrillic = sum(1 for char in koi8_text if '\u0400' <= char <= '\u04FF')
                                            if koi8_cyrillic > 0:
                                                logger.info(f"Error decoded as koi8-r with {koi8_cyrillic} cyrillic characters")
                                                error_text = koi8_text
                                            else:
                                                error_text = decode_text(error_bytes)
                                        except (UnicodeDecodeError, LookupError):
                                            error_text = decode_text(error_bytes)
                                except (UnicodeDecodeError, LookupError):
                                    error_text = decode_text(error_bytes)
                            else:
                                # Нет признаков "битой" кодировки, используем стандартное декодирование
                                error_text = decode_text(error_bytes)
                        except (UnicodeDecodeError, LookupError):
                            error_text = decode_text(error_bytes)
                    else:
                        error_text = decode_text(error_bytes)
                else:
                    error_text = "Unknown error (no error output)"
                
                # Проверяем и исправляем "битую" кодировку, если ошибка уже была неправильно декодирована
                error_text = fix_broken_encoding(error_text)
                
                logger.error(f"RAC command failed: {error_text}")
                return {'success': False, 'error': error_text}
            
            output_text = decode_text(result.stdout)
            return {'success': True, 'output': output_text}
            
        except subprocess.TimeoutExpired:
            logger.error("RAC command timeout")
            return {'success': False, 'error': 'Timeout exceeded'}
        except Exception as e:
            logger.error(f"RAC command exception: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    def remove_cluster(self, cluster_uuid):
        """Удаляет кластер
        
        Args:
            cluster_uuid: UUID кластера
        """
        args = ['cluster', 'remove', f'--cluster={cluster_uuid}']
        
        # Добавляем аутентификацию если есть
        if self.cluster_admin:
            args.insert(1, f'--cluster-user={self.cluster_admin}')
            if self.cluster_password:
                args.insert(2, f'--cluster-pwd={self.cluster_password}')
        
        return self._execute_command(args)
    
    def get_session_list(self, cluster_uuid, infobase_uuid=None, include_licenses=False):
        """Получает список сеансов"""
        args = ['session', 'list', f'--cluster={cluster_uuid}']
        if infobase_uuid:
            args.append(f'--infobase={infobase_uuid}')
        if include_licenses:
            args.append('--licenses')
        return self._execute_command(args)
    
    def get_session_info(self, cluster_uuid, session_uuid, include_licenses=False):
        """Получает информацию о сеансе"""
        args = [
            'session', 'info',
            f'--cluster={cluster_uuid}',
            f'--session={session_uuid}'
        ]
        if include_licenses:
            args.append('--licenses')
        return self._execute_command(args)
    
    def terminate_session(self, cluster_uuid, session_uuid, error_message=None):
        """Принудительно завершает сеанс"""
        args = [
            'session', 'terminate',
            f'--cluster={cluster_uuid}',
            f'--session={session_uuid}'
        ]
        if error_message:
            args.append(f'--error-message={error_message}')
        return self._execute_command(args)
    
    def interrupt_server_call(self, cluster_uuid, session_uuid, error_message=None):
        """Прерывает текущий серверный вызов"""
        args = [
            'session', 'interrupt-current-server-call',
            f'--cluster={cluster_uuid}',
            f'--session={session_uuid}'
        ]
        if error_message:
            args.append(f'--error-message={error_message}')
        return self._execute_command(args)
    
    def get_infobase_summary_list(self, cluster_uuid):
        """Получает список информационных баз"""
        args = [
            'infobase', 'summary', 'list',
            f'--cluster={cluster_uuid}'
        ]
        return self._execute_command(args)
    
    def get_process_list(self, cluster_uuid, server_uuid=None, include_licenses=False):
        """Получает список рабочих процессов"""
        args = ['process', 'list', f'--cluster={cluster_uuid}']
        if server_uuid:
            args.append(f'--server={server_uuid}')
        if include_licenses:
            args.append('--licenses')
        return self._execute_command(args)
    
    def get_process_info(self, cluster_uuid, process_uuid, include_licenses=False):
        """Получает информацию о рабочем процессе"""
        args = [
            'process', 'info',
            f'--cluster={cluster_uuid}',
            f'--process={process_uuid}'
        ]
        if include_licenses:
            args.append('--licenses')
        return self._execute_command(args)
    
    def turn_off_process(self, cluster_uuid, process_uuid):
        """Выключает рабочий процесс"""
        args = [
            'process', 'turn-off',
            f'--cluster={cluster_uuid}',
            f'--process={process_uuid}'
        ]
        return self._execute_command(args)
    
    def get_manager_list(self, cluster_uuid):
        """Получает список менеджеров кластера"""
        args = ['manager', 'list', f'--cluster={cluster_uuid}']
        return self._execute_command(args)
    
    def get_manager_info(self, cluster_uuid, manager_uuid):
        """Получает информацию о менеджере кластера"""
        args = [
            'manager', 'info',
            f'--cluster={cluster_uuid}',
            f'--manager={manager_uuid}'
        ]
        return self._execute_command(args)
    
    def get_server_list(self, cluster_uuid):
        """Получает список рабочих серверов"""
        args = [
            'server', 'list',
            f'--cluster={cluster_uuid}'
        ]
        return self._execute_command(args)
    
    # ============================================
    # Методы для работы с информационными базами
    # ============================================
    
    def get_infobase_info(self, cluster_uuid, infobase_uuid=None, infobase_name=None, infobase_user=None, infobase_pwd=None):
        """Получает информацию об информационной базе"""
        args = ['infobase', 'info', f'--cluster={cluster_uuid}']
        
        if infobase_uuid:
            args.append(f'--infobase={infobase_uuid}')
        elif infobase_name:
            args.append(f'--name={infobase_name}')
        
        if infobase_user:
            args.append(f'--infobase-user={infobase_user}')
        # Пароль может быть пустой строкой (если в базе нет пароля для администраторской УЗ)
        # Передаем параметр только если он явно указан (не None)
        if infobase_pwd is not None:
            args.append(f'--infobase-pwd={infobase_pwd}')
        
        return self._execute_command(args)
    
    def create_infobase(self, cluster_uuid, name, dbms, db_server, db_name, locale, **kwargs):
        """Создаёт новую информационную базу"""
        args = [
            'infobase', 'create',
            f'--cluster={cluster_uuid}',
            f'--name={name}',
            f'--dbms={dbms}',
            f'--db-server={db_server}',
            f'--db-name={db_name}',
            f'--locale={locale}'
        ]
        
        # Маппинг параметров
        param_mapping = {
            'create_database': '--create-database',
            'db_user': '--db-user',
            'db_pwd': '--db-pwd',
            'descr': '--descr',
            'date_offset': '--date-offset',
            'security_level': '--security-level',
            'scheduled_jobs_deny': '--scheduled-jobs-deny',
            'license_distribution': '--license-distribution',
        }
        
        for key, value in kwargs.items():
            if key in param_mapping and value is not None:
                param_name = param_mapping[key]
                
                # Специальная обработка для --create-database (это флаг без значения)
                if key == 'create_database':
                    if value is True:
                        args.append(param_name)  # Добавляем только флаг без значения
                elif isinstance(value, bool):
                    value = 'on' if value else 'off'
                    args.append(f'{param_name}={value}')
                else:
                    args.append(f'{param_name}={value}')
        
        return self._execute_command(args)
    
    def update_infobase(self, cluster_uuid, infobase_uuid=None, infobase_name=None, **kwargs):
        """Обновляет информацию об информационной базе"""
        args = ['infobase', 'update', f'--cluster={cluster_uuid}']
        
        if infobase_uuid:
            args.append(f'--infobase={infobase_uuid}')
        elif infobase_name:
            args.append(f'--name={infobase_name}')
        
        # Учетные данные администратора ИБ должны идти сразу после --cluster и --infobase/--name
        # (как в get_infobase_info)
        infobase_user = kwargs.pop('infobase_user', None)
        infobase_pwd = kwargs.pop('infobase_pwd', None)
        
        if infobase_user:
            # subprocess.run с списком аргументов не требует кавычек
            args.append(f'--infobase-user={infobase_user}')
        # Пароль может быть пустой строкой (если в базе нет пароля для администраторской УЗ)
        # Передаем параметр только если он явно указан (не None)
        if infobase_pwd is not None:
            # subprocess.run с списком аргументов не требует кавычек
            args.append(f'--infobase-pwd={infobase_pwd}')
        
        # Маппинг параметров
        param_mapping = {
            'name': '--name',
            'dbms': '--dbms',
            'db_server': '--db-server',
            'db_name': '--db-name',
            'db_user': '--db-user',
            'db_pwd': '--db-pwd',
            'descr': '--descr',
            'denied_from': '--denied-from',
            'denied_message': '--denied-message',
            'denied_parameter': '--denied-parameter',
            'denied_to': '--denied-to',
            'permission_code': '--permission-code',
            'sessions_deny': '--sessions-deny',
            'scheduled_jobs_deny': '--scheduled-jobs-deny',
            'license_distribution': '--license-distribution',
            'external_session_manager_connection_string': '--external-session-manager-connection-string',
            'external_session_manager_required': '--external-session-manager-required',
            'reserve_working_processes': '--reserve-working-processes',
            'security_profile_name': '--security-profile-name',
            'safe_mode_security_profile_name': '--safe-mode-security-profile-name',
            'disable_local_speech_to_text': '--disable-local-speech-to-text',
            'configuration_unload_delay_by_working_process_without_active_users': '--configuration-unload-delay-by-working-process-without-active-users',
            'minimum_scheduled_jobs_start_period_without_active_users': '--minimum-scheduled-jobs-start-period-without-active-users',
            'maximum_scheduled_jobs_start_shift_without_active_users': '--maximum-scheduled-jobs-start-shift-without-active-users',
        }
        
        for key, value in kwargs.items():
            if key in param_mapping:
                if value is None:
                    continue
                
                # Для полей, которые могут быть очищены (пустая строка = очистка)
                # Это текстовые поля, которые можно очистить передав пустую строку
                clearable_fields = ['permission_code', 'denied_message', 'denied_parameter', 'descr']
                if key in clearable_fields:
                    value_str = str(value).strip() if value else ''
                    param_name = param_mapping[key]
                    # Если значение пустое, передаем пустую строку в кавычках для очистки
                    # subprocess.run с списком аргументов: кавычки становятся частью значения
                    # Но RAC ожидает пустую строку, поэтому передаем --param="" 
                    # (кавычки будут частью значения, но RAC их обработает)
                    if not value_str:
                        args.append(f'{param_name}=""')
                        logger.info(f"RAC clearable param: {key} = '' (clearing value)")
                        continue
                    # Если значение не пустое, передаем как обычно (без кавычек, subprocess обработает)
                    args.append(f'{param_name}={value_str}')
                    continue
                
                # Для полей даты/времени обрабатываем отдельно
                # Пустые значения нужно передавать для очистки даты на сервере
                if key in ['denied_from', 'denied_to']:
                    # Проверяем, что значение передано (может быть пустой строкой для очистки)
                    if value is None:
                        continue  # None означает, что параметр не передан
                    
                    value_str = str(value).strip()
                    original_value = value_str
                    
                    # Если значение пустое, передаем пустую строку для очистки
                    if not value_str:
                        param_name = param_mapping[key]
                        args.append(f'{param_name}=')
                        logger.info(f"RAC date param: {key} = '' (clearing date)")
                        continue
                    
                    # Убеждаемся, что формат правильный: YYYY-MM-DDTHH:mm:ss (точно 19 символов)
                    # Проверяем и нормализуем формат даты
                    import re
                    # Проверяем, что значение содержит 'T' (признак datetime формата)
                    if 'T' in value_str:
                        # Проверяем формат через регулярное выражение
                        # Паттерн: YYYY-MM-DDTHH:mm или YYYY-MM-DDTHH:mm:ss
                        match = re.match(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?$', value_str)
                        if match:
                            # Если есть секунды (match.group(2)), используем как есть
                            if match.group(2):
                                value_str = match.group(0)  # Полное совпадение с секундами
                            else:
                                # Если секунд нет, добавляем :00
                                value_str = match.group(1) + ':00'
                        else:
                            # Если формат не соответствует паттерну, пытаемся исправить
                            # Простая проверка длины и добавление секунд, если нужно
                            if len(value_str) == 16 and value_str.count(':') == 1:
                                value_str = value_str + ':00'
                    
                    # Финальная проверка: формат должен быть YYYY-MM-DDTHH:mm:ss (19 символов)
                    if not re.match(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$', value_str):
                        logger.warning(f"Invalid date format for {key}: '{original_value}' -> '{value_str}', skipping")
                        continue
                    
                    # Логируем для отладки (временно)
                    logger.info(f"RAC date param: {key} = '{original_value}' -> '{value_str}'")
                    
                    param_name = param_mapping[key]
                    # ВАЖНО: subprocess.run получает список аргументов, кавычки не нужны для shell
                    # Но 1C RAC ожидает значения в кавычках в командной строке
                    # Когда subprocess передает аргументы, кавычки становятся частью значения
                    # Поэтому передаем БЕЗ кавычек - subprocess сам правильно обработает
                    args.append(f'{param_name}={value_str}')
                    continue
                    
                param_name = param_mapping[key]
                if isinstance(value, bool):
                    if 'deny' in key or 'required' in key:
                        value = 'yes' if value else 'no'
                    else:
                        value = 'on' if value else 'off'
                
                # Для паролей и пользователей также добавляем кавычки для безопасности
                if key in ['db_user', 'db_pwd']:
                    args.append(f'{param_name}="{value}"')
                else:
                    args.append(f'{param_name}={value}')
        
        return self._execute_command(args)
    
    def drop_infobase(self, cluster_uuid, infobase_uuid=None, infobase_name=None, 
                      infobase_user=None, infobase_pwd=None, drop_database=False, clear_database=False):
        """Удаляет информационную базу"""
        args = ['infobase', 'drop', f'--cluster={cluster_uuid}']
        
        if infobase_uuid:
            args.append(f'--infobase={infobase_uuid}')
        elif infobase_name:
            args.append(f'--name={infobase_name}')
        
        if infobase_user:
            args.append(f'--infobase-user={infobase_user}')
        if infobase_pwd:
            args.append(f'--infobase-pwd={infobase_pwd}')
        if drop_database:
            args.append('--drop-database')
        if clear_database:
            args.append('--clear-database')
        
        return self._execute_command(args)
    
    # ============================================
    # Методы для работы с рабочими серверами
    # ============================================
    
    def get_server_info(self, cluster_uuid, server_uuid):
        """Получает информацию о рабочем сервере"""
        args = [
            'server', 'info',
            f'--cluster={cluster_uuid}',
            f'--server={server_uuid}'
        ]
        return self._execute_command(args)
    
    def insert_server(self, cluster_uuid, agent_host, agent_port, port_range, **kwargs):
        """Регистрирует новый рабочий сервер"""
        args = [
            'server', 'insert',
            f'--cluster={cluster_uuid}',
            f'--agent-host={agent_host}',
            f'--agent-port={agent_port}',
            f'--port-range={port_range}'
        ]
        
        # Маппинг параметров
        param_mapping = {
            'name': '--name',
            'using': '--using',
            'infobases_limit': '--infobases-limit',
            'memory_limit': '--memory-limit',
            'connections_limit': '--connections-limit',
            'cluster_port': '--cluster-port',
            'dedicate_managers': '--dedicate-managers',
            'safe_working_processes_memory_limit': '--safe-working-processes-memory-limit',
            'safe_call_memory_limit': '--safe-call-memory-limit',
            'critical_total_memory': '--critical-total-memory',
            'temporary_allowed_total_memory': '--temporary-allowed-total-memory',
            'temporary_allowed_total_memory_time_limit': '--temporary-allowed-total-memory-time-limit',
            'service_principal_name': '--service-principal-name',
            'restart_schedule': '--restart-schedule',
            'add_prohibiting_assignment_rule': '--add-prohibiting-assignment-rule',
        }
        
        for key, value in kwargs.items():
            if key in param_mapping and value is not None:
                param_name = param_mapping[key]
                if isinstance(value, bool):
                    value = 'yes' if value else 'no'
                args.append(f'{param_name}={value}')
        
        return self._execute_command(args)
    
    def update_server(self, cluster_uuid, server_uuid, **kwargs):
        """Обновляет параметры рабочего сервера"""
        args = [
            'server', 'update',
            f'--cluster={cluster_uuid}',
            f'--server={server_uuid}'
        ]
        
        # Маппинг параметров (аналогично insert_server)
        param_mapping = {
            'port_range': '--port-range',
            'using': '--using',
            'infobases_limit': '--infobases-limit',
            'memory_limit': '--memory-limit',
            'connections_limit': '--connections-limit',
            'dedicate_managers': '--dedicate-managers',
            'safe_working_processes_memory_limit': '--safe-working-processes-memory-limit',
            'safe_call_memory_limit': '--safe-call-memory-limit',
            'critical_total_memory': '--critical-total-memory',
            'temporary_allowed_total_memory': '--temporary-allowed-total-memory',
            'temporary_allowed_total_memory_time_limit': '--temporary-allowed-total-memory-time-limit',
            'service_principal_name': '--service-principal-name',
            'restart_schedule': '--restart-schedule',
        }
        
        for key, value in kwargs.items():
            if key in param_mapping and value is not None:
                param_name = param_mapping[key]
                if isinstance(value, bool):
                    value = 'yes' if value else 'no'
                args.append(f'{param_name}={value}')
        
        return self._execute_command(args)
    
    def remove_server(self, cluster_uuid, server_uuid):
        """Удаляет рабочий сервер"""
        args = [
            'server', 'remove',
            f'--cluster={cluster_uuid}',
            f'--server={server_uuid}'
        ]
        return self._execute_command(args)
    
    # ============================================
    # Методы для работы с требованиями назначения функциональности (ТНФ)
    # ============================================
    
    def get_rule_list(self, cluster_uuid, server_uuid):
        """Получает список требований назначения функциональности для сервера"""
        args = [
            'rule', 'list',
            f'--cluster={cluster_uuid}',
            f'--server={server_uuid}'
        ]
        return self._execute_command(args)
    
    def get_rule_info(self, cluster_uuid, server_uuid, rule_uuid):
        """Получает информацию о требовании назначения"""
        args = [
            'rule', 'info',
            f'--cluster={cluster_uuid}',
            f'--server={server_uuid}',
            f'--rule={rule_uuid}'
        ]
        return self._execute_command(args)
    
    def insert_rule(self, cluster_uuid, server_uuid, position, **kwargs):
        """Вставляет новое требование назначения в список"""
        args = [
            'rule', 'insert',
            f'--cluster={cluster_uuid}',
            f'--server={server_uuid}',
            f'--position={position}'
        ]
        
        # Маппинг параметров
        param_mapping = {
            'object_type': '--object-type',
            'infobase_name': '--infobase-name',
            'rule_type': '--rule-type',  # auto|always|never
            'application_ext': '--application-ext',
            'priority': '--priority',
        }
        
        for key, value in kwargs.items():
            if key in param_mapping and value is not None:
                param_name = param_mapping[key]
                args.append(f'{param_name}={value}')
        
        return self._execute_command(args)
    
    def update_rule(self, cluster_uuid, server_uuid, rule_uuid, position, **kwargs):
        """Обновляет параметры существующего требования назначения"""
        args = [
            'rule', 'update',
            f'--cluster={cluster_uuid}',
            f'--server={server_uuid}',
            f'--rule={rule_uuid}',
            f'--position={position}'
        ]
        
        # Маппинг параметров
        param_mapping = {
            'object_type': '--object-type',
            'infobase_name': '--infobase-name',
            'rule_type': '--rule-type',  # auto|always|never
            'application_ext': '--application-ext',
            'priority': '--priority',
        }
        
        for key, value in kwargs.items():
            if key in param_mapping and value is not None:
                param_name = param_mapping[key]
                args.append(f'{param_name}={value}')
        
        return self._execute_command(args)
    
    def remove_rule(self, cluster_uuid, server_uuid, rule_uuid):
        """Удаляет требование назначения"""
        args = [
            'rule', 'remove',
            f'--cluster={cluster_uuid}',
            f'--server={server_uuid}',
            f'--rule={rule_uuid}'
        ]
        return self._execute_command(args)
    
    # ============================================
    # Агенты кластера
    # ============================================
    
    def agent_admin_list(self):
        """Получает список администраторов агента кластера"""
        args = ['agent', 'admin', 'list']
        return self._execute_command(args)
    
    def agent_admin_register(self, name, pwd=None, descr=None):
        """Добавляет нового администратора агента кластера"""
        args = ['agent', 'admin', 'register', f'--name={name}', '--auth=pwd']
        if pwd:
            args.append(f'--pwd={pwd}')
        if descr:
            args.append(f'--descr={descr}')
        return self._execute_command(args)
    
    def agent_admin_remove(self, name):
        """Удаляет администратора агента кластера"""
        args = ['agent', 'admin', 'remove', f'--name={name}']
        return self._execute_command(args)
    
    # ============================================
    # Администраторы кластера
    # ============================================
    
    def cluster_admin_list(self, cluster_uuid):
        """Получает список администраторов кластера"""
        args = ['cluster', 'admin', 'list', f'--cluster={cluster_uuid}']
        return self._execute_command(args)
    
    def cluster_admin_register(self, cluster_uuid, name, pwd=None, descr=None):
        """Добавляет нового администратора кластера"""
        args = ['cluster', 'admin', 'register', f'--cluster={cluster_uuid}', f'--name={name}', '--auth=pwd']
        if pwd:
            args.append(f'--pwd={pwd}')
        if descr:
            args.append(f'--descr={descr}')
        return self._execute_command(args)
    
    def cluster_admin_remove(self, cluster_uuid, name):
        """Удаляет администратора кластера"""
        args = ['cluster', 'admin', 'remove', f'--cluster={cluster_uuid}', f'--name={name}']
        return self._execute_command(args)
    
    def apply_rules(self, cluster_uuid, server_uuid=None, full=True):
        """Применяет требования назначения
        
        Args:
            cluster_uuid: UUID кластера (обязательный)
            server_uuid: UUID сервера (не используется, оставлен для совместимости)
            full: True для полного применения, False для частичного
        """
        args = [
            'rule', 'apply',
            f'--cluster={cluster_uuid}'
        ]
        if full:
            args.append('--full')
        else:
            args.append('--partial')
        return self._execute_command(args)