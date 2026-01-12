#!/usr/bin/env python3
"""
Скрипт для проверки готовности к деплою на Railway
"""

import os
import sys

REQUIRED_FILES = [
    'app.py',
    'requirements.txt',
    'Procfile',
    '.gitignore',
    'README.md'
]

OPTIONAL_FILES = [
    'runtime.txt',
    'railway.json',
    'nixpacks.toml',
    '.env.example'
]


def check_files():
    print("🔍 Проверка файлов для Railway...")
    print("-" * 50)

    all_good = True

    for file in REQUIRED_FILES:
        if os.path.exists(file):
            print(f"✅ {file}")
        else:
            print(f"❌ {file} - ОТСУТСТВУЕТ!")
            all_good = False

    print("\n📁 Опциональные файлы:")
    for file in OPTIONAL_FILES:
        if os.path.exists(file):
            print(f"  ✅ {file}")
        else:
            print(f"  ⚠️  {file} - рекомендуется добавить")

    return all_good


def check_app_py():
    print("\n🔍 Проверка app.py...")
    print("-" * 50)

    try:
        with open('app.py', 'r', encoding='utf-8') as f:
            content = f.read()

        checks = {
            'PORT из окружения': 'PORT = int(os.environ.get("PORT", 5000))' in content,
            '0.0.0.0 хост': "host='0.0.0.0'" in content,
            'debug=False в продакшне': 'debug=False' in content or 'debug=os.environ' in content,
            'Есть main блок': 'if __name__' in content,
        }

        for check, result in checks.items():
            if result:
                print(f"✅ {check}")
            else:
                print(f"❌ {check}")

        # Проверка на опасные настройки
        warnings = []
        if 'verify=False' in content:
            warnings.append('Найдено verify=False - небезопасно для продакшна')
        if 'debug=True' in content and 'debug=os.environ' not in content:
            warnings.append('debug=True должен зависеть от окружения')

        if warnings:
            print("\n⚠️  Предупреждения безопасности:")
            for warning in warnings:
                print(f"  ⚠️  {warning}")

    except Exception as e:
        print(f"❌ Ошибка при проверке app.py: {e}")
        return False

    return True


def check_requirements():
    print("\n🔍 Проверка requirements.txt...")
    print("-" * 50)

    try:
        with open('requirements.txt', 'r') as f:
            lines = f.readlines()

        required_packages = ['Flask', 'gunicorn']
        found_packages = []

        for line in lines:
            line = line.strip()
            if line and not line.startswith('#'):
                for package in required_packages:
                    if package.lower() in line.lower():
                        found_packages.append(package)

        for package in required_packages:
            if package in found_packages:
                print(f"✅ {package}")
            else:
                print(f"❌ {package} - отсутствует")

        return len(found_packages) == len(required_packages)

    except Exception as e:
        print(f"❌ Ошибка при проверке requirements.txt: {e}")
        return False


def main():
    print("🚂 ПОДГОТОВКА К RAILWAY")
    print("=" * 50)

    files_ok = check_files()
    app_ok = check_app_py()
    req_ok = check_requirements()

    print("\n" + "=" * 50)
    print("📊 ИТОГ:")

    if files_ok and app_ok and req_ok:
        print("✅ Всё готово для деплоя на Railway!")
        print("\n🎯 Дальнейшие шаги:")
        print("1. git add . && git commit -m 'Ready for Railway deployment'")
        print("2. git push origin main")
        print("3. Зайдите на https://railway.app")
        print("4. Создайте новый проект из GitHub репозитория")
        print("5. Добавьте переменные окружения если нужно")
        print("6. Нажмите Deploy!")
    else:
        print("❌ Есть проблемы, которые нужно исправить перед деплоем")
        sys.exit(1)


if __name__ == '__main__':
    main()