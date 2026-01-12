#!/usr/bin/env python3
"""
Скрипт для подготовки проекта к деплою на Hugging Face Spaces
"""

import os
import shutil
import subprocess


def create_structure():
    """Создает правильную структуру проекта"""
    print("📁 Создание структуры проекта...")

    # Создаем папки если их нет
    folders = ['static', 'templates']
    for folder in folders:
        if not os.path.exists(folder):
            os.makedirs(folder)
            print(f"  ✅ Создана папка: {folder}")
        else:
            print(f"  ✅ Папка уже существует: {folder}")

    # Проверяем наличие script.js в static/
    if os.path.exists('script.js'):
        shutil.move('script.js', 'static/script.js')
        print("  ✅ script.js перемещен в static/")

    return True


def check_files():
    """Проверяет наличие необходимых файлов"""
    print("\n🔍 Проверка файлов...")

    required_files = ['app.py', 'requirements.txt', 'Dockerfile']
    missing_files = []

    for file in required_files:
        if os.path.exists(file):
            print(f"  ✅ {file}")
        else:
            print(f"  ❌ {file} - ОТСУТСТВУЕТ!")
            missing_files.append(file)

    if missing_files:
        print(f"\n⚠️  Не хватает файлов: {missing_files}")
        return False

    return True


def clean_unnecessary():
    """Удаляет ненужные файлы для HF"""
    print("\n🗑️  Очистка ненужных файлов...")

    files_to_remove = [
        'railway.json',
        'check_railway.py',
        'Procfile',
        'runtime.txt',
        'nixpacks.toml',
        'pyvenv.cfg'
    ]

    for file in files_to_remove:
        if os.path.exists(file):
            try:
                os.remove(file)
                print(f"  ✅ Удален: {file}")
            except:
                print(f"  ❌ Не удалось удалить: {file}")

    return True


def update_requirements():
    """Обновляет requirements.txt"""
    print("\n📦 Обновление зависимостей...")

    # Упрощенные зависимости
    requirements = """Flask==2.3.3
Flask-CORS==4.0.0
requests==2.31.0
urllib3==2.0.7
Werkzeug==2.3.7
python-dotenv==1.0.0"""

    with open('requirements.txt', 'w') as f:
        f.write(requirements)

    print("  ✅ requirements.txt обновлен")
    return True


def git_operations():
    """Выполняет Git операции"""
    print("\n💾 Git операции...")

    try:
        # Добавляем все файлы
        subprocess.run(['git', 'add', '.'], check=True)
        print("  ✅ Файлы добавлены в Git")

        # Коммит
        subprocess.run(['git', 'commit', '-m', 'Prepare for Hugging Face Spaces deployment'], check=True)
        print("  ✅ Коммит создан")

        return True
    except subprocess.CalledProcessError as e:
        print(f"  ❌ Ошибка Git: {e}")
        return False


def main():
    print("🚀 ПОДГОТОВКА К HUGGING FACE SPACES")
    print("=" * 50)

    # Выполняем шаги
    steps = [
        ("Структура проекта", create_structure),
        ("Проверка файлов", check_files),
        ("Очистка", clean_unnecessary),
        ("Зависимости", update_requirements),
    ]

    all_ok = True
    for step_name, step_func in steps:
        print(f"\n📝 {step_name}:")
        if not step_func():
            all_ok = False

    if all_ok:
        print("\n" + "=" * 50)
        print("✅ Проект готов к деплою на Hugging Face!")
        print("\n🎯 Следующие шаги:")
        print("1. Откройте https://huggingface.co/spaces")
        print("2. Нажмите 'Create new Space'")
        print("3. Выберите:")
        print("   - Name: pdf-table-extractor")
        print("   - SDK: Docker")
        print("   - Visibility: Public")
        print("4. Нажмите 'Create Space'")
        print("5. Загрузите файлы или свяжите с GitHub")
    else:
        print("\n❌ Есть проблемы, которые нужно исправить")


if __name__ == '__main__':
    main()