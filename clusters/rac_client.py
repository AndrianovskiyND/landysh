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
                
                # Все возможные кодировки для Windows
                all_encodings = ['cp866', 'cp1251', 'utf-8', 'latin1']
                best_decoded = None
                best_score = 0
                
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
                        elif best_decoded is None:
                            # Если кириллицы нет, но декодирование прошло - сохраняем как запасной вариант
                            best_decoded = decoded
                    except (UnicodeDecodeError, LookupError):
                        continue
                
                # Если нашли вариант с кириллицей - возвращаем его
                if best_decoded and best_score > 0:
                    logger.debug(f"Decoded with {best_score} cyrillic characters")
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
                
                all_encodings = ['cp866', 'cp1251', 'utf-8', 'latin1']
                best_decoded = None
                best_score = 0
                
                for encoding in all_encodings:
                    try:
                        decoded = data_bytes.decode(encoding, errors='replace')
                        cyrillic_count = sum(1 for char in decoded if '\u0400' <= char <= '\u04FF')
                        
                        if cyrillic_count > best_score:
                            best_decoded = decoded
                            best_score = cyrillic_count
                        elif best_decoded is None:
                            best_decoded = decoded
                    except (UnicodeDecodeError, LookupError):
                        continue
                
                if best_decoded and best_score > 0:
                    logger.debug(f"Decoded with {best_score} cyrillic characters")
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
    
    def get_session_list(self, cluster_uuid=None, infobase_uuid=None):
        """Получает список сеансов"""
        args = ['session', 'list']
        if cluster_uuid:
            args.insert(1, f'--cluster={cluster_uuid}')
        if infobase_uuid:
            args.insert(2, f'--infobase={infobase_uuid}')
        return self._execute_command(args)
    
    def terminate_session(self, session_uuid, cluster_uuid):
        """Завершает сеанс"""
        args = [
            'session', 'terminate',
            f'--session={session_uuid}',
            f'--cluster={cluster_uuid}'
        ]
        return self._execute_command(args)
    
    def get_infobase_summary_list(self, cluster_uuid):
        """Получает список информационных баз"""
        args = [
            'infobase', 'summary', 'list',
            f'--cluster={cluster_uuid}'
        ]
        return self._execute_command(args)
    
    def get_server_list(self, cluster_uuid):
        """Получает список рабочих серверов"""
        args = [
            'server', 'list',
            f'--cluster={cluster_uuid}'
        ]
        return self._execute_command(args)