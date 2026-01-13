# PDF Table Extractor

**PDF Table Extractor** — веб‑приложение для извлечения таблиц из PDF‑файлов. Проект ориентирован на быстрое получение структурированных данных (таблицы / JSON) из научных и технических PDF‑документов.

---

## Что делает

* Принимает PDF‑файл с таблицами через веб‑интерфейс.
* Анализирует содержимое документа с помощью LLM.
* Извлекает табличные данные и возвращает их в структурированном виде (таблица, JSON).

Проект доступен также в виде **Hugging Face Space**.

---

## Быстрый запуск (локально)

### Требования

* Python 3.8+
* pip

---

### Установка и запуск

1. Клонировать репозиторий:

```bash
git clone https://github.com/Ckripok/PDF-Table-Extractor.git
cd PDF-Table-Extractor
```

2. Создать виртуальное окружение и установить зависимости:

```bash
python -m venv venv
source venv/bin/activate  # Linux / macOS
venv\\Scripts\\activate     # Windows

pip install -r requirements.txt
```

3. Указать ключ API (если используется LLM‑API):

Создайте файл `.env`:

```env
GIGACHAT_API_KEY=ваш_api_ключ
```

4. Запустить приложение:

```bash
flask run
```

Приложение будет доступно по адресу:

```
http://127.0.0.1:5000
```

---

## Использование

1. Откройте веб‑интерфейс.
2. Загрузите PDF‑файл с таблицами.
3. Нажмите кнопку извлечения.
4. Получите таблицы в структурированном виде.

---

## Запуск через Docker (опционально)

```bash
docker build -t pdf-table-extractor .
docker run -p 5000:5000 pdf-table-extractor
```

---

## Структура проекта

* `app.py` — основной Flask‑сервер
* `requirements.txt` — зависимости Python
* `templates/` — HTML‑шаблоны
* `static/` — CSS и JavaScript
* `Dockerfile` — конфигурация Docker

---

## Технологии

* Python / Flask
* HTML / CSS / JavaScript
* LLM API (GigaChat)
* Docker (опционально)

---

## Лицензия

MIT

