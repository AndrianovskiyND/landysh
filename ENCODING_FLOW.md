# Путь обработки ошибок и кодировка

## Сообщение: "Ошибка загрузки свойств информационной базы:"

### Полный путь обработки:

#### 1. Выполнение RAC команды (`clusters/rac_client.py`)

**Файл:** `clusters/rac_client.py`, метод `_execute_command()`

**Шаг 1.1:** RAC команда выполняется через `subprocess.run()`
- Вывод приходит как **байты** (bytes)
- `result.stderr` или `result.stdout` содержат сырые байты

**Шаг 1.2:** Декодирование ошибки через функцию `decode_text()` (внутри `_execute_command`)
```python
def decode_text(data_bytes):
    # Пробует кодировки в порядке:
    # Windows: ['cp866', 'cp1251', 'utf-8', 'latin1']
    # Linux: ['cp1251', 'utf-8', 'koi8-r', 'cp866', 'latin1']
    
    # Специальная обработка для "битой" кодировки:
    # - Если обнаружены признаки CP1251, прочитанной как UTF-8
    # - Сразу пробует декодировать как cp1251 или koi8-r
    # - Возвращает строку в UTF-8 (Unicode)
```

**Результат:** Строка в **UTF-8 (Unicode)** - `error_text`

**Шаг 1.3:** Применение `fix_broken_encoding()` к ошибке
```python
error_text = fix_broken_encoding(error_text)
```

Функция `fix_broken_encoding()`:
- Если входные данные - байты: пробует декодировать как `cp1251`, `koi8-r`, `utf-8`, `cp866`
- Если входные данные - строка: проверяет на признаки "битой" кодировки
  - Если обнаружена "битая" кодировка (CP1251 прочитанная как UTF-8):
    - Кодирует строку обратно в байты как UTF-8
    - Декодирует байты как CP1251 или koi8-r
    - Возвращает исправленную строку в UTF-8

**Результат:** Строка в **UTF-8 (Unicode)**

**Шаг 1.4:** Возврат из `_execute_command()`
```python
return {'success': False, 'error': error_text}  # error_text - строка UTF-8
```

---

#### 2. Обработка в Django View (`clusters/views.py`)

**Файл:** `clusters/views.py`, функция `get_infobase_info()`

**Шаг 2.1:** Получение результата от RAC клиента
```python
result = rac_client.get_infobase_info(cluster_uuid, infobase_uuid, infobase_name)
# result['error'] - уже строка в UTF-8
```

**Шаг 2.2:** Повторное применение `fix_broken_encoding()`
```python
error_msg = result.get('error', 'Ошибка получения информации')
error_msg = fix_broken_encoding(error_msg)  # Еще раз проверяем и исправляем
```

**Результат:** Строка в **UTF-8 (Unicode)**

**Шаг 2.3:** Возврат через JsonResponse
```python
return JsonResponse({
    'success': False,
    'error': error_msg
}, json_dumps_params={'ensure_ascii': False})
```

**Важно:** `ensure_ascii=False` означает:
- JSON сериализует строку **как есть**, сохраняя Unicode символы
- Строка передается в JSON как UTF-8, но в JSON она представлена как Unicode escape sequences или напрямую (в зависимости от символов)
- Например: `"Недостаточно"` → `"\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e"` или `"Недостаточно"` (если клиент поддерживает UTF-8)

---

#### 3. Передача через HTTP

**Content-Type:** `application/json; charset=utf-8` (по умолчанию в Django)

**Кодировка ответа:** **UTF-8**

JSON тело содержит строку в UTF-8, но может быть представлена:
- Напрямую: `"error": "Недостаточно прав пользователя на информационную базу"`
- Или через Unicode escape: `"error": "\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e..."`

---

#### 4. Обработка в браузере (`frontend/static/frontend/js/connections.js`)

**Файл:** `frontend/static/frontend/js/connections.js`, строка ~3416

**Шаг 4.1:** Получение JSON ответа
```javascript
const response = await fetch(`/api/clusters/infobases/${connectionId}/${clusterUuid}/info/?infobase=${infobaseUuid}`);
const data = await response.json();
```

**Важно:** `response.json()` автоматически декодирует JSON из UTF-8 в JavaScript строку (Unicode)

**Шаг 4.2:** Отображение ошибки
```javascript
showNotification('❌ Ошибка загрузки свойств информационной базы: ' + (data.error || 'Неизвестная ошибка'), true);
```

**Результат:** JavaScript строка (Unicode) отображается в браузере

---

## Итоговая кодировка на каждом этапе:

1. **RAC вывод (subprocess):** Байты (может быть cp1251, cp866, koi8-r, utf-8)
2. **После decode_text():** UTF-8 (Unicode строка Python)
3. **После fix_broken_encoding():** UTF-8 (Unicode строка Python)
4. **В JsonResponse:** UTF-8 (в JSON формате)
5. **HTTP ответ:** UTF-8 (Content-Type: application/json; charset=utf-8)
6. **В JavaScript:** Unicode строка (автоматически декодируется из UTF-8)
7. **В браузере:** Отображается как Unicode (UTF-8)

---

## Проблема с "битой" кодировкой:

Если ошибка все еще отображается как "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ", это означает:

1. **Либо** ошибка не прошла через `fix_broken_encoding()` правильно
2. **Либо** ошибка была неправильно декодирована на этапе `decode_text()`
3. **Либо** ошибка пришла уже как "битая" строка и `fix_broken_encoding()` не смогла её исправить

### Возможные причины:

- Ошибка пришла не из `result.stderr`, а из другого источника
- Ошибка была декодирована неправильной кодировкой на первом этапе
- `fix_broken_encoding()` не обнаружила признаки "битой" кодировки
- Порог обнаружения "битой" кодировки слишком высокий

---

## Рекомендации для отладки:

1. Добавить логирование сырых байтов ошибки перед декодированием
2. Добавить логирование результата после каждого этапа декодирования
3. Проверить, что `fix_broken_encoding()` вызывается для всех ошибок
4. Убедиться, что все пути возврата ошибок проходят через `fix_broken_encoding()`

