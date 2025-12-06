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