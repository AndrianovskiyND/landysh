# Структура проекта Ландыш

## Описание организации файлов

### Backend (Django приложения)

#### `core/` - Основные функции системы
- **models.py** - Модели: Profile, SystemSettings
- **views.py** - Системные настройки, принудительная смена пароля
- **forms.py** - Формы аутентификации и смены пароля
- **middleware.py** - Middleware для принудительной смены пароля
- **context_processors.py** - Глобальные переменные для шаблонов
- **admin.py** - Админ-панель Django
- **urls.py** - URL маршруты для системных настроек
- **management/commands/** - Django команды (create_admin)

#### `users/` - Управление пользователями
- **models.py** - Модели: UserGroup
- **views.py** - CRUD пользователей, управление группами, ролями
- **urls.py** - API endpoints для пользователей и групп
- **forms.py** - Формы для работы с пользователями
- **admin.py** - Админ-панель для пользователей

#### `clusters/` - Управление кластерами и подключениями
- **models.py** - Модели: ServerConnection
- **views.py** - API endpoints для подключений и кластеров
- **rac_client.py** - Клиент для работы с RAC (1C)
- **urls.py** - URL маршруты для кластеров
- **admin.py** - Админ-панель для подключений

#### `frontend/` - Фронтенд приложение
- **views.py** - Главная страница (dashboard)
- **urls.py** - URL маршруты фронтенда
- **static/frontend/** - Статические файлы
  - **css/main.css** - Все стили приложения
  - **js/** - JavaScript модули:
    - **app.js** - Инициализация приложения
    - **utils.js** - Утилиты (уведомления, CSRF, localStorage)
    - **navigation.js** - Навигация и переключение разделов
    - **users.js** - Управление пользователями
    - **groups.js** - Управление группами
    - **connections.js** - Управление подключениями и кластерами
    - **settings.js** - Настройки системы
    - **statistics.js** - Статистика системы

#### `config/` - Конфигурация проекта
- **settings.py** - Настройки Django
- **urls.py** - Главный файл URL маршрутов
- **wsgi.py** - WSGI конфигурация

### Templates (Шаблоны)

#### `templates/base.html` - Базовый шаблон
- Основная структура HTML
- Подключение CSS и JS
- Уведомления

#### `templates/frontend/` - Шаблоны фронтенда
- **index.html** - Главная страница
- **partials/_sidebar.html** - Боковая панель с подключениями
- **partials/_welcome.html** - Приветственный блок со статистикой

#### `templates/registration/` - Шаблоны аутентификации
- **login.html** - Страница входа
- **force_password_change.html** - Принудительная смена пароля

### Логика организации

1. **Разделение по функциональности**: Каждое Django приложение отвечает за свою область
2. **Модульность JavaScript**: Каждый JS файл отвечает за свою функциональность
3. **Единый CSS файл**: Все стили в одном месте для простоты поддержки
4. **Частичные шаблоны**: Переиспользуемые компоненты в `partials/`

### Рекомендации по добавлению новых функций

1. **Новый функционал для пользователей** → `users/views.py` и `frontend/static/frontend/js/users.js`
2. **Новый функционал для кластеров** → `clusters/views.py` и `frontend/static/frontend/js/connections.js`
3. **Новый функционал для групп** → `users/views.py` и `frontend/static/frontend/js/groups.js`
4. **Новые системные настройки** → `core/views.py` и `frontend/static/frontend/js/settings.js`
5. **Новые RAC команды** → `clusters/rac_client.py` (добавить метод)
6. **Новые стили** → `frontend/static/frontend/css/main.css`

### Удалённые неиспользуемые файлы

- `templates/core/dashboard.html` - пустой файл
- `templates/registration/logout.html` - не используется (Django использует встроенный view)
- `core/utils/` - пустая папка

