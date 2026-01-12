# Используем легкий Python образ
FROM python:3.9-slim

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем системные зависимости
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Копируем requirements.txt
COPY requirements.txt .

# Устанавливаем Python зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь проект
COPY . .

# Создаем необходимые папки
RUN mkdir -p static templates /tmp/uploads

# Открываем порт (Hugging Face использует 7860)
EXPOSE 7860

# Устанавливаем переменные окружения
ENV PORT=7860
ENV ENVIRONMENT=production

# Запускаем приложение
CMD ["python", "app.py"]