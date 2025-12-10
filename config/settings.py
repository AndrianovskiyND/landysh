import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-default-key')
DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'core',
    'users',
    'clusters',
    'frontend',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.ForcePasswordChangeMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'core.context_processors.global_settings',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ============================================================================
# НАСТРОЙКИ БАЗЫ ДАННЫХ
# ============================================================================
# 
# Для переключения на PostgreSQL:
# 1. Установите psycopg2: pip install psycopg2-binary
# 2. Раскомментируйте конфигурацию PostgreSQL ниже
# 3. Закомментируйте или удалите конфигурацию SQLite
# 4. Создайте базу данных и схему в PostgreSQL (выполните от имени суперпользователя postgres):
#    
#    -- Создание базы данных
#    CREATE DATABASE your_database_name;
#    
#    -- Создание пользователя
#    CREATE USER your_username WITH PASSWORD 'your_password';
#    
#    -- Выдача прав на базу данных
#    GRANT ALL PRIVILEGES ON DATABASE your_database_name TO your_username;
#    
#    -- Подключение к базе данных для создания схемы
#    \c your_database_name
#    
#    -- Создание схемы (рекомендуется использовать имя проекта, например: landysh)
#    CREATE SCHEMA landysh;
#    
#    -- Выдача прав на схему
#    GRANT ALL PRIVILEGES ON SCHEMA landysh TO your_username;
#    
#    -- Выдача прав на все таблицы в схеме (включая будущие)
#    ALTER DEFAULT PRIVILEGES IN SCHEMA landysh GRANT ALL ON TABLES TO your_username;
#    ALTER DEFAULT PRIVILEGES IN SCHEMA landysh GRANT ALL ON SEQUENCES TO your_username;
#    
#    -- Установка схемы по умолчанию для пользователя (опционально)
#    ALTER USER your_username SET search_path = landysh, public;
# 
# 5. Установите переменные окружения (или укажите значения напрямую в конфигурации):
#    DB_NAME=your_database_name
#    DB_USER=your_username
#    DB_PASSWORD=your_password
#    DB_HOST=localhost
#    DB_PORT=5432
#    DB_SCHEMA=landysh  # Имя схемы (по умолчанию: landysh)
# 
# 6. Выполните миграции: python manage.py migrate
#
# ПРИМЕЧАНИЕ: Проект использует отдельную схему вместо public для безопасности
# и изоляции данных. Имя схемы можно изменить через переменную окружения DB_SCHEMA.
#
# ============================================================================

# SQLite (по умолчанию - для разработки)
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# PostgreSQL (для продакшена - раскомментируйте и настройте)
# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.postgresql',
#         'NAME': os.getenv('DB_NAME', 'your_database_name'),
#         'USER': os.getenv('DB_USER', 'your_username'),
#         'PASSWORD': os.getenv('DB_PASSWORD', 'your_password'),
#         'HOST': os.getenv('DB_HOST', 'localhost'),
#         'PORT': os.getenv('DB_PORT', '5432'),
#         'OPTIONS': {
#             'connect_timeout': 10,
#             # Указываем схему для использования (вместо public)
#             'options': f"-c search_path={os.getenv('DB_SCHEMA', 'landysh')}",
#         },
#     }
# }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = 'Europe/Moscow'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'frontend' / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/accounts/login/'

# Настройки проекта
RAC_PATH = os.getenv('RAC_PATH', '/opt/1cv8/x86_64/8.3.27.1860/rac')
DEFAULT_ADMIN_USERNAME = os.getenv('DEFAULT_ADMIN_USERNAME', 'Администратор')
DEFAULT_ADMIN_PASSWORD = os.getenv('DEFAULT_ADMIN_PASSWORD', '123')

# ============================================================================
# НАСТРОЙКИ ЛОГИРОВАНИЯ
# ============================================================================
# 
# ВАЖНО: После изменения настроек логирования необходимо перезапустить
# Django сервер, чтобы изменения вступили в силу!
#
# Уровни логирования (от меньшего к большему):
# - DEBUG: максимальная детализация, все сообщения (включая результаты RAC команд)
# - INFO: информационные сообщения (обычная работа приложения)
# - WARNING: предупреждения (потенциальные проблемы)
# - ERROR: только ошибки
# - CRITICAL: критические ошибки
#
# Рекомендации:
# - Для разработки: DEBUG или INFO
# - Для продакшена: INFO или WARNING
#
# ============================================================================

# Включить/выключить логирование (True/False)
# Можно задать через переменную окружения: LOG_ENABLED=true или LOG_ENABLED=false
LOG_ENABLED = os.getenv('LOG_ENABLED', 'true').lower() in ('true', '1', 'yes', 'on')

# Куда выводить логи:
# - 'console' - только в консоль (файл НЕ создается и НЕ используется)
# - 'file' - только в файл (консоль НЕ используется)
# - 'both' - и в консоль, и в файл
# Можно задать через переменную окружения: LOG_OUTPUT=console|file|both
# 
# ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ:
# LOG_OUTPUT = 'console'  # Только консоль
# LOG_OUTPUT = 'file'     # Только файл (logs/django.log)
# LOG_OUTPUT = 'both'     # И консоль, и файл
LOG_OUTPUT = os.getenv('LOG_OUTPUT', 'console').lower()

# Валидация LOG_OUTPUT
if LOG_OUTPUT not in ('console', 'file', 'both'):
    LOG_OUTPUT = 'console'  # По умолчанию консоль, если указано неверное значение

