# -*- coding: utf-8 -*-
"""
PDF Table Extractor - Flask сервер для работы с GigaChat API
Версия для Hugging Face Spaces
"""

import os
import json
import tempfile
import requests
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
import urllib3

# Отключаем предупреждения SSL для разработки
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)
CORS(app)  # Разрешаем CORS для всех доменов

# Конфигурация для Hugging Face
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['UPLOAD_FOLDER'] = '/tmp/uploads'  # Используем /tmp в Spaces
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # Максимальный размер файла 50MB

# Создаем папку для загрузок
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Конфигурация GigaChat API
OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
GIGACHAT_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"
UPLOAD_URL = "https://gigachat.devices.sberbank.ru/api/v1/files"


def allowed_file(filename):
    """Проверяем, что файл имеет допустимое расширение"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() == 'pdf'


# ========== РОУТЫ ДЛЯ СТАТИЧЕСКИХ ФАЙЛОВ ==========
@app.route('/static/<path:filename>')
def serve_static_files(filename):
    """Обслуживание статических файлов"""
    return send_from_directory('static', filename)


# ========== ГЛАВНЫЕ РОУТЫ ==========
@app.route('/')
def index():
    """Главная страница"""
    return render_template('index.html')


@app.route('/health')
def health():
    """Health check для Hugging Face"""
    return jsonify({
        "status": "healthy",
        "service": "PDF Table Extractor",
        "version": "1.0.0",
        "environment": os.environ.get('ENVIRONMENT', 'development')
    })


@app.route('/api/oauth', methods=['POST'])
def get_oauth_token():
    """Получение токена доступа через API ключ"""
    try:
        # Получаем данные из запроса
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        api_key = data.get('api_key')
        if not api_key:
            return jsonify({"error": "API key is required"}), 400

        print(f"Получен запрос на получение токена с API ключем: {api_key[:20]}...")

        # Заголовки для запроса к GigaChat
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "RqUID": "87d5de19-0c14-4223-b7c2-ccea3182470a",
            "Authorization": f"Basic {api_key}"
        }

        payload = {"scope": "GIGACHAT_API_PERS"}

        # Отправляем запрос к GigaChat API
        print(f"Отправляем запрос к {OAUTH_URL}")
        response = requests.post(
            OAUTH_URL,
            headers=headers,
            data=payload,
            verify=False,  # Отключаем проверку SSL для разработки
            timeout=30
        )

        # Проверяем ответ
        response.raise_for_status()
        result = response.json()

        print(f"Токен успешно получен: {result.get('access_token')[:20]}...")

        return jsonify({
            "access_token": result.get("access_token"),
            "expires_at": result.get("expires_at"),
            "token_type": result.get("token_type", "Bearer")
        })

    except requests.exceptions.RequestException as e:
        error_msg = f"Ошибка при запросе к API: {str(e)}"
        print(f"ERROR: {error_msg}")
        if hasattr(e, 'response') and e.response:
            print(f"Response status: {e.response.status_code}")
            print(f"Response text: {e.response.text}")
        return jsonify({"error": error_msg}), 500
    except Exception as e:
        error_msg = f"Неожиданная ошибка: {str(e)}"
        print(f"ERROR: {error_msg}")
        return jsonify({"error": error_msg}), 500


@app.route('/api/files', methods=['POST'])
def upload_file():
    """Загрузка файла на сервер GigaChat"""
    try:
        print("=" * 60)
        print("DEBUG: Начало загрузки файла в GigaChat")

        # Проверяем заголовок авторизации
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            print("ERROR: Отсутствует заголовок Authorization")
            return jsonify({"error": "Authorization header is required"}), 401

        print(f"DEBUG: Токен получен: {auth_header[:50]}...")

        # Проверяем наличие файла
        if 'file' not in request.files:
            print("ERROR: В запросе нет файла")
            return jsonify({"error": "No file part in request"}), 400

        file = request.files['file']

        if file.filename == '':
            print("ERROR: Файл не выбран")
            return jsonify({"error": "No file selected"}), 400

        if not allowed_file(file.filename):
            print(f"ERROR: Неподдерживаемый формат файла: {file.filename}")
            return jsonify({"error": "Only PDF files are allowed"}), 400

        print(f"DEBUG: Загружаемый файл: {file.filename}, размер: {file.content_length} байт")

        # Сохраняем файл временно
        filename = secure_filename(file.filename)
        temp_filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(temp_filepath)

        print(f"DEBUG: Файл сохранен временно: {temp_filepath} ({os.path.getsize(temp_filepath)} bytes)")

        try:
            # Подготавливаем запрос к GigaChat API
            headers = {
                "Accept": "application/json",
                "Authorization": auth_header
            }

            # Открываем файл для отправки
            with open(temp_filepath, 'rb') as f:
                files = {
                    "file": (filename, f, "application/pdf"),
                    "purpose": (None, "general")
                }

                print(f"DEBUG: Отправляем файл в GigaChat API...")
                print(f"DEBUG: URL: {UPLOAD_URL}")

                response = requests.post(
                    UPLOAD_URL,
                    headers=headers,
                    files=files,
                    verify=False,
                    timeout=60
                )

            print(f"DEBUG: Статус ответа GigaChat: {response.status_code}")
            print(f"DEBUG: Ответ GigaChat: {response.text[:200]}...")

            response.raise_for_status()
            result = response.json()

            print(f"DEBUG: Файл успешно загружен в GigaChat. ID файла: {result.get('id')}")

            # Удаляем временный файл
            if os.path.exists(temp_filepath):
                os.remove(temp_filepath)

            return jsonify({
                "id": result.get("id"),
                "filename": filename,
                "object": result.get("object", "file"),
                "bytes": result.get("bytes", 0),
                "status": "uploaded"
            })

        except requests.exceptions.RequestException as e:
            print(f"ERROR: Ошибка при запросе к GigaChat: {str(e)}")
            if hasattr(e, 'response') and e.response:
                print(f"ERROR: Response status: {e.response.status_code}")
                print(f"ERROR: Response text: {e.response.text[:500]}")
            raise e

    except Exception as e:
        print(f"ERROR: Неожиданная ошибка при загрузке файла: {str(e)}")
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500


@app.route('/api/chat/completions', methods=['POST'])
def chat_completions():
    """Запрос к GigaChat API для извлечения данных из таблицы"""
    try:
        # Получаем данные из запроса
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        print("=" * 60)
        print("DEBUG: Получен запрос к chat/completions")
        print(f"DEBUG: Данные запроса: {json.dumps(data, ensure_ascii=False)[:500]}")

        # Проверяем наличие attachments
        messages = data.get('messages', [])
        if messages:
            first_message = messages[0]
            attachments = first_message.get('attachments', [])
            print(f"DEBUG: Прикрепленные файлы (attachments): {attachments}")

        # Проверяем заголовок авторизации
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({"error": "Authorization header is required"}), 401

        # Подготавливаем заголовки для GigaChat API
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": auth_header
        }

        # Отправляем запрос к GigaChat API
        print(f"DEBUG: Отправляем запрос к {GIGACHAT_URL}")
        response = requests.post(
            GIGACHAT_URL,
            headers=headers,
            json=data,
            verify=False,
            timeout=120
        )

        response.raise_for_status()
        result = response.json()

        print(
            f"DEBUG: Получен ответ от GigaChat. Количество токенов: {result.get('usage', {}).get('total_tokens', 'unknown')}")
        print(f"DEBUG: Ответ: {json.dumps(result, ensure_ascii=False)[:500]}...")
        print("=" * 60)

        return jsonify(result)

    except requests.exceptions.RequestException as e:
        error_msg = f"Ошибка при запросе к GigaChat API: {str(e)}"
        print(f"ERROR: {error_msg}")
        if hasattr(e, 'response') and e.response:
            print(f"ERROR: Response status: {e.response.status_code}")
            print(f"ERROR: Response text: {e.response.text[:500]}")
        return jsonify({"error": error_msg}), 500
    except Exception as e:
        error_msg = f"Неожиданная ошибка: {str(e)}"
        print(f"ERROR: {error_msg}")
        return jsonify({"error": error_msg}), 500


@app.route('/test', methods=['GET'])
def test_api():
    """Тестовый endpoint для проверки работы сервера"""
    return jsonify({
        "status": "ok",
        "message": "Сервер работает корректно",
        "environment": os.environ.get('ENVIRONMENT', 'development'),
        "endpoints": {
            "GET /": "Главная страница",
            "GET /health": "Health check",
            "GET /test": "Тестовый endpoint",
            "POST /api/oauth": "Получение токена доступа",
            "POST /api/files": "Загрузка файла в GigaChat",
            "POST /api/chat/completions": "Запрос к GigaChat API"
        }
    })


# ========== УНИВЕРСАЛЬНЫЙ РОУТ ДЛЯ СТАТИЧЕСКИХ ФАЙЛОВ ==========
@app.route('/<path:filename>')
def catch_all(filename):
    """Универсальный роут для статических файлов"""
    if filename.endswith('.css'):
        return send_from_directory('static', filename)
    elif filename.endswith('.js'):
        return send_from_directory('static', filename)
    elif filename.endswith('.html'):
        return send_from_directory('templates', filename)
    elif filename == 'favicon.ico':
        return '', 404  # Или верните favicon
    else:
        return jsonify({"error": "File not found", "path": filename}), 404


# ========== ЗАПУСК ПРИЛОЖЕНИЯ ==========
if __name__ == '__main__':
    # Получаем порт из окружения (Hugging Face использует 7860)
    port = int(os.environ.get('PORT', 7860))

    # Создаем необходимые папки
    os.makedirs('static', exist_ok=True)
    os.makedirs('templates', exist_ok=True)
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    print("=" * 60)
    print("📊 PDF Table Extractor Server")
    print("🚀 Версия для Hugging Face Spaces")
    print("=" * 60)
    print(f"Порт: {port}")
    print(f"Папка загрузок: {app.config['UPLOAD_FOLDER']}")
    print(f"Режим: {os.environ.get('ENVIRONMENT', 'development')}")
    print("=" * 60)

    # Запускаем сервер
    app.run(
        debug=False,  # В продакшне всегда False!
        host='0.0.0.0',
        port=port,
        threaded=True
    )