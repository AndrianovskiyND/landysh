import subprocess
import json
import os
import sys
from django.conf import settings
from core.models import SystemSettings
import logging

logger = logging.getLogger(__name__)

class RACClient:
    def __init__(self, server_connection):
        self.server_connection = server_connection
        # Получаем путь к RAC из системных настроек
        self.rac_path = SystemSettings.get_setting('rac_path', settings.RAC_PATH)
        
    def _mask_sensitive_data(self, command):
        """Маскирует чувствительные данные в команде для логирования"""
        masked = command
        if self.server_connection.cluster_admin:
            masked = masked.replace(self.server_connection.cluster_admin, '***')
        if self.server_connection.cluster_password:
            masked = masked.replace(str(self.server_connection.cluster_password), '***')
        return masked
        
    def _execute_command(self, args):
        """Выполняет команду rac и возвращает результат"""
        connection_str = self.server_connection.get_connection_string()
        
        # Формируем базовые аргументы
        cmd_args = [self.rac_path] + args + [connection_str]
        
        # Добавляем аутентификацию если есть
        if self.server_connection.cluster_admin:
            cmd_args.insert(1, f'--cluster-user={self.server_connection.cluster_admin}')
            if self.server_connection.cluster_password:
                cmd_args.insert(2, f'--cluster-pwd={self.server_connection.cluster_password}')
        
        # Логируем маскированную команду
        masked_cmd = self._mask_sensitive_data(' '.join(cmd_args))
        logger.info(f"Executing RAC command: {masked_cmd}")
        
        try:
            # Определяем кодировку в зависимости от ОС
            # В Windows консоль обычно использует cp866 (DOS кодировка), RAC может использовать cp1251
            # Пробуем сначала cp866, так как это стандартная кодировка консоли Windows
            if sys.platform == 'win32':
                # Пробуем разные кодировки для Windows
                encodings_to_try = ['cp866', 'cp1251', 'utf-8']
            else:
                encodings_to_try = ['utf-8']
            
            # Запускаем команду без text=True, чтобы получить байты
            result = subprocess.run(
                cmd_args,
                capture_output=True,
                timeout=30  # 30 секунд таймаут
            )
            
            def decode_text(data_bytes):
                """Пробует декодировать текст с разными кодировками"""
                if not data_bytes:
                    return ''
                if isinstance(data_bytes, str):
                    return data_bytes
                
                # Определяем список кодировок в зависимости от ОС
                if sys.platform == 'win32':
                    # Windows: cp866 (DOS), cp1251 (Windows), utf-8, latin1
                    all_encodings = ['cp866', 'cp1251', 'utf-8', 'latin1']
                else:
                    # Linux (РЕД ОС, CentOS и т.д.): пробуем cp1251 в первую очередь, так как RAC часто использует cp1251
                    # Затем utf-8, koi8-r, cp866, latin1
                    all_encodings = ['cp1251', 'utf-8', 'koi8-r', 'cp866', 'latin1']
                
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
                
                # Пробуем каждую кодировку
                for encoding in all_encodings:
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
                    return best_decoded
                
                # Возвращаем лучший вариант или строковое представление
                return best_decoded if best_decoded else str(data_bytes)
            
            if result.returncode != 0:
                # Декодируем ошибку с правильной кодировкой
                # Сначала пробуем stderr, если пусто - пробуем stdout
                error_bytes = result.stderr if result.stderr else result.stdout
                error_text = decode_text(error_bytes)
                # Логируем с правильной кодировкой
                logger.error(f"RAC command failed: {error_text}")
                return {'success': False, 'error': error_text}
            
            # Декодируем вывод с правильной кодировкой
            output_text = decode_text(result.stdout)
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
        }
        
        for key, value in kwargs.items():
            if key in param_mapping and value is not None:
                param_name = param_mapping[key]
                # Для булевых значений используем yes/no
                if isinstance(value, bool):
                    value = 'yes' if value else 'no'
                args.append(f'{param_name}={value}')
        
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
        if self.server_connection.cluster_admin:
            cmd_args.append(f'--cluster-user={self.server_connection.cluster_admin}')
            if self.server_connection.cluster_password:
                cmd_args.append(f'--cluster-pwd={self.server_connection.cluster_password}')
        
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
            
            result = subprocess.run(
                cmd_args,
                capture_output=True,
                timeout=30
            )
            
            def decode_text(data_bytes):
                """Пробует декодировать текст с разными кодировками"""
                if not data_bytes:
                    return ''
                if isinstance(data_bytes, str):
                    return data_bytes
                
                # Определяем список кодировок в зависимости от ОС
                if sys.platform == 'win32':
                    # Windows: cp866 (DOS), cp1251 (Windows), utf-8, latin1
                    all_encodings = ['cp866', 'cp1251', 'utf-8', 'latin1']
                else:
                    # Linux (РЕД ОС, CentOS и т.д.): пробуем cp1251 в первую очередь, так как RAC часто использует cp1251
                    # Затем utf-8, koi8-r, cp866, latin1
                    all_encodings = ['cp1251', 'utf-8', 'koi8-r', 'cp866', 'latin1']
                
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
                
                # Пробуем каждую кодировку
                for encoding in all_encodings:
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
                    return best_decoded
                
                return best_decoded if best_decoded else str(data_bytes)
            
            if result.returncode != 0:
                error_bytes = result.stderr if result.stderr else result.stdout
                error_text = decode_text(error_bytes)
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
        if self.server_connection.cluster_admin:
            args.insert(1, f'--cluster-user={self.server_connection.cluster_admin}')
            if self.server_connection.cluster_password:
                args.insert(2, f'--cluster-pwd={self.server_connection.cluster_password}')
        
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
    
    def get_infobase_info(self, cluster_uuid, infobase_uuid=None, infobase_name=None):
        """Получает информацию об информационной базе"""
        args = ['infobase', 'info', f'--cluster={cluster_uuid}']
        
        if infobase_uuid:
            args.append(f'--infobase={infobase_uuid}')
        elif infobase_name:
            args.append(f'--name={infobase_name}')
        
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
        
        # Маппинг параметров
        param_mapping = {
            'infobase_user': '--infobase-user',
            'infobase_pwd': '--infobase-pwd',
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
            if key in param_mapping and value is not None:
                param_name = param_mapping[key]
                if isinstance(value, bool):
                    if 'deny' in key or 'required' in key:
                        value = 'yes' if value else 'no'
                    else:
                        value = 'on' if value else 'off'
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