# Уровень логирования (DEBUG, INFO, WARNING, ERROR, CRITICAL)
# Можно задать через переменную окружения: LOG_LEVEL=DEBUG|INFO|WARNING|ERROR|CRITICAL
LOG_LEVEL = os.getenv('LOG_LEVEL', 'ERROR')

# Путь к директории для логов (будет создана автоматически только если нужно логировать в файл)
LOGS_DIR = BASE_DIR / 'logs'

# Имя файла лога
LOG_FILE = LOGS_DIR / 'django.log'

# Максимальный размер одного файла лога (в байтах)
# 10 MB = 10 * 1024 * 1024
LOG_MAX_BYTES = 10 * 1024 * 1024

# Количество резервных копий логов (старые файлы будут автоматически удаляться)
LOG_BACKUP_COUNT = 5

# Конфигурация логирования Django
# ЕДИНЫЙ МЕХАНИЗМ ЛОГИРОВАНИЯ:
# - Все логгеры используют общие handlers (console и/или file в зависимости от LOG_OUTPUT)
# - Уровень логирования задается одной переменной LOG_LEVEL
# - Родительские логгеры (clusters, users, core) с propagate=True передают логи в root logger
# - Root logger обрабатывает все логи через выбранные handler'ы
#
# Если LOG_ENABLED=False, логирование полностью отключено (используется NullHandler)

# Определяем, какие handlers использовать
if not LOG_ENABLED:
    # Логирование выключено - используем NullHandler (ничего не логируется)
    handlers_list = []
    handlers_dict = {
        'null': {
            'class': 'logging.NullHandler',
        },
    }
elif LOG_OUTPUT == 'console':
    # Только консоль
    handlers_list = ['console']
    handlers_dict = {
        'console': {
            'level': LOG_LEVEL,
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    }
elif LOG_OUTPUT == 'file':
    # Только файл - создаем директорию только если нужно логировать в файл
    LOGS_DIR.mkdir(exist_ok=True)
    handlers_list = ['file']
    handlers_dict = {
        'file': {
            'level': LOG_LEVEL,
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOG_FILE,
            'maxBytes': LOG_MAX_BYTES,
            'backupCount': LOG_BACKUP_COUNT,
            'formatter': 'verbose',
        },
    }
else:
    # Оба (both) - по умолчанию - создаем директорию только если нужно логировать в файл
    LOGS_DIR.mkdir(exist_ok=True)
    handlers_list = ['console', 'file']
    handlers_dict = {
        'file': {
            'level': LOG_LEVEL,
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOG_FILE,
            'maxBytes': LOG_MAX_BYTES,
            'backupCount': LOG_BACKUP_COUNT,
            'formatter': 'verbose',
        },
        'console': {
            'level': LOG_LEVEL,
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    }

LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,  # Отключаем существующие логгеры, чтобы они использовали нашу конфигурацию
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': handlers_dict,
    'root': {
        'handlers': handlers_list if handlers_list else ['null'],
        'level': LOG_LEVEL,
    },
    'loggers': {
        # Django framework loggers
        'django': {
            'handlers': handlers_list if handlers_list else ['null'],
            'level': LOG_LEVEL,
            'propagate': False,
        },
        'django.server': {
            'handlers': handlers_list if handlers_list else ['null'],
            'level': LOG_LEVEL,
            'propagate': False,
        },
        'django.request': {
            'handlers': handlers_list if handlers_list else ['null'],
            'level': LOG_LEVEL,
            'propagate': False,
        },
        # Дополнительные Django логгеры (используем короткие имена, как они отображаются в логах)
        'django.utils.autoreload': {
            'handlers': handlers_list if handlers_list else ['null'],
            'level': LOG_LEVEL,
            'propagate': False,
        },
        'autoreload': {  # Короткое имя для autoreload
            'handlers': handlers_list if handlers_list else ['null'],
            'level': LOG_LEVEL,
            'propagate': False,
        },
        'django.core.servers.basehttp': {
            'handlers': handlers_list if handlers_list else ['null'],
            'level': LOG_LEVEL,
            'propagate': False,
        },
        'basehttp': {  # Короткое имя для basehttp (используется в runserver)
            'handlers': handlers_list if handlers_list else ['null'],
            'level': LOG_LEVEL,
            'propagate': False,
        },
        # Явно отключаем все возможные логгеры, которые могут создавать файлы
        'py.warnings': {
            'handlers': handlers_list if handlers_list else ['null'],
            'level': LOG_LEVEL,
            'propagate': False,
        },
        # Application loggers - родительские логгеры
        # Все дочерние логгеры (clusters.rac_client, clusters.views, users.views и т.д.)
        # автоматически наследуют настройки через root logger благодаря propagate=True
        # ВАЖНО: propagate=True означает, что логи передаются в root logger, поэтому НЕ нужно
        # указывать handlers здесь, иначе будет двойное логирование!
        'clusters': {
            'level': LOG_LEVEL,
            'propagate': True,  # Логи передаются в root logger, который использует выбранные handler'ы
        },
        'users': {
            'level': LOG_LEVEL,
            'propagate': True,  # Логи передаются в root logger, который использует выбранные handler'ы
        },
        'core': {
            'level': LOG_LEVEL,
            'propagate': True,  # Логи передаются в root logger, который использует выбранные handler'ы
        },
    },
}