---
title: PDF Table Extractor
emoji: 📊
colorFrom: blue
colorTo: purple
sdk: docker
app_file: app.py
pinned: false
---

# PDF Table Extractor

Flask веб-приложение для извлечения табличных данных из PDF файлов с использованием GigaChat API.

##  Использование

1. **Загрузите PDF файл** с таблицей
2. **Введите API ключ GigaChat** (получите на [developers.sber.ru](https://developers.sber.ru))
3. **Нажмите "Извлечь таблицу из PDF"**
4. **Получите результат** в виде таблицы или JSON

##  Технологии

- **Backend:** Flask (Python)
- **Frontend:** HTML, CSS, JavaScript
- **AI API:** GigaChat API от Сбербанка
- **Хостинг:** Hugging Face Spaces

##  Структура проекта

- pp.py - Основное Flask приложение
- 
equirements.txt - Python зависимости
- Dockerfile - Конфигурация Docker контейнера
- static/ - Статические файлы (CSS, JavaScript)
- 	emplates/ - HTML шаблоны

##  Ссылки

- [GitHub репозиторий](https://github.com/Ckripok/PDF-Table-Extractor)
- [GigaChat API документация](https://developers.sber.ru/docs/ru/gigachat/overview)

##  Лицензия

MIT License
