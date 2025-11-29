import subprocess
import json
import os
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

class RACClient:
    def __init__(self, server_connection):
        self.server_connection = server_connection
        self.rac_path = settings.RAC_PATH
        
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
            result = subprocess.run(
                cmd_args,
                capture_output=True,
                text=True,
                timeout=30  # 30 секунд таймаут
            )
            
            if result.returncode != 0:
                logger.error(f"RAC command failed: {result.stderr}")
                return {'success': False, 'error': result.stderr}
                
            return {'success': True, 'output': result.stdout}
            
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