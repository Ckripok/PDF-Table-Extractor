// Конфигурация API - OpenRouter DeepSeek
const API_CONFIG = {
    OPENROUTER_URL: "https://openrouter.ai/api/v1/chat/completions",
    OPENROUTER_KEY: "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",
    MODEL: "deepseek/deepseek-r1:free"
};

// Глобальные переменные
let currentFile = null;
let currentFileId = null;
let accessToken = null;
let jsonData = null;
let isEditMode = false;
let originalTableData = null;
let selectedRows = new Set();
let selectedColumns = new Set();
let tokenCache = { value: null, expires: 0 };
let rawResponse = null;

// Элементы DOM
const elements = {
    uploadArea: document.getElementById('uploadArea'),
    pdfFileInput: document.getElementById('pdfFile'),
    selectFileBtn: document.getElementById('selectFileBtn'),
    fileInfo: document.getElementById('fileInfo'),
    fileName: document.getElementById('fileName'),
    fileSize: document.getElementById('fileSize'),
    removeFileBtn: document.getElementById('removeFileBtn'),
    validationAlert: document.getElementById('validationAlert'),
    apiKeyInput: document.getElementById('apiKey'),
    accessTokenInput: document.getElementById('accessToken'),
    getTokenBtn: document.getElementById('getTokenBtn'),
    expectedRowsInput: document.getElementById('expectedRows'),
    processBtn: document.getElementById('processBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    progressBar: document.getElementById('progressBar'),
    statusText: document.getElementById('statusText'),
    jsonOutput: document.getElementById('jsonOutput'),
    tableView: document.getElementById('tableView'),
    jsonView: document.getElementById('jsonView'),
    tableHeader: document.getElementById('tableHeader'),
    tableBody: document.getElementById('tableBody'),
    tableInfo: document.getElementById('tableInfo'),
    alertTitle: document.getElementById('alertTitle'),
    alertMessage: document.getElementById('alertMessage'),
    copyJsonBtn: document.getElementById('copyJsonBtn'),
    toggleViewBtn: document.getElementById('toggleViewBtn'),
    clearResultsBtn: document.getElementById('clearResultsBtn'),
    tokenModal: document.getElementById('tokenModal'),
    modalOverlay: document.getElementById('modalOverlay'),
    closeTokenModal: document.getElementById('closeTokenModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    tokenStatusContent: document.getElementById('tokenStatusContent'),
    tokenResult: document.getElementById('tokenResult'),
    tokenError: document.getElementById('tokenError'),
    tokenOutput: document.getElementById('tokenOutput'),
    copyTokenBtn: document.getElementById('copyTokenBtn'),
    errorText: document.getElementById('errorText'),
    toggleApiKey: document.getElementById('toggleApiKey')
};

function init() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupEventListeners);
    } else {
        setupEventListeners();
    }
    loadSavedSettings();

    // Инициализируем dropdown экспорта
    setTimeout(setupExportDropdown, 100);
}

function setupEventListeners() {
    // Загрузка файла
    elements.selectFileBtn.addEventListener('click', () => elements.pdfFileInput.click());
    elements.pdfFileInput.addEventListener('change', handleFileSelect);

    elements.uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.add('dragover');
    });

    elements.uploadArea.addEventListener('dragleave', () => {
        elements.uploadArea.classList.remove('dragover');
    });

    elements.uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    if (document.getElementById('exportTableBtn')) {
    document.getElementById('exportTableBtn').addEventListener('click', function() {
        // Показываем dropdown экспорта
        const dropdown = document.getElementById('exportDropdown');
        if (dropdown) {
            dropdown.classList.toggle('show');
        }
    });
    }

    elements.uploadArea.addEventListener('click', () => elements.pdfFileInput.click());
    elements.removeFileBtn.addEventListener('click', removeFile);
    elements.getTokenBtn.addEventListener('click', getAccessToken);
    elements.processBtn.addEventListener('click', processPDF);
    elements.downloadBtn.addEventListener('click', downloadJSON);
    elements.copyJsonBtn.addEventListener('click', copyJSON);
    elements.toggleViewBtn.addEventListener('click', toggleView);
    elements.clearResultsBtn.addEventListener('click', clearResults);

    // Модальное окно токена
    elements.closeTokenModal.addEventListener('click', () => {
        elements.tokenModal.style.display = 'none';
    });

    elements.copyTokenBtn.addEventListener('click', copyToken);

    // Сохранение настроек
    elements.apiKeyInput.addEventListener('input', saveSettings);
    elements.accessTokenInput.addEventListener('input', saveSettings);
    elements.expectedRowsInput.addEventListener('input', saveSettings);

    // Кнопка редактирования
    if (document.getElementById('editTableBtn')) {
        document.getElementById('editTableBtn').addEventListener('click', toggleEditMode);
    }

    // Кнопка исправления ассимиляции
    if (document.getElementById('forceAssimilationBtn')) {
        document.getElementById('forceAssimilationBtn').addEventListener('click', function() {
            try {
                const jsonText = elements.jsonOutput.textContent;
                const data = JSON.parse(jsonText);
                if (!data.table_data) {
                    alert('Нет табличных данных');
                    return;
                }
                const originalCount = data.table_data.length;
                data.table_data = forceFixAssimilationImproved(data.table_data);
                let changes = 0;
                data.table_data.forEach(row => {
                    Object.keys(row).forEach(key => {
                        if (key !== 'characteristic' && row[key] === '+') {
                            const originalRow = jsonData ? JSON.parse(jsonData).table_data.find(r =>
                                r.characteristic === row.characteristic
                            ) : null;
                            if (originalRow && originalRow[key] !== '+') {
                                changes++;
                            }
                        }
                    });
                });
                elements.jsonOutput.textContent = JSON.stringify(data, null, 2);
                highlightJSON();
                if (elements.tableView.style.display === 'block') {
                    displayTable(data.table_data);
                }
                jsonData = JSON.stringify(data);
                if (changes > 0) {
                    showNotification(`Исправлено ${changes} значений ассимиляции`, 'success');
                } else {
                    alert('Не найдено значений "?" для исправления ассимиляции.');
                }
            } catch (error) {
                console.error('Ошибка при исправлении ассимиляции:', error);
                showNotification('Ошибка при исправлении ассимиляции', 'error');
            }
        });
    }

    // Экспорт таблицы
    if (document.getElementById('exportTableBtn')) {
        document.getElementById('exportTableBtn').addEventListener('click', exportTable);
    }

    // Показать сырой ответ
    if (document.getElementById('showRawBtn')) {
        document.getElementById('showRawBtn').addEventListener('click', showRawResponse);
    }

    // Закрытие модального окна при клике вне его
    window.addEventListener('click', (e) => {
        if (e.target === elements.tokenModal) {
            elements.tokenModal.style.display = 'none';
        }
    });
}

function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
}

function handleFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Пожалуйста, выберите файл в формате PDF');
        return;
    }

    if (file.size > 50 * 1024 * 1024) {
        alert('Размер файла не должен превышать 50 МБ');
        return;
    }

    currentFile = file;
    updateFileInfo();
    checkProcessButton();
}

function updateFileInfo() {
    elements.fileName.textContent = currentFile.name;
    elements.fileSize.textContent = formatFileSize(currentFile.size);
    elements.fileInfo.style.display = 'block';
}

function checkRateLimits() {
    const lastRequestTime = localStorage.getItem('lastGigaChatRequest');
    const now = Date.now();

    if (lastRequestTime) {
        const timeSinceLastRequest = now - parseInt(lastRequestTime);
        // Если прошло меньше 1 секунды с последнего запроса
        if (timeSinceLastRequest < 1000) {
            showNotification('Слишком частые запросы. Подождите секунду.', 'warning');
            return false;
        }
    }

    localStorage.setItem('lastGigaChatRequest', now.toString());
    return true;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeFile() {
    currentFile = null;
    currentFileId = null;
    elements.pdfFileInput.value = '';
    elements.fileInfo.style.display = 'none';
    checkProcessButton();
}

function checkProcessButton() {
    const hasFile = currentFile !== null;
    const hasApiKey = elements.apiKeyInput.value.trim() !== '';
    const hasToken = elements.accessTokenInput.value.trim() !== '';

    elements.processBtn.disabled = !hasFile || (!hasApiKey && !hasToken);
}

async function getAccessToken() {
    const apiKey = elements.apiKeyInput.value.trim();

    if (!apiKey) {
        alert('Пожалуйста, введите API ключ');
        return;
    }

    // Проверяем кеш
    const now = Date.now();
    if (tokenCache.value && tokenCache.expires > now) {
        console.log('Используем кешированный токен');
        accessToken = tokenCache.value;
        elements.accessTokenInput.value = accessToken;

        // Показываем уведомление
        showNotification('Используется кешированный токен', 'info');

        checkProcessButton();
        return;
    }

    // Показываем модальное окно
    if (elements.tokenModal) {
        elements.tokenModal.style.display = 'flex';
    }
    if (elements.tokenStatusContent) {
        elements.tokenStatusContent.style.display = 'block';
    }
    if (elements.tokenResult) {
        elements.tokenResult.style.display = 'none';
    }
    if (elements.tokenError) {
        elements.tokenError.style.display = 'none';
    }

    try {
        const response = await fetch('/api/oauth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                api_key: apiKey
            })
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);

            // Проверяем специфичные ошибки
            if (response.status === 429) {
                throw new Error('Превышен лимит запросов. Подождите 1 минуту и попробуйте снова.');
            }
            throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
        }

        const result = await response.json();
        console.log('Token response:', result);

        if (result.access_token) {
            // Сохраняем токен в кеш (действителен 1 час = 3600000 мс)
            tokenCache.value = result.access_token;
            tokenCache.expires = Date.now() + 3500000; // 58 минут для запаса

            // Сохраняем токен
            accessToken = result.access_token;
            elements.accessTokenInput.value = result.access_token;
            saveSettings();

            // Показываем результат
            if (elements.tokenStatusContent) {
                elements.tokenStatusContent.style.display = 'none';
            }
            if (elements.tokenResult) {
                elements.tokenResult.style.display = 'block';
            }
            if (elements.tokenOutput) {
                elements.tokenOutput.value = result.access_token;
            }

            // Обновляем статус токена
            if (elements.tokenStatus) {
                elements.tokenStatus.innerHTML = '<i class="fas fa-check-circle"></i> Получен';
                elements.tokenStatus.className = 'status-value status-active';
            }

            checkProcessButton();

        } else {
            throw new Error('Токен не найден в ответе');
        }

    } catch (error) {
        console.error('Ошибка при получении токена:', error);

        if (elements.tokenStatusContent) {
            elements.tokenStatusContent.style.display = 'none';
        }
        if (elements.tokenError) {
            elements.tokenError.style.display = 'block';
        }
        if (elements.errorText) {
            elements.errorText.textContent = `Ошибка: ${error.message}`;
        }

        // Показываем уведомление
        showNotification(error.message, 'error');
    }
}

function copyToken() {
    navigator.clipboard.writeText(elements.tokenOutput.value)
        .then(() => {
            const originalText = elements.copyTokenBtn.innerHTML;
            elements.copyTokenBtn.innerHTML = '<i class="fas fa-check"></i> Скопировано!';

            setTimeout(() => {
                elements.copyTokenBtn.innerHTML = originalText;
            }, 2000);
        })
        .catch(err => {
            console.error('Ошибка при копировании: ', err);
        });
}

async function processPDF() {
    if (!currentFile) {
        alert('Пожалуйста, выберите PDF файл');
        return;
    }

    // Проверяем лимиты запросов
    if (!checkRateLimits()) {
        return;
    }

    // Проверяем токен
    if (elements.accessTokenInput.value.trim()) {
        accessToken = elements.accessTokenInput.value.trim();
    } else if (elements.apiKeyInput.value.trim()) {
        // Пытаемся получить токен из API ключа
        await getAccessToken();
        if (!accessToken) {
            return;
        }
    } else {
        alert('Пожалуйста, введите API ключ или токен доступа');
        return;
    }

    // Показываем индикатор загрузки
    showLoading(true);
    updateProgress(10, 'Проверка данных...');

    try {
        // Загружаем файл
        updateProgress(30, 'Отправка файла на сервер...');
        const fileId = await uploadPDF(accessToken, currentFile);
        currentFileId = fileId;

        // Запрашиваем данные из GigaChat
        updateProgress(60, 'Извлечение данных из таблицы...');
        const jsonResult = await askGigaChat(accessToken, fileId);

        // Парсим и отображаем результат
        updateProgress(90, 'Обработка результатов...');
        jsonData = jsonResult;

        // Отображаем JSON
        displayJSON(jsonResult);

        // Проверяем данные
        checkMissingData(jsonResult);

        // Включаем кнопки
        elements.downloadBtn.disabled = false;

        updateExportButtons();

        updateProgress(100, 'Готово!');

        // Переключаемся на JSON вид
        showView('json');

        // Через секунду скрываем загрузку
        setTimeout(() => {
            showLoading(false);
        }, 1000);

    } catch (error) {
        console.error('Ошибка при обработке PDF:', error);
        showLoading(false);

        // Более информативное сообщение об ошибке
        if (error.message.includes('429') || error.message.includes('лимит')) {
            alert(`Ошибка: ${error.message}\n\nРекомендации:\n1. Подождите 1-2 минуты\n2. Проверьте ваш тарифный план GigaChat\n3. Попробуйте позже`);
        } else if (error.message.includes('401') || error.message.includes('токен')) {
            alert(`Ошибка: ${error.message}\n\nПолучите новый токен через кнопку "Получить токен"`);
        } else {
            alert(`Ошибка: ${error.message}`);
        }
    }
}

if (document.getElementById('clearCacheBtn')) {
    document.getElementById('clearCacheBtn').addEventListener('click', function() {
        tokenCache.value = null;
        tokenCache.expires = 0;
        localStorage.removeItem('lastGigaChatRequest');
        showNotification('Кеш очищен', 'info');
    });
}

async function uploadPDF(token, file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', 'general');

    console.log("DEBUG: Загрузка файла в GigaChat");
    console.log("DEBUG: Имя файла:", file.name);
    console.log("DEBUG: Размер файла:", file.size);

    try {
        const response = await fetch('/api/files', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        console.log("DEBUG: Статус ответа загрузки:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("DEBUG: Ошибка загрузки файла:", errorText);

            let errorMessage = `Ошибка загрузки файла: ${response.status}`;

            if (response.status === 429) {
                errorMessage = 'Превышен лимит запросов к GigaChat API. Подождите 1 минуту и попробуйте снова.';
                // Предлагаем пользователю подождать
                showNotification('Превышен лимит запросов. Подождите 1 минуту.', 'warning');

                // Можно автоматически попробовать через 60 секунд
                // setTimeout(() => {
                //     showNotification('Можно попробовать снова', 'info');
                // }, 60000);
            } else if (response.status === 401) {
                errorMessage = 'Токен устарел или недействителен. Получите новый токен.';
                // Сбрасываем кеш токена
                tokenCache.value = null;
                tokenCache.expires = 0;
            }

            throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log("DEBUG: Файл успешно загружен. ID:", result.id);
        return result.id;

    } catch (error) {
        console.error('Ошибка при загрузке файла:', error);
        throw error;
    }
}

async function askGigaChat(token, fileId) {
    console.log("DEBUG: Запрос к GigaChat");
    console.log("DEBUG: File ID:", fileId);

    const expectedRows = parseInt(elements.expectedRowsInput?.value) || 30;
    const expectedColumns = 24; // Как в Python коде

    const prompt = `ВНИМАТЕЛЬНО ПРОСМОТРИ таблицу из PDF и верни её строго в формате JSON.
ВАЖНО ЧТОБЫ ТЫ ЕЕ ПРОСМОТРЕЛ, ПРОАНАЛИЗИРОВАЛ КАК КАРТИНКУ. СЧИТЫВАНИЕ PDF МОЖЕТ БЫТЬ НЕ КОРРЕКТНЫМ.
ВАЖНО: В таблице должно быть ${expectedColumns} колонок (столбцов)!
Проверь внимательно - если видишь меньше колонок, значит ты пропустил часть данных.

СТРУКТУРА JSON:
{
  "table_data": [
    {
      "characteristic": "Название характеристики",
      "column_1": "значение",
      "column_2": "значение",
      ...
      "column_${expectedColumns}": "значение"
    }
  ]
}

КРИТИЧЕСКИ ВАЖНО:
1. Должно быть РОВНО ${expectedColumns} колонок. Если какая-то колонка пустая - оставь пустую строку "".
2. Имена колонок должны быть: column_1, column_2, ..., column_${expectedColumns}
3. Сохрани ВСЕ символы как есть: +, -, W, ND, числа, буквы.
4. Если колонок больше, чем ${expectedColumns} - включи все!
5. Верни ТОЛЬКО JSON, без пояснений.
6. Включи все строки таблицы, включая подзаголовки.

Пример для строки с ${expectedColumns} колонками:
{
  "characteristic": "Название характеристики",
  "column_1": "+",
  "column_2": "-",
  ...
  "column_${expectedColumns}": "значение"
}

Извлеки ВСЕ данные и убедись, что колонок ровно ${expectedColumns}!`;

    const payload = {
        "model": "GigaChat",
        "messages": [
            {
                "role": "user",
                "content": prompt,
                "attachments": [fileId]
            }
        ],
        "temperature": 0.1,
        "max_tokens": 8000  // Увеличиваем для больших таблиц
    };

    console.log("DEBUG: Отправляемый payload");

    try {
        const response = await fetch('/api/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        console.log("DEBUG: Статус ответа:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("DEBUG: Текст ошибки:", errorText);
            throw new Error(`Ошибка GigaChat API: ${response.status}, details: ${errorText}`);
        }

        const result = await response.json();
        console.log("DEBUG: Получен ответ от GigaChat");

        // Сохраняем сырой ответ для отладки
        rawResponse = result.choices?.[0]?.message?.content || '{"table_data": []}';

        // В setupEventListeners() замените обработчики:
        if (document.getElementById('showRawBtn')) {
            document.getElementById('showRawBtn').addEventListener('click', function(e) {
                e.stopPropagation();
                safeClick(showRawResponse);
            });
        }

        // Очищаем JSON
        const cleanedContent = cleanJSON(rawResponse);
        console.log("DEBUG: Очищенный контент (первые 500 символов):", cleanedContent.substring(0, 500));

        // Анализируем данные
        const analysis = analyzeExtractedData(cleanedContent, expectedColumns);
        console.log("Анализ данных:", analysis);

        // Проверяем, достаточно ли колонок
        if (analysis.columns_missing > 10) {
            console.warn(`ВНИМАНИЕ: Найдено только ${analysis.total_columns_found} из ${expectedColumns} колонок!`);
            // Можно показать уведомление пользователю
            showNotification(`Найдено только ${analysis.total_columns_found} из ${expectedColumns} колонок. Возможно, данные неполные.`, 'warning');
        }

        return cleanedContent;

    } catch (error) {
        console.error('Ошибка при запросе к GigaChat:', error);
        throw error;
    }
}

function setupTableControls() {
    console.log('Настройка обработчиков для кнопок управления таблицей');

    // Маппинг ID кнопок и их обработчиков
    const buttonHandlers = {
        'showAllColumnsBtn': showAllColumns,
        'showDataColumnsBtn': showDataColumns,
        'toggleEmptyColumnsBtn': toggleEmptyColumns,
        'deleteEmptyColumnsBtn': deleteEmptyColumnsSimple, // Убедитесь, что используется правильная функция
        'showAllRowsBtn': showAllRows,
        'showDataRowsBtn': showDataRows,
        'toggleEmptyRowsBtn': toggleEmptyRows,
        'deleteEmptyRowsBtn': deleteEmptyRows
    };

    // Назначаем обработчики для каждой кнопки
    Object.entries(buttonHandlers).forEach(([id, handler]) => {
        const button = document.getElementById(id);
        if (button) {
            // Удаляем старые обработчики, если есть
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            // Добавляем новый обработчик
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                // Добавляем визуальную обратную связь
                this.classList.add('active');
                setTimeout(() => this.classList.remove('active'), 200);

                // Вызываем обработчик
                try {
                    handler();
                } catch (error) {
                    console.error(`Ошибка в обработчике ${id}:`, error);
                    showNotification(`Ошибка: ${error.message}`, 'error');
                }
            });

            console.log(`Обработчик добавлен для кнопки: ${id}`);
        } else {
            console.warn(`Кнопка с ID "${id}" не найдена`);
        }
    });
}

function displayJSON(jsonStr) {
    try {
        // Очищаем предыдущие ошибки
        const existingError = elements.jsonOutput.parentNode.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        console.log('Начало отображения JSON');
        console.log('Длина исходных данных:', jsonStr.length);

        // Сначала пробуем очистить JSON от возможных проблем
        let cleanedJsonStr = cleanJSON(jsonStr);

        console.log('Длина после очистки:', cleanedJsonStr.length);

        // Если очищенная строка слишком короткая, возможно проблема
        if (cleanedJsonStr.length < 50) {
            console.warn('Очищенный JSON слишком короткий, используем альтернативный метод');
            cleanedJsonStr = extractJSONFromText(jsonStr);
        }

        // Парсим JSON
        let jsonObj;
        try {
            jsonObj = JSON.parse(cleanedJsonStr);
            console.log('JSON успешно спарсен');
        } catch (parseError) {
            console.error('Ошибка при парсинге JSON после очистки:', parseError.message);

            // Пробуем альтернативные методы
            jsonObj = tryAlternativeParsing(jsonStr);
        }

        // Исправляем символы в таблице
        if (jsonObj.table_data && Array.isArray(jsonObj.table_data)) {
            console.log('Применяем исправления символов...');
            jsonObj.table_data = fixTableSymbols(jsonObj.table_data);

            // Дополнительная проверка и исправление
            jsonObj.table_data = postProcessTableData(jsonObj.table_data);

            // Автоматическое исправление ассимиляции
            console.log('Автоматическое исправление ассимиляции...');
            jsonObj.table_data = forceFixAssimilationImproved(jsonObj.table_data);
        }

        // Показываем очищенный JSON
        elements.jsonOutput.textContent = JSON.stringify(jsonObj, null, 2);

        // Синтаксическая подсветка
        highlightJSON();

        // Отображаем таблицу, если есть данные
        console.log('JSON для таблицы:', jsonObj);
        if (jsonObj.table_data && Array.isArray(jsonObj.table_data) && jsonObj.table_data.length > 0) {
            console.log('Вызываем displayTable с данными:', jsonObj.table_data.length, 'строк');
            displayTable(jsonObj.table_data);

            elements.toggleViewBtn.disabled = false;
            elements.toggleViewBtn.setAttribute('data-view', 'json');
            elements.toggleViewBtn.innerHTML = '<i class="fas fa-table"></i> Показать таблицу';
        } else {
            console.warn('Нет данных table_data или массив пустой');
            elements.tableInfo.textContent = 'Нет табличных данных для отображения';
            elements.toggleViewBtn.disabled = true;
        }

        // Включаем кнопки
        elements.copyJsonBtn.disabled = false;
        elements.clearResultsBtn.disabled = false;
        elements.downloadBtn.disabled = false;

        // Сохраняем данные для скачивания
        jsonData = JSON.stringify(jsonObj);


    } catch (error) {
        console.error('Критическая ошибка при отображении JSON:', error);
        console.error('Исходный текст (первые 500 символов):', jsonStr.substring(0, 500));

        // Показываем исходный текст
        elements.jsonOutput.textContent = jsonStr;

        // Показываем сообщение об ошибке
        showJSONError(error, jsonStr);

        // Отключаем кнопки, связанные с таблицей
        elements.toggleViewBtn.disabled = true;
        elements.copyJsonBtn.disabled = true;
        elements.downloadBtn.disabled = false; // все равно можно скачать сырой текст
        updateExportButtons(); // <-- Добавьте эту строку
    }
}

function analyzeExtractedData(jsonStr, expectedColumns = 24) {
    try {
        const data = JSON.parse(jsonStr);
        const tableData = data.table_data || [];

        if (!tableData.length) {
            return { error: "Таблица пуста", columns_found: 0 };
        }

        // Собираем все уникальные колонки
        const allColumns = new Set();
        tableData.forEach(row => {
            Object.keys(row).forEach(key => allColumns.add(key));
        });

        // Убираем characteristic из подсчета колонок с данными
        const dataColumns = Array.from(allColumns).filter(col => col !== "characteristic");

        // Определяем числовые колонки
        const numericColumns = [];
        const nonNumericColumns = [];

        dataColumns.forEach(col => {
            // Проверяем, является ли колонка числовой (column_1, column_2, ...)
            if (col.startsWith("column_")) {
                try {
                    const num = parseInt(col.replace("column_", ""));
                    numericColumns.push({ col, num });
                } catch {
                    nonNumericColumns.push(col);
                }
            }
            // Или просто число "1", "2", ...
            else if (/^\d+$/.test(col)) {
                numericColumns.push({ col, num: parseInt(col) });
            } else {
                nonNumericColumns.push(col);
            }
        });

        // Сортируем числовые колонки
        numericColumns.sort((a, b) => a.num - b.num);
        const sortedColumns = ["characteristic", ...numericColumns.map(c => c.col), ...nonNumericColumns];

        return {
            total_rows: tableData.length,
            total_columns_found: dataColumns.length,
            expected_columns: expectedColumns,
            columns_missing: Math.max(0, expectedColumns - dataColumns.length),
            sorted_columns: sortedColumns,
            numeric_columns_count: numericColumns.length,
            non_numeric_columns: nonNumericColumns,
            sample_columns: dataColumns.slice(0, 10)
        };

    } catch (error) {
        console.error('Ошибка при анализе данных:', error);
        return { error: error.message, columns_found: 0 };
    }
}

function extractJSONFromText(text) {
    console.log('Извлечение JSON из текста');

    // Ищем JSON структуру
    const jsonPattern = /\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/gs;
    const matches = text.match(jsonPattern);

    if (matches && matches.length > 0) {
        // Берем самый длинный match (скорее всего это наш JSON)
        const longestMatch = matches.reduce((a, b) => a.length > b.length ? a : b);
        console.log('Найден JSON длиной:', longestMatch.length);
        return longestMatch;
    }

    // Если не нашли, создаем минимальный JSON
    return '{"table_data": []}';
}

function tryAlternativeParsing(jsonStr) {
    console.log('Пробуем альтернативные методы парсинга');

    // Метод 1: Пробуем найти и исправить конкретные ошибки
    let fixed = jsonStr;

    // Исправляем распространенные ошибки
    const fixes = [
        // Некорректные escape
        [/\\([^"\\\/bfnrtu])/g, ''],
        // Двойные обратные слеши
        [/\\\\/g, '\\'],
        // Незакрытые кавычки
        [/: ([^",\[\]\{\}\s][^,\]\}]*?)(?=\s*[,}\]])/g, ': "$1"'],
        // Ключи без кавычек
        [/(\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*):/g, '$1"$2"$3:']
    ];

    fixes.forEach(([pattern, replacement]) => {
        fixed = fixed.replace(pattern, replacement);
    });

    try {
        return JSON.parse(fixed);
    } catch (e) {
        console.warn('Альтернативный метод 1 не сработал:', e.message);
    }

    // Метод 2: Пробуем извлечь данные построчно
    try {
        const lines = jsonStr.split('\n');
        const tableData = [];
        let currentRow = null;

        for (const line of lines) {
            if (line.includes('"characteristic"')) {
                if (currentRow) {
                    tableData.push(currentRow);
                }
                currentRow = {};
                // Извлекаем characteristic
                const charMatch = line.match(/"characteristic"\s*:\s*"([^"]*)"/);
                if (charMatch) {
                    currentRow.characteristic = charMatch[1];
                }
            } else if (line.includes('"column_')) {
                // Извлекаем column данные
                const colMatch = line.match(/"column_(\d+)"\s*:\s*"([^"]*)"/);
                if (colMatch && currentRow) {
                    currentRow[`column_${colMatch[1]}`] = colMatch[2];
                }
            }
        }

        if (currentRow) {
            tableData.push(currentRow);
        }

        return { table_data: tableData };
    } catch (e) {
        console.warn('Альтернативный метод 2 не сработал:', e.message);
    }

    // Метод 3: Возвращаем пустые данные
    return { table_data: [] };
}

function showJSONError(error, jsonStr) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = `
        background-color: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
    `;

    // Создаем более информативное сообщение
    let errorDetails = error.message;

    // Пытаемся найти позицию ошибки
    const positionMatch = error.message.match(/position (\d+)/);
    if (positionMatch) {
        const position = parseInt(positionMatch[1]);
        errorDetails += `\n\nКонтекст ошибки:\n`;
        errorDetails += jsonStr.substring(Math.max(0, position - 50), Math.min(jsonStr.length, position + 50));
    }

    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="color: #dc2626; font-size: 24px;"></i>
        <div style="flex: 1;">
            <h4 style="color: #7c2d12; margin: 0 0 8px 0;">Ошибка при разборе JSON</h4>
            <p style="color: #7c2d12; margin: 0 0 4px 0;"><strong>Сообщение:</strong> ${error.message}</p>
            <p style="color: #7c2d12; margin: 0 0 4px 0;"><strong>Длина данных:</strong> ${jsonStr.length} символов</p>
            <div style="background: white; padding: 8px; border-radius: 4px; margin-top: 8px; font-family: monospace; font-size: 12px; max-height: 200px; overflow: auto;">
                <strong>Начало данных:</strong><br>
                ${jsonStr.substring(0, 200).replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </div>
            <button onclick="copyRawJSON()" style="margin-top: 8px; padding: 4px 8px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">
                <i class="fas fa-copy"></i> Скопировать сырые данные
            </button>
        </div>
    `;

    // Вставляем сообщение об ошибке перед JSON
    elements.jsonOutput.parentNode.insertBefore(errorDiv, elements.jsonOutput);
}

function copyRawJSON() {
    const jsonText = elements.jsonOutput.textContent;
    navigator.clipboard.writeText(jsonText)
        .then(() => {
            showNotification('Сырые данные скопированы в буфер', 'info');
        })
        .catch(err => {
            console.error('Ошибка при копировании:', err);
        });
}

function cleanJSON(jsonStr) {
    try {
        console.log('Очистка JSON...');
        console.log('Исходная длина:', jsonStr.length);
        console.log('Первые 500 символов:', jsonStr.substring(0, 500));

        // 1. Удаляем лишние пробелы и переносы в начале/конце
        let cleaned = jsonStr.trim();

        // 2. Удаляем маркдаун обрамление ```json ... ```
        if (cleaned.includes('```json')) {
            const start = cleaned.indexOf('```json') + 7;
            const end = cleaned.lastIndexOf('```');
            cleaned = cleaned.substring(start, end).trim();
        } else if (cleaned.includes('```')) {
            const start = cleaned.indexOf('```') + 3;
            const end = cleaned.lastIndexOf('```');
            cleaned = cleaned.substring(start, end).trim();
        }

        // 3. Ищем JSON объект или массив
        const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        }

        // 4. Специальная обработка для исправления некорректных escape-последовательностей
        cleaned = cleaned
            // Исправляем двойные обратные слэши
            .replace(/\\\\/g, '\\')
            // Исправляем некорректные escape-последовательности
            .replace(/\\([^"\\\/bfnrtu])/g, '$1')
            // Заменяем некорректные кавычки
            .replace(/[``'']/g, '"')
            // Убираем управляющие символы кроме табуляции и переноса строки
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            // Убираем BOM (Byte Order Mark)
            .replace(/^\uFEFF/, '');

        // 5. Исправляем отсутствующие кавычки в ключах
        cleaned = cleaned.replace(/(\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*):/g, '$1"$2"$3:');

        // 6. Убираем лишние запятые в конце объектов и массивов
        cleaned = cleaned
            .replace(/,\s*}/g, '}')
            .replace(/,\s*\]/g, ']');

        // 7. Исправляем незакрытые строки
        cleaned = cleaned.replace(/:\s*([^"\[\]\{\}\d,\s][^,\]\}]*?)(?=\s*[,}\]])/g, ': "$1"');

        // 8. Исправляем распространенные ошибки формата
        let fixed = '';
        let inString = false;
        let escapeNext = false;

        for (let i = 0; i < cleaned.length; i++) {
            const char = cleaned[i];
            const nextChar = cleaned[i + 1] || '';

            if (escapeNext) {
                // Если предыдущий символ был \, добавляем текущий как есть
                fixed += char;
                escapeNext = false;
            } else if (char === '\\') {
                // Начинаем escape-последовательность
                if (nextChar === 'u') {
                    // Unicode escape - проверяем формат \uXXXX
                    if (cleaned.substring(i + 2, i + 6).match(/[0-9a-fA-F]{4}/)) {
                        fixed += cleaned.substring(i, i + 6);
                        i += 5;
                    } else {
                        // Некорректный Unicode escape - заменяем на пустую строку
                        fixed += '';
                        i += 5;
                    }
                } else if ('"\\/bfnrt'.includes(nextChar)) {
                    // Корректный escape символ
                    fixed += char;
                    escapeNext = true;
                } else {
                    // Некорректный escape - пропускаем \
                    fixed += '';
                }
            } else if (char === '"') {
                inString = !inString;
                fixed += char;
            } else if (!inString && char === "'") {
                // Заменяем одинарные кавычки на двойные вне строк
                fixed += '"';
            } else if (char === '\n' && inString) {
                // Убираем переносы строк внутри строк
                fixed += ' ';
            } else {
                fixed += char;
            }
        }

        cleaned = fixed;

        // 9. Проверяем сбалансированность скобок
        const stack = [];
        for (let i = 0; i < cleaned.length; i++) {
            const char = cleaned[i];
            if (char === '{' || char === '[') {
                stack.push(char);
            } else if (char === '}') {
                if (stack.pop() !== '{') {
                    console.warn('Несбалансированная }');
                    // Добавляем недостающую {
                    cleaned = '{' + cleaned;
                }
            } else if (char === ']') {
                if (stack.pop() !== '[') {
                    console.warn('Несбалансированная ]');
                    // Добавляем недостающую [
                    cleaned = '[' + cleaned;
                }
            }
        }

        // Добавляем недостающие закрывающие скобки
        while (stack.length > 0) {
            const open = stack.pop();
            cleaned += open === '{' ? '}' : ']';
        }

        console.log('Очищенная длина:', cleaned.length);
        console.log('Первые 500 символов очищенного:', cleaned.substring(0, 500));

        // 10. Пробуем спарсить
        try {
            const parsed = JSON.parse(cleaned);
            console.log('JSON успешно спарсен');
            return cleaned;
        } catch (parseError) {
            console.warn('Ошибка парсинга после очистки:', parseError.message);

            // Попробуем более агрессивную очистку
            return cleanJSONAggressive(jsonStr);
        }

    } catch (error) {
        console.warn('Не удалось очистить JSON, возвращаем исходный с обработкой:', error.message);
        return cleanJSONAggressive(jsonStr);
    }
}

function cleanJSONAggressive(jsonStr) {
    console.log('Применяем агрессивную очистку JSON');

    try {
        // 1. Находим первый { и последний }
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1) {
            throw new Error('Не найдены фигурные скобки');
        }

        let cleaned = jsonStr.substring(firstBrace, lastBrace + 1);

        // 2. Убираем все сложные escape-последовательности
        cleaned = cleaned
            .replace(/\\\\/g, '\\')
            .replace(/\\"/g, '"')
            .replace(/\\([^"\\\/bfnrtu])/g, '')
            .replace(/\\u[0-9a-fA-F]{4}/g, match => {
                try {
                    return JSON.parse(`"${match}"`);
                } catch {
                    return '';
                }
            });

        // 3. Заменяем все нестандартные кавычки
        cleaned = cleaned
            .replace(/[`'']/g, '"')
            .replace(/„|"|«|»/g, '"');

        // 4. Убираем управляющие символы
        cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

        // 5. Исправляем ключи без кавычек (ограниченный набор)
        cleaned = cleaned.replace(/"table_data":/g, '"table_data":');
        cleaned = cleaned.replace(/"characteristic":/g, '"characteristic":');

        // Ищем и исправляем ключи column_X
        for (let i = 1; i <= 30; i++) {
            const pattern1 = new RegExp(`column_${i}(\\s*):`, 'g');
            const pattern2 = new RegExp(`"column_${i}"(\\s*):`, 'g');

            cleaned = cleaned.replace(pattern1, `"column_${i}"$1:`);

            // Убедимся, что кавычки правильные
            if (!pattern2.test(cleaned)) {
                // Добавляем кавычки, если их нет
                const missingPattern = new RegExp(`column_${i}(\\s*):`, 'g');
                cleaned = cleaned.replace(missingPattern, `"column_${i}"$1:`);
            }
        }

        // 6. Убираем лишние запятые
        cleaned = cleaned
            .replace(/,\s*}/g, '}')
            .replace(/,\s*\]/g, ']');

        // 7. Убираем лишние двоеточия
        cleaned = cleaned.replace(/::/g, ':');

        // 8. Добавляем финальную проверку структуры
        // Проверяем, что это похоже на наш ожидаемый формат
        if (!cleaned.includes('"table_data"') || !cleaned.includes('"characteristic"')) {
            throw new Error('Не найден ожидаемый формат данных');
        }

        console.log('Агрессивно очищенный JSON (первые 300 символов):', cleaned.substring(0, 300));

        return cleaned;

    } catch (error) {
        console.error('Агрессивная очистка не удалась:', error.message);

        // Возвращаем минимальный валидный JSON
        return '{"table_data": []}';
    }
}

function highlightJSON() {
    const text = elements.jsonOutput.textContent;
    let highlighted = text
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        function(match) {
            let cls = 'json-value';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'json-key';
                } else {
                    cls = 'json-string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'json-boolean';
            } else if (/null/.test(match)) {
                cls = 'json-null';
            } else if (/^-?\d/.test(match)) {
                cls = 'json-number';
            }
            return `<span class="${cls}">${match}</span>`;
        });

    elements.jsonOutput.innerHTML = highlighted;
}

function displayTable(tableData) {
    if (!tableData || !Array.isArray(tableData)) {
        console.warn('Нет данных для отображения таблицы:', tableData);
        elements.tableInfo.textContent = 'Нет данных для отображения';
        return;
    }

    // Очищаем таблицу
    elements.tableHeader.innerHTML = '';
    elements.tableBody.innerHTML = '';

    console.log('Всего строк в данных:', tableData.length);
    console.log('Первые 5 строк:', tableData.slice(0, 5));

    // ОПРЕДЕЛЯЕМ КОЛОНКИ ИЗ ДАННЫХ
    const keysFromData = new Set();

    // Собираем ВСЕ ключи из всех строк
    tableData.forEach(row => {
        if (row && typeof row === 'object') {
            Object.keys(row).forEach(key => {
                if (key !== 'characteristic') {
                    keysFromData.add(key);
                }
            });
        }
    });

    // Сортируем колонки по номеру
    const sortedKeys = Array.from(keysFromData).sort((a, b) => {
        const numA = parseInt(a.replace('column_', '')) || 0;
        const numB = parseInt(b.replace('column_', '')) || 0;
        return numA - numB;
    });

        // Добавляем обработчики для выбора строк и колонок
    setupTableSelection();

    console.log('Найдено колонок:', sortedKeys.length);
    console.log('Колонки:', sortedKeys);

    // Если нет колонок, создаем заглушку
    if (sortedKeys.length === 0) {
        console.warn('Нет колонок для отображения в таблице');
        elements.tableInfo.textContent = 'Нет колонок для отображения';
        return;
    }

    // Создаем заголовки
    const headerRow = document.createElement('tr');

    // Первый заголовок - характеристика
    const thChar = document.createElement('th');
    thChar.textContent = 'Characteristic';
    thChar.style.backgroundColor = '#2c3e50';
    thChar.style.color = 'white';
    thChar.style.position = 'sticky';
    thChar.style.left = '0';
    thChar.style.zIndex = '3';
    thChar.style.minWidth = '250px'; // Широкая колонка для длинных названий
    headerRow.appendChild(thChar);

    // Создаем заголовки для всех колонок
    sortedKeys.forEach(key => {
        const th = document.createElement('th');
        // Создаем короткое имя для колонки
        const colNum = key.replace('column_', '');
        th.textContent = `Col ${colNum}`;
        th.title = key; // Полное имя в tooltip
        th.style.backgroundColor = '#2c3e50';
        th.style.color = 'white';
        th.style.zIndex = '2';
        th.style.minWidth = '100px';
        th.style.textAlign = 'center';
        headerRow.appendChild(th);
    });

    elements.tableHeader.appendChild(headerRow);

    setTimeout(() => {
        try {
            if (typeof addTableControls === 'function') {
                addTableControls();
            } else {
                console.error('addTableControls не определена, пропускаем');
            }

            if (typeof updateRowCounter === 'function') updateRowCounter();
            if (typeof updateColumnCounter === 'function') updateColumnCounter();

        } catch (error) {
            console.error('Ошибка при добавлении контролов таблицы:', error);
        }
    }, 100);

    // Заполняем таблицу данными - ПОКАЗЫВАЕМ ВСЕ СТРОКИ
    let rowCount = 0;
    let displayedRows = 0;

     tableData.forEach((row, index) => {
        // Проверяем, есть ли строка
        if (!row || typeof row !== 'object') {
            console.log(`Пропускаем строку ${index}: нет данных или не объект`, row);
            return;
        }

        const tr = document.createElement('tr');
        rowCount++;

        // Чередуем цвета строк для лучшей читаемости
        if (index % 2 === 0) {
            tr.style.backgroundColor = '#f8f9fa';
        }

        // Ячейка с характеристикой (закрепленная слева)
        const tdChar = document.createElement('td');
        const characteristic = row.characteristic || `Row ${index + 1}`;
        tdChar.textContent = characteristic;
        tdChar.style.fontWeight = '600';
        tdChar.style.position = 'sticky';
        tdChar.style.left = '0';
        tdChar.style.backgroundColor = index % 2 === 0 ? '#f8f9fa' : 'white';
        tdChar.style.zIndex = '1';
        tdChar.style.borderRight = '2px solid #e2e8f0';
        tdChar.style.minWidth = '250px';
        tdChar.style.maxWidth = '300px';
        tdChar.style.whiteSpace = 'normal'; // Разрешаем перенос текста
        tdChar.style.wordBreak = 'break-word';
        tr.appendChild(tdChar);

        // Ячейки с значениями колонок
        sortedKeys.forEach(key => {
            const td = document.createElement('td');
            const value = row[key] !== undefined ? String(row[key]) : '';

            // Применяем стили к ячейке
            applyCellStyles(td, value);

            tr.appendChild(td);
        });

        elements.tableBody.appendChild(tr);
        displayedRows++;
    });

    // Добавляем легенду
    addTableLegend(0);

    // Добавляем кнопки управления
    addTableControls();

    // Добавляем информацию о данных
    console.log(`Отображено ${displayedRows} из ${tableData.length} строк`);

    // Если отображено не все строки, показываем предупреждение
        if (displayedRows < tableData.length) {
            console.warn(`Пропущено ${tableData.length - displayedRows} строк!`);
            showNotification(`Показано ${displayedRows} из ${tableData.length} строк. Некоторые строки пропущены из-за некорректных данных.`, 'warning');
        }
}

function setupTableSelection() {
    // Выбор строк (по клику на характеристику)
    const firstCells = document.querySelectorAll('#tableBody td:first-child');
    firstCells.forEach(cell => {
        cell.addEventListener('click', function(e) {
            e.stopPropagation();
            const row = this.parentElement;
            row.classList.toggle('selected');
        });
    });

    // Выбор колонок (по клику на заголовок)
    const headerCells = document.querySelectorAll('#tableHeader th');
    headerCells.forEach(th => {
        th.addEventListener('click', function(e) {
            e.stopPropagation();
            if (this.textContent !== 'Characteristic') {
                this.classList.toggle('selected');
            }
        });
    });
}

function addTableControls() {
    console.log('Добавление контролов управления таблицей');

    const oldControls = document.getElementById('tableControls');
    if (oldControls) oldControls.remove();

    const controls = document.createElement('div');
    controls.id = 'tableControls';
    controls.style.cssText = `
        padding: 12px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
        position: sticky;
        top: 0;
        z-index: 20;
    `;

    controls.innerHTML = `
        <div class="control-group">
            <span style="font-weight: 600; color: #4b5563; font-size: 0.9rem;">
                <i class="fas fa-columns"></i> Колонки:
            </span>
            <button class="btn btn-small btn-outline" id="showAllColumnsBtn" title="Показать все колонки">
                <i class="fas fa-expand"></i> Все
            </button>
            <button class="btn btn-small btn-outline" id="showDataColumnsBtn" title="Показать только колонки с данными">
                <i class="fas fa-compress"></i> С данными
            </button>
            <button class="btn btn-small btn-outline" id="toggleEmptyColumnsBtn" title="Скрыть/показать пустые колонки">
                <i class="fas fa-eye-slash"></i> Пустые
            </button>
            <button class="btn btn-small btn-danger" id="deleteEmptyColumnsBtn" title="Удалить пустые колонки">
                <i class="fas fa-trash"></i> Удалить пустые
            </button>
        </div>
        
        <div class="control-group">
            <span style="font-weight: 600; color: #4b5563; font-size: 0.9rem;">
                <i class="fas fa-bars"></i> Строки:
            </span>
            <button class="btn btn-small btn-outline" id="showAllRowsBtn" title="Показать все строки">
                <i class="fas fa-expand"></i> Все
            </button>
            <button class="btn btn-small btn-outline" id="showDataRowsBtn" title="Показать только строки с данными">
                <i class="fas fa-compress"></i> С данными
            </button>
            <button class="btn btn-small btn-outline" id="toggleEmptyRowsBtn" title="Скрыть/показать пустые строки">
                <i class="fas fa-eye-slash"></i> Пустые
            </button>
            <button class="btn btn-small btn-danger" id="deleteEmptyRowsBtn" title="Удалить пустые строки">
                <i class="fas fa-trash"></i> Удалить пустые
            </button>
        </div>
        
        <div style="margin-left: auto; display: flex; gap: 15px; color: #6b7280; font-size: 0.85rem;">
            <span id="rowCounter">
                <i class="fas fa-bars"></i> Строк: <span id="visibleRowsCount">...</span>
            </span>
            <span id="columnCounter">
                <i class="fas fa-columns"></i> Колонок: <span id="visibleColumnsCount">...</span>
            </span>
        </div>
    `;

    const tableWrapper = document.querySelector('.table-wrapper');
    if (tableWrapper) {
        tableWrapper.parentNode.insertBefore(controls, tableWrapper);

        setTimeout(() => {
            try {
                setupTableControls();
                updateRowCounter();
                updateColumnCounter();
            } catch (error) {
                console.error('Ошибка при настройке контролов таблицы:', error);
            }
        }, 100);
    }
}

function setupFallbackHandlers() {
    console.log('Использование фолбэк обработчиков');

    const handlers = {
        'showAllColumns': showAllColumns,
        'showDataColumns': showDataColumns,
        'toggleEmptyColumns': toggleEmptyColumns,
        'showAllRows': showAllRows,
        'showDataRows': showDataRows,
        'toggleEmptyRows': toggleEmptyRows,
        'deleteEmptyRows': deleteEmptyRows
    };

    // Простой подход через onclick
    Object.entries(handlers).forEach(([name, handler]) => {
        const button = document.querySelector(`[onclick*="${name}"]`);
        if (button && !button.hasAttribute('data-handler-set')) {
            button.setAttribute('data-handler-set', 'true');
            button.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                safeClick(handler);
            };
        }
    });
}

function updateColumnCounter() {
    const counter = document.getElementById('visibleColumnsCount');
    if (counter) {
        const totalColumns = document.querySelectorAll('#tableHeader th').length - 1; // -1 для characteristic
        const visibleCount = countVisibleColumns();
        counter.textContent = `${visibleCount}/${totalColumns}`;
    }
}


let isProcessingClick = false;
const CLICK_DELAY = 300;

function safeClick(callback, delay = CLICK_DELAY) {
    if (isProcessingClick) {
        console.log('Клик проигнорирован - обработка предыдущего клика еще идет');
        return;
    }

    isProcessingClick = true;

    try {
        callback();
    } catch (error) {
        console.error('Ошибка при обработке клика:', error);
        isProcessingClick = false;
        throw error;
    }

    setTimeout(() => {
        isProcessingClick = false;
    }, delay);
}

function showAllColumns() {
    const table = document.getElementById('dataTable');
    if (!table) return;

    const headers = table.querySelectorAll('#tableHeader th');
    const rows = table.querySelectorAll('#tableBody tr');

    headers.forEach(header => header.style.display = '');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach(cell => cell.style.display = '');
    });

    showNotification('Показаны все колонки', 'info');
    updateColumnCounter();
}

function showDataColumns() {
    const table = document.getElementById('dataTable');
    if (!table) return;

    const headers = table.querySelectorAll('#tableHeader th');
    const rows = table.querySelectorAll('#tableBody tr');

    if (rows.length === 0) {
        showNotification('Нет данных в таблице', 'warning');
        return;
    }

    const columnHasData = new Array(headers.length).fill(false);
    columnHasData[0] = true;

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, cellIndex) => {
            const value = cell.textContent.trim();
            if (value && value !== '—' && value !== '') {
                columnHasData[cellIndex] = true;
            }
        });
    });

    headers.forEach((header, index) => {
        header.style.display = columnHasData[index] ? '' : 'none';
    });

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, index) => {
            cell.style.display = columnHasData[index] ? '' : 'none';
        });
    });

    const visibleCount = columnHasData.filter(Boolean).length - 1;
    showNotification(`Показано ${visibleCount} колонок с данными`, 'info');
    updateColumnCounter();
}

function toggleEmptyColumns() {
    const table = document.getElementById('dataTable');
    if (!table) return;

    const headers = table.querySelectorAll('#tableHeader th');
    const rows = table.querySelectorAll('#tableBody tr');

    if (rows.length === 0) {
        showNotification('Нет данных в таблице', 'warning');
        return;
    }

    // Определяем, какие колонки полностью пустые
    const columnIsEmpty = new Array(headers.length).fill(true);
    columnIsEmpty[0] = false; // Первая колонка никогда не пустая

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, cellIndex) => {
            const value = cell.textContent.trim();
            if (value && value !== '—' && value !== '') {
                columnIsEmpty[cellIndex] = false;
            }
        });
    });

    // Проверяем текущее состояние - скрыты ли пустые колонки
    const firstEmptyHeader = headers[1]; // Проверяем вторую колонку
    const isEmptyHidden = firstEmptyHeader && columnIsEmpty[1] && firstEmptyHeader.style.display === 'none';

    // Переключаем состояние
    headers.forEach((header, index) => {
        if (index === 0) return; // characteristic не трогаем

        if (columnIsEmpty[index]) {
            if (isEmptyHidden) {
                // Если скрыты - показываем
                header.style.display = '';
            } else {
                // Если показаны - скрываем
                header.style.display = 'none';
            }
        }
    });

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, index) => {
            if (index === 0) return; // characteristic не трогаем

            if (columnIsEmpty[index]) {
                if (isEmptyHidden) {
                    cell.style.display = '';
                } else {
                    cell.style.display = 'none';
                }
            }
        });
    });

    const emptyCount = columnIsEmpty.filter((empty, idx) => empty && idx > 0).length;
    const action = isEmptyHidden ? 'показаны' : 'скрыты';

    console.log(`${emptyCount} пустых колонок ${action}`);
    showNotification(`${emptyCount} пустых колонок ${action}`, 'info');
    updateColumnCounter();
}

function showAllRows() {
    const rows = document.querySelectorAll('#tableBody tr');
    rows.forEach(row => row.style.display = '');
    showNotification('Показаны все строки', 'info');
    updateRowCounter();
}

function showDataRows() {
    const rows = document.querySelectorAll('#tableBody tr');
    if (rows.length === 0) {
        showNotification('Нет строк в таблице', 'warning');
        return;
    }

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let hasData = false;
        for (let i = 1; i < cells.length; i++) {
            const value = cells[i].textContent.trim();
            if (value && value !== '—' && value !== '') {
                hasData = true;
                break;
            }
        }
        row.style.display = hasData ? '' : 'none';
    });

    const visibleCount = Array.from(rows).filter(row => row.style.display !== 'none').length;
    showNotification(`Показано ${visibleCount} строк с данными`, 'info');
    updateRowCounter();
}

function toggleEmptyRows() {
    const rows = document.querySelectorAll('#tableBody tr');
    if (rows.length === 0) {
        showNotification('Нет строк в таблице', 'warning');
        return;
    }

    const emptyRows = [];
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        let isEmpty = true;
        for (let i = 1; i < cells.length; i++) {
            const value = cells[i].textContent.trim();
            if (value && value !== '—' && value !== '') {
                isEmpty = false;
                break;
            }
        }
        if (isEmpty) emptyRows.push(row);
    });

    if (emptyRows.length === 0) {
        showNotification('Нет пустых строк', 'info');
        return;
    }

    const firstEmptyRow = emptyRows[0];
    const isEmptyHidden = firstEmptyRow && firstEmptyRow.style.display === 'none';

    emptyRows.forEach(row => {
        row.style.display = isEmptyHidden ? '' : 'none';
    });

    const action = isEmptyHidden ? 'показаны' : 'скрыты';
    showNotification(`${emptyRows.length} пустых строк ${action}`, 'info');
    updateRowCounter();
}

function deleteEmptyRows() {
    const rows = document.querySelectorAll('#tableBody tr');
    if (rows.length === 0) {
        showNotification('Нет строк в таблице', 'warning');
        return;
    }

    const emptyRowIndices = [];
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        let isEmpty = true;
        for (let i = 1; i < cells.length; i++) {
            const value = cells[i].textContent.trim();
            if (value && value !== '—' && value !== '') {
                isEmpty = false;
                break;
            }
        }
        if (isEmpty) emptyRowIndices.push(index);
    });

    if (emptyRowIndices.length === 0) {
        showNotification('Нет пустых строк для удаления', 'info');
        return;
    }

    if (!confirm(`Удалить ${emptyRowIndices.length} пустых строк? Это действие нельзя отменить!`)) {
        return;
    }

    try {
        const jsonText = elements.jsonOutput.textContent;
        const data = JSON.parse(jsonText);
        if (!data.table_data || !Array.isArray(data.table_data)) {
            throw new Error('Нет табличных данных');
        }

        emptyRowIndices.sort((a, b) => b - a).forEach(index => {
            data.table_data.splice(index, 1);
        });

        elements.jsonOutput.textContent = JSON.stringify(data, null, 2);
        highlightJSON();

        if (elements.tableView.style.display === 'block') {
            displayTable(data.table_data);
        }

        jsonData = JSON.stringify(data);
        showNotification(`Удалено ${emptyRowIndices.length} пустых строк`, 'success');
    } catch (error) {
        console.error('Ошибка при удалении пустых строк:', error);
        showNotification('Ошибка при удалении пустых строк', 'error');
    }
}

function countVisibleRows() {
    const rows = document.querySelectorAll('#tableBody tr');
    let visibleCount = 0;

    rows.forEach(row => {
        if (row.style.display !== 'none') {
            visibleCount++;
        }
    });

    return visibleCount;
}

function updateRowCounter() {
    const counter = document.getElementById('visibleRowsCount');
    if (counter) {
        const totalRows = document.querySelectorAll('#tableBody tr').length;
        const visibleCount = countVisibleRows();
        counter.textContent = `${visibleCount}/${totalRows}`;
    }
}

function countVisibleColumns() {
    const headers = document.querySelectorAll('#tableHeader th');
    let visibleCount = 0;

    headers.forEach(header => {
        if (header.style.display !== 'none') {
            visibleCount++;
        }
    });

    return visibleCount - 1; // Минус characteristic
}

function updateColumnCounter() {
    const counter = document.getElementById('visibleColumnsCount');
    if (counter) {
        const totalColumns = document.querySelectorAll('#tableHeader th').length - 1; // -1 для characteristic
        const visibleCount = countVisibleColumns();
        counter.textContent = `${visibleCount}/${totalColumns}`;
    }
}

function setupFallbackHandlers() {
    console.log('Использование фолбэк обработчиков');

    const handlers = {
        'showAllColumns': showAllColumns,
        'showDataColumns': showDataColumns,
        'toggleEmptyColumns': toggleEmptyColumns,
        'showAllRows': showAllRows,
        'showDataRows': showDataRows,
        'toggleEmptyRows': toggleEmptyRows,
        'deleteEmptyRows': deleteEmptyRows
    };

    // Простой подход через onclick
    Object.entries(handlers).forEach(([name, handler]) => {
        const button = document.querySelector(`[onclick*="${name}"]`);
        if (button && !button.hasAttribute('data-handler-set')) {
            button.setAttribute('data-handler-set', 'true');
            button.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                try {
                    handler();
                } catch (error) {
                    console.error(`Ошибка в обработчике ${name}:`, error);
                    showNotification(`Ошибка: ${error.message}`, 'error');
                }
            };
        }
    });
}

function deleteEmptyRows() {
    const rows = document.querySelectorAll('#tableBody tr');

    if (rows.length === 0) {
        showNotification('Нет строк в таблице', 'warning');
        return;
    }

    // Находим пустые строки
    const emptyRowIndices = [];
    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        let isEmpty = true;

        // Проверяем ячейки (начиная со второй)
        for (let i = 1; i < cells.length; i++) {
            const value = cells[i].textContent.trim();
            if (value && value !== '—' && value !== '') {
                isEmpty = false;
                break;
            }
        }

        if (isEmpty) {
            emptyRowIndices.push(index);
        }
    });

    if (emptyRowIndices.length === 0) {
        showNotification('Нет пустых строк для удаления', 'info');
        return;
    }

    // Подтверждение удаления
    if (!confirm(`Удалить ${emptyRowIndices.length} пустых строк? Это действие нельзя отменить!`)) {
        return;
    }

    try {
        // Получаем текущие данные
        const jsonText = elements.jsonOutput.textContent;
        const data = JSON.parse(jsonText);

        if (!data.table_data || !Array.isArray(data.table_data)) {
            throw new Error('Нет табличных данных');
        }

        // Удаляем строки из данных (в обратном порядке)
        emptyRowIndices.sort((a, b) => b - a).forEach(index => {
            data.table_data.splice(index, 1);
        });

        // Обновляем JSON
        elements.jsonOutput.textContent = JSON.stringify(data, null, 2);
        highlightJSON();

        // Обновляем таблицу
        if (elements.tableView.style.display === 'block') {
            displayTable(data.table_data);
        }

        // Обновляем глобальные данные
        jsonData = JSON.stringify(data);

        console.log(`Удалено ${emptyRowIndices.length} пустых строк`);
        showNotification(`Удалено ${emptyRowIndices.length} пустых строк`, 'success');

    } catch (error) {
        console.error('Ошибка при удалении пустых строк:', error);
        showNotification('Ошибка при удалении пустых строк', 'error');
    }
}

function countVisibleRows() {
    const rows = document.querySelectorAll('#tableBody tr');
    let visibleCount = 0;

    rows.forEach(row => {
        if (row.style.display !== 'none') {
            visibleCount++;
        }
    });

    return visibleCount;
}

function updateRowCounter() {
    const counter = document.getElementById('visibleRowsCount');
    if (counter) {
        const totalRows = document.querySelectorAll('#tableBody tr').length;
        const visibleCount = document.querySelectorAll('#tableBody tr').length -
                           document.querySelectorAll('#tableBody tr[style*="display: none"]').length;
        counter.textContent = `${visibleCount}/${totalRows}`;
    }
}

function updateColumnCounter() {
    const counter = document.getElementById('visibleColumnsCount');
    if (counter) {
        const totalColumns = document.querySelectorAll('#tableHeader th').length - 1;
        const visibleCount = document.querySelectorAll('#tableHeader th').length - 1 -
                           document.querySelectorAll('#tableHeader th[style*="display: none"]').length;
        counter.textContent = `${visibleCount}/${totalColumns}`;
    }
}


function countVisibleColumns() {
    const headers = document.querySelectorAll('#tableHeader th');
    let visibleCount = 0;

    headers.forEach(header => {
        if (header.style.display !== 'none') {
            visibleCount++;
        }
    });

    return visibleCount - 1; // Минус characteristic
}

function updateColumnCounter() {
    const counter = document.getElementById('visibleColumnsCount');
    if (counter) {
        const totalColumns = document.querySelectorAll('#tableHeader th').length - 1; // -1 для characteristic
        const visibleCount = countVisibleColumns();
        counter.textContent = `${visibleCount}/${totalColumns}`;
    }
}

function setupFallbackHandlers() {
    console.log('Использование фолбэк обработчиков');

    const handlers = {
        'showAllColumns': showAllColumns,
        'showDataColumns': showDataColumns,
        'toggleEmptyColumns': toggleEmptyColumns,
        'showAllRows': showAllRows,
        'showDataRows': showDataRows,
        'toggleEmptyRows': toggleEmptyRows,
        'deleteEmptyRows': deleteEmptyRows
    };

    // Простой подход через onclick
    Object.entries(handlers).forEach(([name, handler]) => {
        const button = document.querySelector(`[onclick*="${name}"]`);
        if (button && !button.hasAttribute('data-handler-set')) {
            button.setAttribute('data-handler-set', 'true');
            button.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                try {
                    handler();
                } catch (error) {
                    console.error(`Ошибка в обработчике ${name}:`, error);
                    showNotification(`Ошибка: ${error.message}`, 'error');
                }
            };
        }
    });
}

function showDataColumns() {
    const table = document.getElementById('dataTable');
    const headers = table.querySelectorAll('#tableHeader th');
    const rows = table.querySelectorAll('#tableBody tr');

    if (rows.length === 0) {
        showNotification('Нет данных в таблице', 'warning');
        return;
    }

    // Определяем, какие колонки имеют данные
    const columnHasData = new Array(headers.length).fill(false);
    columnHasData[0] = true; // Первая колонка (characteristic) всегда показываем

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, cellIndex) => {
            const value = cell.textContent.trim();
            if (value && value !== '—' && value !== '') {
                columnHasData[cellIndex] = true;
            }
        });
    });

    // Показываем/скрываем колонки
    headers.forEach((header, index) => {
        if (columnHasData[index]) {
            header.style.display = '';
        } else {
            header.style.display = 'none';
        }
    });

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, index) => {
            if (columnHasData[index]) {
                cell.style.display = '';
            } else {
                cell.style.display = 'none';
            }
        });
    });

    const visibleCount = columnHasData.filter(Boolean).length - 1; // -1 для characteristic
    console.log(`Показано ${visibleCount} колонок с данными`);
    showNotification(`Показано ${visibleCount} колонок с данными`, 'info');
}

function toggleEmptyColumns() {
    const table = document.getElementById('dataTable');
    if (!table) return;

    const headers = table.querySelectorAll('#tableHeader th');
    const rows = table.querySelectorAll('#tableBody tr');

    if (rows.length === 0) {
        showNotification('Нет данных в таблице', 'warning');
        return;
    }

    const columnIsEmpty = new Array(headers.length).fill(true);
    columnIsEmpty[0] = false;

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, cellIndex) => {
            const value = cell.textContent.trim();
            if (value && value !== '—' && value !== '') {
                columnIsEmpty[cellIndex] = false;
            }
        });
    });

    const firstEmptyHeader = headers[1];
    const isEmptyHidden = firstEmptyHeader && columnIsEmpty[1] && firstEmptyHeader.style.display === 'none';

    headers.forEach((header, index) => {
        if (index === 0) return;
        if (columnIsEmpty[index]) {
            header.style.display = isEmptyHidden ? '' : 'none';
        }
    });

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells.forEach((cell, index) => {
            if (index === 0) return;
            if (columnIsEmpty[index]) {
                cell.style.display = isEmptyHidden ? '' : 'none';
            }
        });
    });

    const emptyCount = columnIsEmpty.filter((empty, idx) => empty && idx > 0).length;
    const action = isEmptyHidden ? 'показаны' : 'скрыты';
    showNotification(`${emptyCount} пустых колонок ${action}`, 'info');
    updateColumnCounter();
}

function countVisibleColumns() {
    const headers = document.querySelectorAll('#tableHeader th');
    let visibleCount = 0;

    headers.forEach(header => {
        if (header.style.display !== 'none') {
            visibleCount++;
        }
    });

    return visibleCount - 1; // Минус characteristic
}

function showNotification(message, type = 'info') {
    let container = document.getElementById('notificationContainer');
    if (!container) {
        // Создаем контейнер, если его нет
        const newContainer = document.createElement('div');
        newContainer.id = 'notificationContainer';
        newContainer.className = 'notification-container';
        document.body.appendChild(newContainer);
        container = newContainer;
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(notification);

    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

const notificationStyle = document.createElement('style');
notificationStyle.textContent = `
    .notification-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .notification {
        background: white;
        border-radius: 8px;
        padding: 15px 20px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 300px;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
        border-left: 4px solid #3498db;
    }
    
    .notification.success {
        border-left-color: #10b981;
    }
    
    .notification.error {
        border-left-color: #ef4444;
    }
    
    .notification.warning {
        border-left-color: #f59e0b;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
    }
    
    .notification-content i {
        font-size: 20px;
    }
    
    .notification.success .notification-content i {
        color: #10b981;
    }
    
    .notification.error .notification-content i {
        color: #ef4444;
    }
    
    .notification.warning .notification-content i {
        color: #f59e0b;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: #6b7280;
        cursor: pointer;
        padding: 5px;
        margin-left: 10px;
    }
    
    .notification-close:hover {
        color: #374151;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(notificationStyle);

function debugSpecificRows() {
    try {
        const jsonText = elements.jsonOutput.textContent;
        const data = JSON.parse(jsonText);

        if (!data.table_data || !Array.isArray(data.table_data)) {
            alert('Нет табличных данных');
            return;
        }

        console.log('=== ОТЛАДКА КОНКРЕТНЫХ СТРОК ===');

        // Показываем все строки
        data.table_data.forEach((row, index) => {
            console.log(`\n=== Строка ${index} ===`);
            console.log('Тип:', typeof row);
            console.log('Данные:', row);

            if (row && typeof row === 'object') {
                console.log('Ключи:', Object.keys(row));
                console.log('characteristic:', row.characteristic || '(пусто)');

                // Показываем первые 5 колонок
                const columns = Object.keys(row).filter(key => key.startsWith('column_')).sort();
                columns.slice(0, 5).forEach(key => {
                    console.log(`  ${key}: "${row[key]}"`);
                });

                if (columns.length > 5) {
                    console.log(`  ... и ещё ${columns.length - 5} колонок`);
                }
            }
        });

        alert(`Проанализировано ${data.table_data.length} строк. Смотрите консоль (F12) для деталей.`);

    } catch (error) {
        console.error('Ошибка при отладке строк:', error);
        alert('Ошибка: ' + error.message);
    }
}

function analyzeTableData(tableData) {
    console.log('=== АНАЛИЗ ДАННЫХ ТАБЛИЦЫ ===');
    console.log('Всего строк в массиве:', tableData.length);

    let validRows = 0;
    let emptyRows = 0;
    let invalidRows = 0;

    tableData.forEach((row, index) => {
        if (!row) {
            console.log(`Строка ${index}: null или undefined`);
            invalidRows++;
            return;
        }

        if (typeof row !== 'object') {
            console.log(`Строка ${index}: не объект (${typeof row})`, row);
            invalidRows++;
            return;
        }

        // Проверяем, есть ли характеристика
        if (!row.characteristic) {
            console.log(`Строка ${index}: нет characteristic`, row);
            emptyRows++;
        } else {
            validRows++;

            // Подсчитываем колонки с данными
            const dataColumns = Object.keys(row).filter(key =>
                key !== 'characteristic' && row[key] !== undefined && row[key] !== ''
            ).length;

            console.log(`Строка ${index}: "${row.characteristic.substring(0, 30)}...", колонок с данными: ${dataColumns}`);
        }
    });

    console.log(`Итоги анализа:`);
    console.log(`- Всего строк: ${tableData.length}`);
    console.log(`- Валидных строк: ${validRows}`);
    console.log(`- Пустых строк: ${emptyRows}`);
    console.log(`- Некорректных строк: ${invalidRows}`);

    return { validRows, emptyRows, invalidRows };
}

function applyCellStyles(td, value) {
    td.style.textAlign = 'center';
    td.style.verticalAlign = 'middle';
    td.style.padding = '8px 4px';
    td.style.minWidth = '80px';
    td.style.maxWidth = '150px';
    td.style.whiteSpace = 'nowrap';
    td.style.overflow = 'hidden';
    td.style.textOverflow = 'ellipsis';

    // Очищаем HTML и показываем просто текст
    td.textContent = value || '';
    td.title = value || '';

    // Если значение пустое
    if (!value || value.trim() === '') {
        td.style.color = '#9ca3af';
        td.style.fontStyle = 'italic';
        td.textContent = '—';
        return;
    }

    const cleanValue = value.trim();

    // Простые стили БЕЗ эмодзи
    if (cleanValue === '+') {
        td.style.color = '#10b981';
        td.style.fontWeight = 'bold';
    } else if (cleanValue === '-') {
        td.style.color = '#ef4444';
        td.style.fontWeight = 'bold';
    } else if (cleanValue === '?' || cleanValue.includes('?')) {
        td.style.color = '#f59e0b';
        td.style.fontWeight = 'bold';
    } else if (cleanValue === 'W' || cleanValue === 'w') {
        td.style.color = '#8b5cf6';
        td.style.fontWeight = 'bold';
    } else if (cleanValue === 'ND' || cleanValue === 'nd') {
        td.style.color = '#9ca3af';
        td.style.fontStyle = 'italic';
    } else if (cleanValue.includes('/')) {
        // Значения типа "+/+", "+/-", "W/+"
        td.style.fontWeight = 'bold';
        td.textContent = cleanValue;
    } else if (cleanValue.includes('-') && !isNaN(parseInt(cleanValue.split('-')[0]))) {
        // Числовые диапазоны типа "0-1", "2-4"
        td.style.color = '#3b82f6';
        td.textContent = cleanValue;
    } else if (!isNaN(parseInt(cleanValue)) || !isNaN(parseFloat(cleanValue))) {
        // Числа
        td.style.color = '#3b82f6';
        td.textContent = cleanValue;
    } else {
        // Остальные значения
        td.style.color = '#374151';
        td.textContent = cleanValue;
    }
}

function addTableLegend(correctedCells) {
    const existingLegend = document.getElementById('tableLegend');
    if (existingLegend) {
        existingLegend.remove();
    }

    const legend = document.createElement('div');
    legend.id = 'tableLegend';
    legend.style.cssText = `
        padding: 8px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        font-size: 0.8rem;
        color: #4a5568;
    `;

    legend.innerHTML = `
        <span style="color: #10b981; font-weight: bold;">+</span> Положительный
        <span style="margin-left: 12px; color: #ef4444; font-weight: bold;">-</span> Отрицательный
        <span style="margin-left: 12px; color: #f59e0b; font-weight: bold;">?</span> Неопределенный
        <span style="margin-left: 12px; color: #8b5cf6; font-weight: bold;">w</span> Слабоположительный
        <span style="margin-left: 12px; color: #9ca3af; font-style: italic;">ND</span> Нет данных
    `;

    if (correctedCells > 0) {
        legend.innerHTML += ` | <span style="color: #f59e0b;">Исправлено: ${correctedCells}</span>`;
    }

    elements.tableInfo.parentNode.insertBefore(legend, elements.tableInfo.nextSibling);
}

function checkMissingData(jsonStr) {
    try {
        const data = JSON.parse(jsonStr);
        const tableData = data.table_data || [];
        const expectedRows = parseInt(elements.expectedRowsInput?.value) || 30;

        // Проверяем, что элементы существуют
        if (elements.validationAlert && elements.alertTitle && elements.alertMessage) {
            elements.validationAlert.style.display = 'block';

            if (tableData.length < expectedRows) {
                const missing = expectedRows - tableData.length;
                elements.alertTitle.textContent = 'ВНИМАНИЕ: Пропущены данные';
                elements.alertMessage.textContent = `Пропущено ${missing} строк! Ожидалось: ${expectedRows}, получено: ${tableData.length}`;
                elements.validationAlert.className = 'validation-alert warning';
            } else {
                elements.alertTitle.textContent = 'Успешно';
                elements.alertMessage.textContent = `Все данные извлечены успешно. Строк: ${tableData.length}`;
                elements.validationAlert.className = 'validation-alert success';
            }
        } else {
            console.warn('Элементы валидации не найдены');
            // Просто выводим в консоль
            if (tableData.length < expectedRows) {
                const missing = expectedRows - tableData.length;
                console.warn(`ВНИМАНИЕ: Пропущено ${missing} строк!`);
            } else {
                console.log(`Успешно извлечено ${tableData.length} строк`);
            }
        }

    } catch (error) {
        console.error('Ошибка при проверке данных:', error);
    }
}

function toggleView() {
    console.log('toggleView вызвана');

    // Определяем, что сейчас видно
    const tableViewVisible = elements.tableView.style.display === 'block';
    const jsonViewVisible = elements.jsonView.style.display === 'block';

    console.log('Таблица видна:', tableViewVisible);
    console.log('JSON виден:', jsonViewVisible);

    if (tableViewVisible) {
        // Если таблица видна, показываем JSON
        showView('json');
    } else {
        // Иначе показываем таблицу
        showView('table');
    }
}

function showView(view) {
    console.log('showView вызывается с параметром:', view);

    if (!elements.tableView || !elements.jsonView || !elements.toggleViewBtn) {
        console.error('Элементы для переключения вида не найдены');
        return;
    }

    if (view === 'table') {
        console.log('Показываем таблицу, скрываем JSON');

        // Показываем таблицу
        elements.tableView.style.display = 'block';

        // Скрываем JSON
        elements.jsonView.style.display = 'none';

        // Обновляем кнопку
        elements.toggleViewBtn.innerHTML = '<i class="fas fa-code"></i> Показать JSON';
        elements.toggleViewBtn.setAttribute('data-view', 'json');

        // Если есть данные, обновляем таблицу
        try {
            const jsonText = elements.jsonOutput.textContent;
            const data = JSON.parse(jsonText);

            if (data.table_data && Array.isArray(data.table_data) && data.table_data.length > 0) {
                console.log('Обновляем таблицу с данными');
                displayTable(data.table_data);
            }
        } catch (error) {
            console.error('Ошибка при обновлении таблицы:', error);
        }

    } else {
        console.log('Показываем JSON, скрываем таблицу');

        // Показываем JSON
        elements.jsonView.style.display = 'block';

        // Скрываем таблицу
        elements.tableView.style.display = 'none';

        // Обновляем кнопку
        elements.toggleViewBtn.innerHTML = '<i class="fas fa-table"></i> Показать таблицу';
        elements.toggleViewBtn.setAttribute('data-view', 'table');
    }

    // Логируем конечное состояние
    console.log('После showView:');
    console.log('tableView display:', elements.tableView.style.display);
    console.log('jsonView display:', elements.jsonView.style.display);
    console.log('data-view:', elements.toggleViewBtn.getAttribute('data-view'));
}

function copyJSON() {
    try {
        // Пытаемся спарсить JSON, чтобы убедиться в его корректности
        const jsonText = elements.jsonOutput.textContent;
        JSON.parse(jsonText);

        navigator.clipboard.writeText(jsonText)
            .then(() => {
                const originalText = elements.copyJsonBtn.innerHTML;
                elements.copyJsonBtn.innerHTML = '<i class="fas fa-check"></i> Скопировано!';

                setTimeout(() => {
                    elements.copyJsonBtn.innerHTML = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Ошибка при копировании: ', err);
                alert('Ошибка при копировании: ' + err.message);
            });

    } catch (error) {
        alert('Невозможно скопировать: JSON содержит ошибки. ' + error.message);
    }
}

function downloadJSON() {
    if (!jsonData) return;

    try {
        // Пытаемся спарсить JSON
        const jsonObj = JSON.parse(jsonData);
        const dataStr = JSON.stringify(jsonObj, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');

        link.href = url;
        link.download = `table_result_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error('Ошибка при создании файла для скачивания:', error);
        alert('Ошибка: Невозможно скачать файл. JSON содержит ошибки.');
    }
}

function showLoading(show) {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.style.display = show ? 'flex' : 'none'; // было block
    }
    if (!show && elements.progressBar) {
        updateProgress(0, '');
    }
}

function updateProgress(percent, status) {
    if (elements.progressBar) {
        elements.progressBar.style.width = `${percent}%`;
    }
    if (elements.statusText) {
        elements.statusText.textContent = status;
    }

    // Обновляем шаги прогресса (добавьте эту функцию)
    updateProgressSteps(percent);
}

function updateProgressSteps(percent) {
    const steps = document.querySelectorAll('.step');
    steps.forEach((step, index) => {
        const stepPercent = (index + 1) * 25;
        if (percent >= stepPercent) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });
}

function saveSettings() {
    const settings = {
        apiKey: elements.apiKeyInput.value,
        accessToken: elements.accessTokenInput.value,
        expectedRows: elements.expectedRowsInput.value
    };

    localStorage.setItem('pdfExtractorSettings', JSON.stringify(settings));
    checkProcessButton();
}

function loadSavedSettings() {
    const saved = localStorage.getItem('pdfExtractorSettings');

    if (saved) {
        try {
            const settings = JSON.parse(saved);

            if (settings.apiKey) elements.apiKeyInput.value = settings.apiKey;
            if (settings.accessToken) elements.accessTokenInput.value = settings.accessToken;
            if (settings.expectedRows) elements.expectedRowsInput.value = settings.expectedRows;

            checkProcessButton();
        } catch (error) {
            console.error('Ошибка при загрузке настроек:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', init);

const style = document.createElement('style');
style.textContent = `
    .json-key { color: #005cc5; font-weight: bold; }
    .json-string { color: #032f62; }
    .json-number { color: #d73a49; }
    .json-boolean { color: #6f42c1; }
    .json-null { color: #d73a49; font-weight: bold; }
    .special-char { font-weight: bold; color: #d73a49; }
`;
document.head.appendChild(style);

console.log("Проверка элементов:");
Object.keys(elements).forEach(key => {
    console.log(`${key}:`, elements[key] ? '✓' : '✗');
});

if (elements.clearResultsBtn) {
    elements.clearResultsBtn.addEventListener('click', clearResults);
}

function clearResults() {
    // Очищаем JSON
    elements.jsonOutput.textContent = '{\n  "table_data": []\n}';

    // Очищаем таблицу
    elements.tableHeader.innerHTML = '<tr><th>characteristic</th></tr>';
    elements.tableBody.innerHTML = '';
    elements.tableInfo.textContent = 'Загрузите файл для просмотра данных';

    // Скрываем таблицу, показываем JSON
    showView('json');

    if (document.getElementById('exportDropdownBtn')) {
        document.getElementById('exportDropdownBtn').disabled = true;
    }

    // Очищаем валидационное сообщение
    if (elements.validationAlert) {
        elements.validationAlert.style.display = 'none';
    }

    // Отключаем кнопки
    elements.copyJsonBtn.disabled = true;
    elements.toggleViewBtn.disabled = true;
    elements.clearResultsBtn.disabled = true;
    elements.downloadBtn.disabled = true;

    // Очищаем глобальные переменные
    jsonData = null;
    currentFileId = null;

    console.log('Результаты очищены');
}

if (document.getElementById('showRawBtn')) {
    document.getElementById('showRawBtn').addEventListener('click', showRawResponse);
}

rawResponse = content;

function showRawResponse() {
    if (rawResponse) {
        alert('Сырой ответ от GigaChat (первые 1000 символов):\n\n' + rawResponse.substring(0, 1000));
    }
}

if (document.getElementById('showRawBtn')) {
    document.getElementById('showRawBtn').style.display = 'inline-block';
}

function validateTableData(tableData) {
    if (!tableData || !Array.isArray(tableData)) {
        console.error('tableData должен быть массивом:', tableData);
        return false;
    }

    if (tableData.length === 0) {
        console.warn('Массив tableData пустой');
        return false;
    }

    // Проверяем первую строку на наличие необходимых полей
    const firstRow = tableData[0];
    if (!firstRow || typeof firstRow !== 'object') {
        console.error('Первая строка не является объектом:', firstRow);
        return false;
    }

    // Проверяем наличие хотя бы characteristic
    if (!firstRow.hasOwnProperty('characteristic')) {
        console.warn('Нет поля characteristic в данных');
    }

    return true;
}

if (document.getElementById('exportTableBtn')) {
    document.getElementById('exportTableBtn').addEventListener('click', exportTable);
}

if (document.getElementById('scrollToTopBtn')) {
    document.getElementById('scrollToTopBtn').addEventListener('click', scrollTableToTop);
}

if (document.getElementById('scrollToBottomBtn')) {
    document.getElementById('scrollToBottomBtn').addEventListener('click', scrollTableToBottom);
}

function exportTable() {
    if (!jsonData) return;

    try {
        const data = JSON.parse(jsonData);
        if (!data.table_data || !Array.isArray(data.table_data)) {
            throw new Error('Нет табличных данных для экспорта');
        }

        // Создаем CSV
        let csv = '';
        const headers = ['Characteristic'];

        // Определяем колонки
        const firstRow = data.table_data[0];
        if (firstRow) {
            Object.keys(firstRow).forEach(key => {
                if (key !== 'characteristic') {
                    headers.push(key.toUpperCase());
                }
            });
        }

        csv += headers.join(',') + '\n';

        // Добавляем данные
        data.table_data.forEach(row => {
            const rowData = [row.characteristic || ''];
            headers.slice(1).forEach(header => {
                const key = header.toLowerCase();
                rowData.push(row[key] || '');
            });
            csv += rowData.map(cell => `"${cell}"`).join(',') + '\n';
        });

        // Скачиваем CSV
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `table_${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error('Ошибка при экспорте таблицы:', error);
        alert('Ошибка при экспорте: ' + error.message);
    }
}

function scrollTableToTop() {
    const tableWrapper = document.querySelector('.table-wrapper');
    if (tableWrapper) {
        tableWrapper.scrollTop = 0;
    }
}

function scrollTableToBottom() {
    const tableWrapper = document.querySelector('.table-wrapper');
    if (tableWrapper) {
        tableWrapper.scrollTop = tableWrapper.scrollHeight;
    }
}

if (elements.toggleViewBtn) {
    console.log('Добавляем обработчик для toggleViewBtn');
    elements.toggleViewBtn.addEventListener('click', function(e) {
        console.log('Кнопка toggleViewBtn нажата', e);
        toggleView();
    });
} else {
    console.error('Кнопка toggleViewBtn не найдена!');
}

window.testTableView = function() {
    console.log('=== Тест переключения вида ===');
    console.log('Текущее состояние:');
    console.log('tableView:', elements.tableView.style.display);
    console.log('jsonView:', elements.jsonView.style.display);
    console.log('data-view:', elements.toggleViewBtn.getAttribute('data-view'));

    // Принудительно показываем таблицу
    elements.tableView.style.display = 'block';
    elements.jsonView.style.display = 'none';
    elements.toggleViewBtn.setAttribute('data-view', 'json');
    elements.toggleViewBtn.innerHTML = '<i class="fas fa-code"></i> Показать JSON';

    console.log('После принудительного переключения:');
    console.log('tableView:', elements.tableView.style.display);
    console.log('jsonView:', elements.jsonView.style.display);
    console.log('data-view:', elements.toggleViewBtn.getAttribute('data-view'));
};

function fixTableSymbols(tableData) {
    if (!Array.isArray(tableData)) return tableData;

    console.log('Исправление символов в таблице...');

    return tableData.map(row => {
        if (!row || typeof row !== 'object') return row;

        const fixedRow = { ...row };

        Object.keys(fixedRow).forEach(key => {
            if (key === 'characteristic') return;

            const value = String(fixedRow[key] || '');

            // Исправляем символы
            let fixedValue = value;

            // Преобразуем похожие на плюс символы
            if (/[?�•∗·∙⋅◦]/.test(value)) {
                // Если в строке есть символы, похожие на плюс
                fixedValue = value.replace(/[?�•∗·∙⋅◦]/g, match => {
                    // Проверяем контекст
                    const context = JSON.stringify(row).toLowerCase();
                    const isLikelyPlus = context.includes('assimilation') ||
                                        context.includes('enzyme') ||
                                        context.includes('test') ||
                                        context.includes('фермент') ||
                                        context.includes('ассимиляция');

                    if (isLikelyPlus) {
                        console.log(`Исправляем символ "${match}" в "${row.characteristic}" на "+"`);
                        return '+';
                    }
                    return match;
                });
            }

            // Преобразуем разные типы минусов/тире
            if (/[―–—～~˗‐‑‒–—―﹘﹣－]/.test(fixedValue)) {
                fixedValue = fixedValue.replace(/[―–—～~˗‐‑‒–—―﹘﹣－]/g, '-');
            }

            // Убираем лишние пробелы
            fixedValue = fixedValue.trim();

            // Заменяем множественные пробелы на один
            fixedValue = fixedValue.replace(/\s+/g, ' ');

            if (value !== fixedValue) {
                console.log(`Исправлено: "${value}" → "${fixedValue}" в ${row.characteristic}`);
            }

            fixedRow[key] = fixedValue;
        });

        return fixedRow;
    });
}

function postProcessTableData(tableData) {
    if (!Array.isArray(tableData)) return tableData;

    console.log('Дополнительная постобработка данных...');

    // Определяем контекст строк
    const assimilationRows = new Set();
    const enzymeRows = new Set();

    // Расширенные ключевые слова для разных типов строк
    const assimilationKeywords = [
        'assimilation', 'ассимиляция', 'assimilates', 'assimilate',
        'углевод', 'углеводы', 'сахар', 'сахара',
        'glucose', 'глюкоза', 'glucos', 'глюкоз',
        'fructose', 'фруктоза', 'fructos', 'фруктоз',
        'maltose', 'мальтоза', 'maltos', 'мальтоз',
        'dextrin', 'декстрин', 'dextr', 'декстри',
        'cellobiose', 'целлобиоза', 'cellobios', 'целлобиоз',
        'mannose', 'манноза', 'mannos', 'манноз',
        'lactose', 'лактоза', 'lactos', 'лактоз',
        'sucrose', 'сахароза', 'sucros', 'сахароз',
        'galactose', 'галактоза', 'galactos', 'галактоз',
        'sorbose', 'сорбоза', 'sorbos', 'сорбоз',
        'xylose', 'ксилоза', 'xylos', 'ксилоз',
        'arabinose', 'арабиноза', 'arabinos', 'арабиноз',
        'ribose', 'рибоза', 'ribos', 'рибоз',
        'rhamnose', 'рамноза', 'rhamnos', 'рамноз',
        'trehalose', 'трегалоза', 'trehalos', 'трегалоз',
        'raffinose', 'раффиноза', 'raffinos', 'раффиноз',
        'melezitose', 'мелецитоза', 'melezitos', 'мелецитоз',
        'starch', 'крахмал', 'starc', 'крахма',
        'glycogen', 'гликоген', 'glycoge', 'гликоге'
    ];

    const enzymeKeywords = [
        'enzyme', 'фермент', 'activity', 'активность',
        'lipase', 'липаза', 'lipas', 'липаз',
        'arylamidase', 'ариламидаза', 'arylamidas', 'ариламидаз',
        'trypsin', 'трипсин', 'trypsi', 'трипси',
        'glucosaminidase', 'глюкозаминидаза', 'glucosaminidas', 'глюкозаминидаз',
        'phosphatase', 'фосфатаза', 'phosphatas', 'фосфатаз',
        'protease', 'протеаза', 'proteas', 'протеаз',
        'catalase', 'каталаза', 'catalas', 'каталаз',
        'oxidase', 'оксидаза', 'oxidas', 'оксидаз',
        'urease', 'уреаза', 'ureas', 'уреаз',
        'amylase', 'амилаза', 'amylas', 'амилаз',
        'cellulase', 'целлюлаза', 'cellulas', 'целлюлаз',
        'hemolysin', 'гемолизин', 'hemolysi', 'гемолизи',
        'coagulase', 'коагулаза', 'coagulas', 'коагулаз'
    ];

    // Классифицируем строки
    tableData.forEach(row => {
        if (!row.characteristic) return;

        const characteristic = row.characteristic.toLowerCase().trim();

        // Проверяем ассимиляцию
        const isAssimilation = assimilationKeywords.some(keyword => {
            // Точное совпадение или вхождение слова
            return characteristic === keyword ||
                   characteristic.includes(keyword) ||
                   characteristic.split(/\s+/).some(word => word === keyword);
        });

        if (isAssimilation) {
            assimilationRows.add(row.characteristic);
        }

        // Проверяем ферменты
        const isEnzyme = enzymeKeywords.some(keyword => {
            return characteristic === keyword ||
                   characteristic.includes(keyword) ||
                   characteristic.split(/\s+/).some(word => word === keyword);
        });

        if (isEnzyme) {
            enzymeRows.add(row.characteristic);
        }
    });

    console.log('Классификация строк:');
    console.log('Ассимиляция:', Array.from(assimilationRows));
    console.log('Ферменты:', Array.from(enzymeRows));

    // Правила преобразования в зависимости от контекста
    return tableData.map(row => {
        const newRow = { ...row };
        const characteristic = row.characteristic ? row.characteristic.toLowerCase().trim() : '';

        Object.keys(newRow).forEach(key => {
            if (key === 'characteristic') return;

            let value = String(newRow[key] || '').trim();
            let originalValue = value;

            // ПРАВИЛО 1: Ассимиляция углеводов - "?" ВСЕГДА преобразуется в "+"
            if (assimilationRows.has(row.characteristic) && value === '?') {
                console.log(`Ассимиляция углеводов: "${row.characteristic}" - заменяем "?" на "+"`);
                value = '+';
            }

            // ПРАВИЛО 2: Для ферментов - "?" может быть "+" или "-" в зависимости от типа
            else if (enzymeRows.has(row.characteristic) && value === '?') {
                const enzymeName = characteristic;

                // Ферменты, которые обычно дают положительную реакцию
                const positiveEnzymes = [
                    'lipase', 'липаза',
                    'trypsin', 'трипсин',
                    'glucosaminidase', 'глюкозаминидаза',
                    'catalase', 'каталаза',
                    'oxidase', 'оксидаза'
                ];

                const isPositiveEnzyme = positiveEnzymes.some(enzyme =>
                    enzymeName.includes(enzyme)
                );

                if (isPositiveEnzyme) {
                    console.log(`Фермент ${row.characteristic}: обычно положительный, заменяем "?" на "+"`);
                    value = '+';
                } else {
                    console.log(`Фермент ${row.characteristic}: обычно отрицательный, заменяем "?" на "-"`);
                    value = '-';
                }
            }

            // ПРАВИЛО 3: Общее правило для остальных случаев
            else if (value === '?') {
                // Анализируем столбец
                const columnData = tableData
                    .map(r => r[key])
                    .filter(v => v !== undefined)
                    .map(v => String(v).trim());

                const plusCount = columnData.filter(v => v === '+').length;
                const minusCount = columnData.filter(v => v === '-').length;
                const questionCount = columnData.filter(v => v === '?').length;
                const total = columnData.length;

                if (total > 5) { // Только если достаточно данных
                    const plusRatio = plusCount / total;
                    const minusRatio = minusCount / total;
                    const questionRatio = questionCount / total;

                    // Если в столбце явное большинство "+"
                    if (plusRatio > 0.7 && questionRatio < 0.3) {
                        console.log(`Столбец ${key}: доминируют "+" (${plusCount}/${total}), заменяем "?" на "+" в "${row.characteristic}"`);
                        value = '+';
                    }
                    // Если в столбце явное большинство "-"
                    else if (minusRatio > 0.7 && questionRatio < 0.3) {
                        console.log(`Столбец ${key}: доминируют "-" (${minusCount}/${total}), заменяем "?" на "-" в "${row.characteristic}"`);
                        value = '-';
                    }
                }
            }

            // Исправляем другие похожие символы
            if (value && !['+', '-', '?'].includes(value)) {
                // Любой символ, похожий на плюс
                if (/[＋﹢⁺₊†‡ᐩ•∗·∙⋅◦]/.test(value)) {
                    console.log(`Исправляем похожий на плюс символ "${value}" на "+" в "${row.characteristic}"`);
                    value = '+';
                }
                // Любой символ, похожий на минус
                else if (/[−–—―‑‒–—―]/.test(value)) {
                    console.log(`Исправляем похожий на минус символ "${value}" на "-" в "${row.characteristic}"`);
                    value = '-';
                }
            }

            // Убираем лишние пробелы
            value = value.trim();

            // Если значение изменилось, сохраняем
            if (originalValue !== value) {
                newRow[key] = value;
                console.log(`Исправлено: "${row.characteristic}"[${key}] "${originalValue}" → "${value}"`);
            }
        });

        return newRow;
    });
}

function addTableLegend(correctedCells) {
    const existingLegend = document.getElementById('tableLegend');
    if (existingLegend) {
        existingLegend.remove();
    }

    const legend = document.createElement('div');
    legend.id = 'tableLegend';
    legend.style.cssText = `
        padding: 12px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: center;
        font-size: 0.85rem;
        color: #4a5568;
    `;

    if (correctedCells > 0) {
        legend.innerHTML += `
            <div style="display: flex; align-items: center; gap: 6px;">
                <span style="background: #fef3c7; padding: 2px 6px; border: 1px solid #f59e0b; border-radius: 3px;">
                    Исправленный символ
                </span>
                <span>Автоматически исправлено: ${correctedCells}</span>
            </div>
        `;
    }

    elements.tableInfo.parentNode.insertBefore(legend, elements.tableInfo.nextSibling);
}

if (document.getElementById('fixSymbolsBtn')) {
    document.getElementById('fixSymbolsBtn').addEventListener('click', manualFixSymbols);
}

function manualFixSymbols() {
    try {
        const jsonText = elements.jsonOutput.textContent;
        const data = JSON.parse(jsonText);

        if (!data.table_data || !Array.isArray(data.table_data)) {
            alert('Нет табличных данных для исправления');
            return;
        }

        console.log('Ручное исправление символов...');

        // Сохраняем оригинальные данные
        const originalData = JSON.parse(JSON.stringify(data.table_data));

        // Применяем исправления
        data.table_data = fixTableSymbols(data.table_data);
        data.table_data = postProcessTableData(data.table_data);

        // Считаем изменения
        let changes = 0;
        originalData.forEach((originalRow, index) => {
            const fixedRow = data.table_data[index];
            if (!originalRow || !fixedRow) return;

            Object.keys(originalRow).forEach(key => {
                if (key === 'characteristic') return;

                const originalValue = String(originalRow[key] || '');
                const fixedValue = String(fixedRow[key] || '');

                if (originalValue !== fixedValue) {
                    changes++;
                    console.log(`Изменение: ${originalRow.characteristic}[${key}] "${originalValue}" → "${fixedValue}"`);
                }
            });
        });

        // Обновляем отображение
        elements.jsonOutput.textContent = JSON.stringify(data, null, 2);
        highlightJSON();

        if (elements.tableView.style.display === 'block') {
            displayTable(data.table_data);
        }

        // Показываем результат
        if (changes > 0) {
            alert(`Исправлено ${changes} символов в таблице`);
        } else {
            alert('Символы не нуждаются в исправлении');
        }

        // Сохраняем исправленные данные
        jsonData = JSON.stringify(data);

    } catch (error) {
        console.error('Ошибка при ручном исправлении символов:', error);
        alert('Ошибка: ' + error.message);
    }
}

if (document.getElementById('convertQuestionsBtn')) {
    document.getElementById('convertQuestionsBtn').addEventListener('click', convertQuestionsToPlus);
}

function convertQuestionsToPlus() {
    try {
        const jsonText = elements.jsonOutput.textContent;
        const data = JSON.parse(jsonText);

        if (!data.table_data || !Array.isArray(data.table_data)) {
            alert('Нет табличных данных для обработки');
            return;
        }

        let changes = 0;
        const assimilationKeywords = ['dextrin', 'cellobiose', 'fructose', 'glucose', 'maltose', 'mannose', 'sugar', 'углевод', 'сахар'];

        data.table_data = data.table_data.map(row => {
            const newRow = { ...row };
            const characteristic = (row.characteristic || '').toLowerCase();

            // Проверяем, относится ли строка к ассимиляции углеводов
            const isAssimilation = assimilationKeywords.some(keyword =>
                characteristic.includes(keyword)
            );

            if (isAssimilation) {
                Object.keys(newRow).forEach(key => {
                    if (key === 'characteristic') return;

                    const value = String(newRow[key] || '');
                    if (value === '?') {
                        newRow[key] = '+';
                        changes++;
                        console.log(`Преобразовано: ${row.characteristic}[${key}] "?" → "+"`);
                    }
                });
            }

            return newRow;
        });

        // Обновляем отображение
        elements.jsonOutput.textContent = JSON.stringify(data, null, 2);
        highlightJSON();

        if (elements.tableView.style.display === 'block') {
            displayTable(data.table_data);
        }

        alert(`Преобразовано ${changes} символов "?" в "+" для ассимиляции углеводов`);

        // Сохраняем исправленные данные
        jsonData = JSON.stringify(data);

    } catch (error) {
        console.error('Ошибка при преобразовании:', error);
        alert('Ошибка: ' + error.message);
    }
}

function forceFixAssimilation(tableData) {
    if (!Array.isArray(tableData)) return tableData;

    // Расширенный список углеводов для ассимиляции
    const carbohydrateKeywords = [
        // Английские названия
        'glucose', 'fructose', 'maltose', 'dextrin', 'cellobiose',
        'mannose', 'lactose', 'sucrose', 'galactose', 'sorbose',
        'xylose', 'arabinose', 'ribose', 'rhamnose', 'trehalose',
        'raffinose', 'melezitose', 'starch', 'glycogen',
        // Русские названия
        'глюкоза', 'фруктоза', 'мальтоза', 'декстрин', 'целлобиоза',
        'манноза', 'лактоза', 'сахароза', 'галактоза', 'сорбоза',
        'ксилоза', 'арабиноза', 'рибоза', 'рамноза', 'трегалоза',
        'раффиноза', 'мелецитоза', 'крахмал', 'гликоген',
        // Общие термины
        'sugar', 'углевод', 'сахар', 'carbohydrate', 'углеводы',
        'assimilation', 'ассимиляция'
    ];

    return tableData.map(row => {
        if (!row || typeof row !== 'object' || !row.characteristic) return row;

        const characteristic = row.characteristic.toLowerCase().trim();
        const isCarbohydrate = carbohydrateKeywords.some(keyword =>
            characteristic.includes(keyword.toLowerCase())
        );

        if (!isCarbohydrate) return row;

        const newRow = { ...row };
        let changes = 0;

        Object.keys(newRow).forEach(key => {
            if (key === 'characteristic') return;

            const value = String(newRow[key] || '').trim();
            if (value === '?') {
                newRow[key] = '+';
                changes++;
            }
        });

        if (changes > 0) {
            console.log(`Принудительно исправлено ${changes} символов "?" в "+" для: ${row.characteristic}`);
        }

        return newRow;
    });
}

function manualFixSymbols() {
    try {
        const jsonText = elements.jsonOutput.textContent;
        const data = JSON.parse(jsonText);

        if (!data.table_data || !Array.isArray(data.table_data)) {
            alert('Нет табличных данных для исправления');
            return;
        }

        console.log('Ручное исправление символов...');

        // Сохраняем оригинальные данные
        const originalData = JSON.parse(JSON.stringify(data.table_data));

        // Применяем все исправления
        data.table_data = fixTableSymbols(data.table_data);
        data.table_data = postProcessTableData(data.table_data);
        data.table_data = forceFixAssimilation(data.table_data); // Добавляем принудительное исправление

        // Считаем изменения
        let changes = 0;
        originalData.forEach((originalRow, index) => {
            const fixedRow = data.table_data[index];
            if (!originalRow || !fixedRow) return;

            Object.keys(originalRow).forEach(key => {
                if (key === 'characteristic') return;

                const originalValue = String(originalRow[key] || '');
                const fixedValue = String(fixedRow[key] || '');

                if (originalValue !== fixedValue) {
                    changes++;
                    console.log(`Изменение: ${originalRow.characteristic}[${key}] "${originalValue}" → "${fixedValue}"`);
                }
            });
        });

        // Обновляем отображение
        elements.jsonOutput.textContent = JSON.stringify(data, null, 2);
        highlightJSON();

        if (elements.tableView.style.display === 'block') {
            displayTable(data.table_data);
        }

        // Показываем результат
        if (changes > 0) {
            alert(`Исправлено ${changes} символов в таблице`);
        } else {
            alert('Символы не нуждаются в исправлении');
        }

        // Сохраняем исправленные данные
        jsonData = JSON.stringify(data);

    } catch (error) {
        console.error('Ошибка при ручном исправлении символов:', error);
        alert('Ошибка: ' + error.message);
    }
}

function forceFixAssimilationImproved(tableData) {
    if (!Array.isArray(tableData)) return tableData;

    console.log('=== УЛУЧШЕННОЕ ИСПРАВЛЕНИЕ АССИМИЛЯЦИИ ===');

    // Шаблоны для распознавания углеводов
    const carbPatterns = [
        // Основные углеводы (точные совпадения)
        /^dextrin$/i,
        /^cellobiose$/i,
        /^fructose$/i,
        /^glucose$/i,
        /^maltose$/i,
        /^mannose$/i,
        /^lactose$/i,
        /^sucrose$/i,
        /^galactose$/i,
        /^sorbose$/i,
        /^xylose$/i,
        /^arabinose$/i,
        /^ribose$/i,
        /^rhamnose$/i,
        /^trehalose$/i,
        /^raffinose$/i,
        /^melezitose$/i,
        /^starch$/i,
        /^glycogen$/i,

        // С префиксами
        /^d-.*glucose$/i,
        /^d-.*fructose$/i,
        /^d-.*mannose$/i,
        /^d-.*maltose$/i,
        /^d-.*cellobiose$/i,
        /^α-d-.*glucose$/i,
        /^d-glucose$/i,
        /^d-fructose$/i,
        /^d-mannose$/i,
        /^d-maltose$/i,

        // Русские варианты
        /^декстрин$/i,
        /^целлобиоза$/i,
        /^фруктоза$/i,
        /^глюкоза$/i,
        /^мальтоза$/i,
        /^манноза$/i,
        /^лактоза$/i,
        /^сахароза$/i,
        /^галактоза$/i,
        /^сорбоза$/i,
        /^ксилоза$/i,
        /^арабиноза$/i,
        /^рибоза$/i,
        /^рамноза$/i,
        /^трегалоза$/i,
        /^раффиноза$/i,
        /^мелецитоза$/i,
        /^крахмал$/i,
        /^гликоген$/i,

        // Частичные совпадения
        /glucos/i,
        /fructos/i,
        /maltos/i,
        /mannos/i,
        /cellobios/i,
        /dextr/i,
        /сахар/i,
        /углевод/i
    ];

    let totalChanges = 0;
    const changedRows = [];

    const result = tableData.map((row, rowIndex) => {
        if (!row || typeof row !== 'object' || !row.characteristic) return row;

        const characteristic = row.characteristic.trim();
        const charLower = characteristic.toLowerCase();

        // Проверяем, является ли строка углеводом
        const isCarbohydrate = carbPatterns.some(pattern =>
            pattern.test(characteristic) || pattern.test(charLower)
        );

        console.log(`Строка ${rowIndex}: "${characteristic}" - углевод: ${isCarbohydrate}`);

        const newRow = { ...row };
        let rowChanges = 0;

        if (isCarbohydrate) {
            Object.keys(newRow).forEach(key => {
                if (key === 'characteristic') return;

                const originalValue = String(newRow[key] || '');

                // Очищаем значение для проверки
                const cleanValue = originalValue
                    .replace(/[❓❌✅⭐—–\s↵↵]/g, '')  // Убираем эмодзи и спецсимволы
                    .trim();

                // Проверяем различные варианты "?"
                const isQuestionMark =
                    cleanValue === '?' ||
                    originalValue.includes('?') ||
                    originalValue.includes('❓') ||
                    cleanValue === '' && originalValue !== ''; // Пустые значения тоже меняем

                if (isQuestionMark) {
                    const oldValue = originalValue;
                    newRow[key] = '+';
                    rowChanges++;

                    console.log(`  Изменение [${key}]: "${oldValue}" → "+"`);
                }
            });
        }

        if (rowChanges > 0) {
            totalChanges += rowChanges;
            changedRows.push({
                index: rowIndex,
                characteristic: characteristic,
                changes: rowChanges
            });
        }

        return newRow;
    });

    // Логируем результаты
    console.log('\n=== ИТОГИ ИСПРАВЛЕНИЯ ===');
    console.log(`Обработано строк: ${tableData.length}`);
    console.log(`Изменено строк: ${changedRows.length}`);
    console.log(`Всего изменений: ${totalChanges}`);

    if (changedRows.length > 0) {
        console.log('\nИзмененные строки:');
        changedRows.forEach(item => {
            console.log(`  ${item.index}. "${item.characteristic}": ${item.changes} ячеек`);
        });
    } else {
        console.log('Нет изменений. Возможные причины:');
        console.log('1. Нет строк углеводов в данных');
        console.log('2. В строках углеводов нет знаков "?"');
        console.log('3. Знаки "?" уже исправлены');
    }

    return result;
}

function handleCellClick(e) {
    e.target.style.backgroundColor = '#e8f4fd';
    e.target.focus();
}

function handleCellBlur(e) {
    e.target.style.backgroundColor = '';
    updateTableDataFromDOM();
}

function handleCellKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
    }
}

function updateTableDataFromDOM() {
    try {
        const table = document.getElementById('dataTable');
        const rows = table.querySelectorAll('#tableBody tr');
        const headers = table.querySelectorAll('#tableHeader th');

        if (!jsonData) return;

        const data = JSON.parse(jsonData);
        if (!data.table_data) return;

        // Обновляем данные из DOM
        rows.forEach((row, rowIndex) => {
            const cells = row.querySelectorAll('td');
            const characteristic = cells[0].textContent;

            // Находим соответствующую строку в данных
            const dataRow = data.table_data.find(r => r.characteristic === characteristic);
            if (dataRow) {
                cells.forEach((cell, cellIndex) => {
                    if (cellIndex > 0) { // Пропускаем характеристику
                        const columnName = headers[cellIndex].textContent;
                        const cleanColumnName = columnName.replace('Col ', 'column_');
                        dataRow[cleanColumnName] = cell.textContent.trim();
                    }
                });
            }
        });

        // Сохраняем обновленные данные
        jsonData = JSON.stringify(data);
        elements.jsonOutput.textContent = JSON.stringify(data, null, 2);
        highlightJSON();

    } catch (error) {
        console.error('Ошибка при обновлении данных:', error);
    }
}

function deleteSelectedRows() {
    const selectedRows = document.querySelectorAll('#tableBody tr.selected');
    if (selectedRows.length === 0) {
        alert('Выберите строки для удаления (кликните на номер строки)');
        return;
    }

    if (!confirm(`Удалить выбранные ${selectedRows.length} строк?`)) {
        return;
    }

    try {
        const data = JSON.parse(jsonData);
        const rowsToDelete = [];

        selectedRows.forEach(row => {
            const characteristic = row.querySelector('td:first-child').textContent;
            const rowIndex = data.table_data.findIndex(r => r.characteristic === characteristic);
            if (rowIndex !== -1) {
                rowsToDelete.push(rowIndex);
            }
        });

        // Удаляем строки в обратном порядке
        rowsToDelete.sort((a, b) => b - a).forEach(index => {
            data.table_data.splice(index, 1);
        });

        // Обновляем данные
        jsonData = JSON.stringify(data);
        displayJSON(jsonData);

        showNotification(`Удалено ${rowsToDelete.length} строк`, 'success');

    } catch (error) {
        console.error('Ошибка при удалении строк:', error);
        showNotification('Ошибка при удалении строк', 'error');
    }
}

function deleteSelectedColumns() {
    const selectedColumns = document.querySelectorAll('#tableHeader th.selected');
    if (selectedColumns.length === 0) {
        alert('Выберите колонки для удаления (кликните на заголовок колонки)');
        return;
    }

    if (!confirm(`Удалить выбранные ${selectedColumns.length} колонок?`)) {
        return;
    }

    try {
        const data = JSON.parse(jsonData);
        const columnsToDelete = [];

        selectedColumns.forEach(th => {
            const colName = th.textContent.replace('Col ', 'column_');
            columnsToDelete.push(colName);
        });

        // Удаляем колонки из всех строк
        data.table_data.forEach(row => {
            columnsToDelete.forEach(col => {
                delete row[col];
            });
        });

        // Обновляем данные
        jsonData = JSON.stringify(data);
        displayJSON(jsonData);

        showNotification(`Удалено ${columnsToDelete.length} колонок`, 'success');

    } catch (error) {
        console.error('Ошибка при удалении колонок:', error);
        showNotification('Ошибка при удалении колонок', 'error');
    }
}

function addNewRow() {
    try {
        const data = JSON.parse(jsonData);
        const headers = document.querySelectorAll('#tableHeader th');

        // Создаем новую строку
        const newRow = { characteristic: `Новая строка ${data.table_data.length + 1}` };

        // Добавляем все колонки
        headers.forEach((th, index) => {
            if (index > 0) { // Пропускаем характеристику
                const colName = th.textContent.replace('Col ', 'column_');
                newRow[colName] = '';
            }
        });

        data.table_data.push(newRow);

        // Обновляем данные
        jsonData = JSON.stringify(data);
        displayJSON(jsonData);

        showNotification('Добавлена новая строка', 'success');

    } catch (error) {
        console.error('Ошибка при добавлении строки:', error);
        showNotification('Ошибка при добавлении строки', 'error');
    }
}

function addNewColumn() {
    const colName = prompt('Введите имя новой колонки (например: column_31):', 'column_31');
    if (!colName) return;

    try {
        const data = JSON.parse(jsonData);

        // Добавляем новую колонку всем строкам
        data.table_data.forEach(row => {
            row[colName] = '';
        });

        // Обновляем данные
        jsonData = JSON.stringify(data);
        displayJSON(jsonData);

        showNotification(`Добавлена новая колонка: ${colName}`, 'success');

    } catch (error) {
        console.error('Ошибка при добавлении колонки:', error);
        showNotification('Ошибка при добавлении колонки', 'error');
    }
}

function showEditPanel() {
    const editPanel = document.createElement('div');
    editPanel.id = 'editPanel';
    editPanel.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        z-index: 1000;
        display: flex;
        gap: 10px;
        align-items: center;
        border: 2px solid #3b82f6;
    `;

    editPanel.innerHTML = `
        <span style="color: #3b82f6; font-weight: bold;">
            <i class="fas fa-edit"></i> Режим редактирования
        </span>
        <button class="btn btn-small btn-success" onclick="saveChanges()">
            <i class="fas fa-save"></i> Сохранить
        </button>
        <button class="btn btn-small btn-danger" onclick="cancelEdit()">
            <i class="fas fa-times"></i> Отменить
        </button>
        <button class="btn btn-small btn-outline" onclick="addNewRow()">
            <i class="fas fa-plus"></i> Добавить строку
        </button>
        <button class="btn btn-small btn-outline" onclick="addNewColumn()">
            <i class="fas fa-columns"></i> Добавить колонку
        </button>
    `;

    document.body.appendChild(editPanel);
}

function hideEditPanel() {
    const editPanel = document.getElementById('editPanel');
    if (editPanel) {
        editPanel.remove();
    }
}

function saveChanges() {
    updateTableDataFromDOM();
    disableEditMode();
    showNotification('Изменения сохранены', 'success');
}

function cancelEdit() {
    // Восстанавливаем исходные данные
    if (originalTableData) {
        jsonData = JSON.stringify(originalTableData);
        displayJSON(jsonData);
    }
    disableEditMode();
    showNotification('Изменения отменены', 'info');
}

function toggleEditMode() {
    console.log('toggleEditMode вызвана, текущее состояние:', isEditMode);

    if (!jsonData) {
        showNotification('Нет данных для редактирования', 'warning');
        return;
    }

    isEditMode = !isEditMode;

    if (isEditMode) {
        enableEditMode();
    } else {
        disableEditMode();
    }
}

function enableEditMode() {
    console.log('Включение режима редактирования...');

    try {
        // Сохраняем оригинальные данные
        originalTableData = JSON.parse(jsonData);

        isEditMode = true;

        // Добавляем класс для редактируемых ячеек
        const cells = document.querySelectorAll('#tableBody td:not(:first-child)');
        cells.forEach(cell => {
            cell.classList.add('editable-cell');
            cell.contentEditable = true;
            cell.addEventListener('focus', handleCellFocus);
            cell.addEventListener('blur', handleCellBlur);
            cell.addEventListener('keydown', handleCellKeydown);

            // Добавляем возможность выбора ячейки
            cell.addEventListener('click', function(e) {
                if (e.ctrlKey || e.metaKey) {
                    this.classList.toggle('selected-cell');
                }
            });
        });

        // Добавляем номера строк
        addRowNumbers();

        // Показываем панель редактирования
        showEditPanel();

        showNotification('Режим редактирования включен', 'success');

    } catch (e) {
        console.error('Ошибка при включении режима редактирования:', e);
        showNotification('Ошибка включения режима редактирования', 'error');
        isEditMode = false;
    }
}

function disableEditMode() {
    console.log('Отключение режима редактирования...');

    isEditMode = false;

    // Убираем классы и обработчики
    const cells = document.querySelectorAll('#tableBody td.editable-cell');
    cells.forEach(cell => {
        cell.classList.remove('editable-cell', 'selected-cell');
        cell.contentEditable = false;
        cell.removeEventListener('focus', handleCellFocus);
        cell.removeEventListener('blur', handleCellBlur);
        cell.removeEventListener('keydown', handleCellKeydown);
    });

    // Убираем номера строк
    removeRowNumbers();

    // Скрываем панель редактирования
    hideEditPanel();

    // Сбрасываем выбранные строки и колонки
    selectedRows.clear();
    selectedColumns.clear();

    showNotification('Режим редактирования отключен', 'info');
}

function handleCellFocus(e) {
    e.target.style.backgroundColor = '#e8f4fd';
    e.target.style.outline = '2px solid #3b82f6';
}

function handleCellBlur(e) {
    const cell = e.target;
    cell.style.backgroundColor = '';
    cell.style.outline = '';

    // Обновляем данные в JSON
    updateCellValue(cell);
}

function handleCellKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
    }

    // Ctrl+A для выбора всех ячеек
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAllCells();
    }
}

function updateCellValue(cell) {
    try {
        const rowElement = cell.parentElement;
        const rowIndex = Array.from(rowElement.parentElement.children).indexOf(rowElement);
        const cellIndex = Array.from(rowElement.children).indexOf(cell);

        const data = JSON.parse(jsonData);
        const row = data.table_data[rowIndex];

        if (!row) return;

        // Получаем имя колонки из заголовка
        const headers = document.querySelectorAll('#tableHeader th');
        if (cellIndex >= headers.length) return;

        const header = headers[cellIndex];
        let columnName = header.textContent.trim();

        // Преобразуем заголовок в имя колонки
        if (columnName === 'Characteristic') {
            columnName = 'characteristic';
        } else if (columnName.startsWith('Col ')) {
            columnName = columnName.toLowerCase().replace('col ', 'column_');
        }

        // Обновляем значение
        const newValue = cell.textContent.trim();
        const oldValue = row[columnName] || '';

        if (newValue !== oldValue) {
            row[columnName] = newValue;

            // Обновляем JSON
            jsonData = JSON.stringify(data, null, 2);
            elements.jsonOutput.textContent = jsonData;
            highlightJSON();

            // Обновляем стиль ячейки
            applyCellStyles(cell, newValue);

            console.log(`Обновлено: строка ${rowIndex}, колонка ${columnName}: "${oldValue}" → "${newValue}"`);

            // Показываем кнопку сохранения
            showSaveButton();
        }

    } catch (error) {
        console.error('Ошибка при обновлении ячейки:', error);
        showNotification('Ошибка обновления ячейки', 'error');
    }
}

function addRowNumbers() {
    const rows = document.querySelectorAll('#tableBody tr');
    rows.forEach((row, index) => {
        if (!row.querySelector('.row-number')) {
            const firstCell = row.querySelector('td:first-child');
            const rowNumber = document.createElement('span');
            rowNumber.className = 'row-number';
            rowNumber.textContent = `${index + 1}. `;
            rowNumber.style.marginRight = '5px';
            rowNumber.style.fontWeight = 'bold';
            rowNumber.style.color = '#6b7280';

            if (firstCell && firstCell.firstChild) {
                firstCell.insertBefore(rowNumber, firstCell.firstChild);
            }
        }
    });
}

function removeRowNumbers() {
    const rowNumbers = document.querySelectorAll('.row-number');
    rowNumbers.forEach(number => {
        number.remove();
    });
}

function showEditPanel() {
    // Удаляем старую панель, если есть
    hideEditPanel();

    const editPanel = document.createElement('div');
    editPanel.id = 'editPanel';
    editPanel.className = 'edit-panel';

    editPanel.innerHTML = `
        <div class="edit-panel-content">
            <div class="edit-title">
                <i class="fas fa-edit"></i>
                <span>Режим редактирования</span>
            </div>
            
            <div class="edit-buttons">
                <button class="btn btn-small btn-success" onclick="saveChanges()" title="Сохранить изменения">
                    <i class="fas fa-save"></i> Сохранить
                </button>
                
                <button class="btn btn-small btn-danger" onclick="cancelEdit()" title="Отменить изменения">
                    <i class="fas fa-times"></i> Отменить
                </button>
                
                <button class="btn btn-small btn-outline" onclick="addNewRow()" title="Добавить строку">
                    <i class="fas fa-plus"></i> Строка
                </button>
                
                <button class="btn btn-small btn-outline" onclick="addNewColumn()" title="Добавить колонку">
                    <i class="fas fa-plus"></i> Колонка
                </button>
                
                <button class="btn btn-small btn-warning" onclick="deleteSelectedRows()" title="Удалить выбранные строки">
                    <i class="fas fa-trash"></i> Удалить строки
                </button>
                
                <button class="btn btn-small btn-warning" onclick="deleteSelectedColumns()" title="Удалить выбранные колонки">
                    <i class="fas fa-trash"></i> Удалить колонки
                </button>
                
                <button class="btn btn-small btn-secondary" onclick="disableEditMode()" title="Выйти из режима редактирования">
                    <i class="fas fa-sign-out-alt"></i> Выйти
                </button>
            </div>
            
            <div class="edit-info">
                <span><i class="fas fa-mouse-pointer"></i> Кликните на ячейку для редактирования</span>
                <span><i class="fas fa-trash"></i> Ctrl+клик для выбора нескольких ячеек</span>
            </div>
        </div>
    `;

    document.body.appendChild(editPanel);
}

function hideEditPanel() {
    const editPanel = document.getElementById('editPanel');
    if (editPanel) {
        editPanel.remove();
    }
}

function showSaveButton() {
    const saveBtn = document.querySelector('#editPanel .btn-success');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить*';
        saveBtn.style.backgroundColor = '#f59e0b';
        saveBtn.style.borderColor = '#f59e0b';
    }
}

function saveChanges() {
    if (!originalTableData) return;

    // Просто обновляем данные - они уже обновляются при изменении ячеек
    originalTableData = JSON.parse(jsonData);

    const saveBtn = document.querySelector('#editPanel .btn-success');
    if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Сохранено';
        saveBtn.style.backgroundColor = '';
        saveBtn.style.borderColor = '';

        setTimeout(() => {
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить';
        }, 2000);
    }
    updateExportButtons();
    showNotification('Изменения сохранены', 'success');
}

function cancelEdit() {
    if (!originalTableData) return;

    if (!confirm('Отменить все изменения? Это действие нельзя отменить.')) {
        return;
    }

    // Восстанавливаем оригинальные данные
    jsonData = JSON.stringify(originalTableData, null, 2);

    // Обновляем отображение
    displayJSON(jsonData);

    // Показываем уведомление
    showNotification('Изменения отменены', 'info');
}

function addNewRow() {
    try {
        const data = JSON.parse(jsonData);
        if (!data.table_data) return;

        // Получаем колонки из первой строки
        const columns = data.table_data.length > 0 ?
            Object.keys(data.table_data[0]) :
            ['characteristic'];

        // Создаем новую строку
        const newRow = {};
        columns.forEach(col => {
            if (col === 'characteristic') {
                newRow[col] = `Новая строка ${data.table_data.length + 1}`;
            } else {
                newRow[col] = '';
            }
        });

        // Добавляем строку в данные
        data.table_data.push(newRow);

        // Обновляем данные
        jsonData = JSON.stringify(data, null, 2);
        displayJSON(jsonData);

        showNotification('Добавлена новая строка', 'success');

    } catch (error) {
        console.error('Ошибка при добавлении строки:', error);
        showNotification('Ошибка при добавлении строки', 'error');
    }
}

function deleteSelectedRows() {
    const selectedCells = document.querySelectorAll('#tableBody td.selected-cell');
    const rowsToDelete = new Set();

    selectedCells.forEach(cell => {
        const row = cell.parentElement;
        rowsToDelete.add(row);
    });

    // Если нет выбранных ячеек, проверяем выбранные строки через клик
    if (rowsToDelete.size === 0) {
        const selectedRows = document.querySelectorAll('#tableBody tr.selected-row');
        selectedRows.forEach(row => rowsToDelete.add(row));
    }

    if (rowsToDelete.size === 0) {
        alert('Выберите строки для удаления (Ctrl+клик на ячейки или клик на номер строки)');
        return;
    }

    if (!confirm(`Удалить выбранные ${rowsToDelete.size} строк?`)) {
        return;
    }

    try {
        const data = JSON.parse(jsonData);
        const rowsArray = Array.from(rowsToDelete);
        const indicesToDelete = [];

        // Получаем индексы строк для удаления
        rowsArray.forEach(row => {
            const rowIndex = Array.from(row.parentElement.children).indexOf(row);
            if (rowIndex !== -1) {
                indicesToDelete.push(rowIndex);
            }
        });

        // Сортируем индексы по убыванию и удаляем
        indicesToDelete.sort((a, b) => b - a).forEach(index => {
            data.table_data.splice(index, 1);
        });

        // Обновляем данные
        jsonData = JSON.stringify(data, null, 2);
        displayJSON(jsonData);

        showNotification(`Удалено ${indicesToDelete.length} строк`, 'success');

    } catch (error) {
        console.error('Ошибка при удалении строк:', error);
        showNotification('Ошибка при удалении строк', 'error');
    }
}

function addNewColumn() {
    const colName = prompt('Введите имя новой колонки (например: column_31):', 'column_31');
    if (!colName) return;

    try {
        const data = JSON.parse(jsonData);

        // Добавляем новую колонку всем строкам
        data.table_data.forEach(row => {
            row[colName] = '';
        });

        // Обновляем данные
        jsonData = JSON.stringify(data, null, 2);
        displayJSON(jsonData);

        showNotification(`Добавлена новая колонка: ${colName}`, 'success');

    } catch (error) {
        console.error('Ошибка при добавлении колонки:', error);
        showNotification('Ошибка при добавлении колонки', 'error');
    }
}

function deleteSelectedColumns() {
    const selectedCells = document.querySelectorAll('#tableBody td.selected-cell');
    const columnsToDelete = new Set();

    selectedCells.forEach(cell => {
        const cellIndex = Array.from(cell.parentElement.children).indexOf(cell);
        if (cellIndex !== -1) {
            columnsToDelete.add(cellIndex);
        }
    });

    // Получаем имена колонок для удаления
    const headers = document.querySelectorAll('#tableHeader th');
    const columnNames = [];

    columnsToDelete.forEach(index => {
        if (index < headers.length) {
            let colName = headers[index].textContent.trim();
            if (colName === 'Characteristic') {
                colName = 'characteristic';
            } else if (colName.startsWith('Col ')) {
                colName = colName.toLowerCase().replace('col ', 'column_');
            }
            columnNames.push(colName);
        }
    });

    if (columnNames.length === 0) {
        alert('Выберите колонки для удаления (Ctrl+клик на ячейки в нужных колонках)');
        return;
    }

    if (!confirm(`Удалить выбранные ${columnNames.length} колонок?`)) {
        return;
    }

    try {
        const data = JSON.parse(jsonData);

        // Удаляем колонки из всех строк
        data.table_data.forEach(row => {
            columnNames.forEach(colName => {
                delete row[colName];
            });
        });

        // Обновляем данные
        jsonData = JSON.stringify(data, null, 2);
        displayJSON(jsonData);

        showNotification(`Удалено ${columnNames.length} колонок`, 'success');

    } catch (error) {
        console.error('Ошибка при удалении колонок:', error);
        showNotification('Ошибка при удалении колонок', 'error');
    }
}

function selectAllCells() {
    const cells = document.querySelectorAll('#tableBody td.editable-cell');
    cells.forEach(cell => {
        cell.classList.add('selected-cell');
    });
}

function addEditButtonToTable() {
    // Удаляем старую кнопку, если есть
    const oldBtn = document.querySelector('.edit-mode-btn');
    if (oldBtn) oldBtn.remove();

    if (!jsonData) return;

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-primary edit-mode-btn';
    editBtn.innerHTML = '<i class="fas fa-edit"></i> Режим редактирования';
    editBtn.onclick = toggleEditMode;
    editBtn.style.position = 'absolute';
    editBtn.style.top = '10px';
    editBtn.style.right = '10px';
    editBtn.style.zIndex = '10';

    const tableHeader = document.querySelector('.table-header');
    if (tableHeader) {
        tableHeader.style.position = 'relative';
        tableHeader.appendChild(editBtn);
    }
}

const originalDisplayTable = displayTable;
displayTable = function(tableData) {
    // Вызываем оригинальную функцию
    originalDisplayTable(tableData);

    // Добавляем кнопку редактирования
    setTimeout(() => {
        addEditButtonToTable();
    }, 100);
};

if (document.getElementById('editTableBtn')) {
    document.getElementById('editTableBtn').addEventListener('click', function() {
        toggleEditMode();
    });
}

function analyzeRows() {
    const rows = document.querySelectorAll('#tableBody tr');
    const result = {
        total: rows.length,
        empty: 0,
        withData: 0,
        details: []
    };

    rows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        let isEmpty = true;
        const values = [];

        // Проверяем все ячейки кроме characteristic
        for (let i = 1; i < cells.length; i++) {
            const value = cells[i].textContent.trim();
            values.push(value);
            if (value && value !== '—' && value !== '') {
                isEmpty = false;
            }
        }

        result.details.push({
            index: index,
            characteristic: cells[0].textContent.trim(),
            isEmpty: isEmpty,
            values: values
        });

        if (isEmpty) {
            result.empty++;
        } else {
            result.withData++;
        }
    });

    console.log('Анализ строк:', result);
    return result;
}

function deleteEmptyColumns() {
    const table = document.getElementById('dataTable');
    if (!table) {
        showNotification('Таблица не найдена', 'warning');
        return;
    }

    const headers = table.querySelectorAll('#tableHeader th');
    const rows = table.querySelectorAll('#tableBody tr');

    if (rows.length === 0) {
        showNotification('Нет данных в таблице', 'warning');
        return;
    }

    // Находим пустые колонки
    const emptyColumnIndices = [];

    // Проверяем каждую колонку (кроме characteristic)
    for (let colIndex = 1; colIndex < headers.length; colIndex++) {
        let isEmpty = true;

        // Проверяем все строки в этой колонке
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const cells = rows[rowIndex].querySelectorAll('td');
            if (colIndex < cells.length) {
                const value = cells[colIndex].textContent.trim();
                if (value && value !== '—' && value !== '') {
                    isEmpty = false;
                    break;
                }
            }
        }

        if (isEmpty) {
            emptyColumnIndices.push(colIndex);
        }
    }

    if (emptyColumnIndices.length === 0) {
        showNotification('Нет пустых колонок для удаления', 'info');
        return;
    }

    // Подтверждение удаления
    if (!confirm(`Удалить ${emptyColumnIndices.length} пустых колонок? Это действие нельзя отменить!`)) {
        return;
    }

    try {
        // Получаем текущие данные
        const jsonText = elements.jsonOutput.textContent;
        const data = JSON.parse(jsonText);

        if (!data.table_data || !Array.isArray(data.table_data)) {
            throw new Error('Нет табличных данных');
        }

        // Получаем имена колонок для удаления
        const columnsToDelete = [];
        emptyColumnIndices.forEach(colIndex => {
            const header = headers[colIndex];
            if (header) {
                let colName = header.textContent.trim();
                if (colName.startsWith('Col ')) {
                    colName = colName.toLowerCase().replace('col ', 'column_');
                }
                columnsToDelete.push(colName);
            }
        });

        // Удаляем колонки из всех строк
        data.table_data.forEach(row => {
            columnsToDelete.forEach(colName => {
                delete row[colName];
            });
        });

        // Обновляем JSON
        elements.jsonOutput.textContent = JSON.stringify(data, null, 2);
        highlightJSON();

        // Обновляем таблицу
        if (elements.tableView.style.display === 'block') {
            displayTable(data.table_data);
        }

        // Обновляем глобальные данные
        jsonData = JSON.stringify(data);

        console.log(`Удалено ${emptyColumnIndices.length} пустых колонок:`, columnsToDelete);
        showNotification(`Удалено ${emptyColumnIndices.length} пустых колонок`, 'success');

    } catch (error) {
        console.error('Ошибка при удалении пустых колонок:', error);
        showNotification('Ошибка при удалении пустых колонок', 'error');
    }
}

function analyzeColumns() {
    const table = document.getElementById('dataTable');
    if (!table) return null;

    const headers = table.querySelectorAll('#tableHeader th');
    const rows = table.querySelectorAll('#tableBody tr');

    const columnAnalysis = [];

    // Проверяем каждую колонку
    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
        const header = headers[colIndex];
        const columnName = header.textContent.trim();

        let totalCells = 0;
        let emptyCells = 0;
        let nonEmptyCells = 0;

        // Анализируем данные в колонке
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const cells = rows[rowIndex].querySelectorAll('td');
            if (colIndex < cells.length) {
                totalCells++;
                const value = cells[colIndex].textContent.trim();
                if (value && value !== '—' && value !== '') {
                    nonEmptyCells++;
                } else {
                    emptyCells++;
                }
            }
        }

        columnAnalysis.push({
            index: colIndex,
            name: columnName,
            totalCells: totalCells,
            emptyCells: emptyCells,
            nonEmptyCells: nonEmptyCells,
            isEmpty: nonEmptyCells === 0,
            emptyPercentage: totalCells > 0 ? (emptyCells / totalCells * 100).toFixed(1) : 100
        });
    }

    console.log('Анализ колонок:', columnAnalysis);
    return columnAnalysis;
}

function showColumnStats() {
    const analysis = analyzeColumns();
    if (!analysis) return;

    let message = '📊 Статистика колонок:\n\n';

    analysis.forEach((col, index) => {
        if (index === 0) return; // Пропускаем characteristic

        const status = col.isEmpty ? '🔴 ПУСТАЯ' : '🟢 С данными';
        message += `${index}. ${col.name}: ${status}\n`;
        message += `   Заполнено: ${col.nonEmptyCells}/${col.totalCells} (${col.emptyPercentage}% пустых)\n`;
        message += `   ${col.isEmpty ? '✅ Может быть удалена' : '❌ Не может быть удалена'}\n\n`;
    });

    // Подсчитываем пустые колонки
    const emptyCols = analysis.filter(col => col.index > 0 && col.isEmpty);
    const totalCols = analysis.length - 1; // Минус characteristic

    message += `\n📈 Итоги:\n`;
    message += `Всего колонок: ${totalCols}\n`;
    message += `Пустых колонок: ${emptyCols.length}\n`;
    message += `Процент пустых: ${(emptyCols.length / totalCols * 100).toFixed(1)}%\n`;

    alert(message);

    if (emptyCols.length > 0) {
        const colNames = emptyCols.map(col => col.name).join(', ');
        console.log('Пустые колонки для удаления:', colNames);

        if (confirm(`Найдено ${emptyCols.length} пустых колонок. Удалить их?`)) {
            deleteEmptyColumns();
        }
    }
}

function addStatsButton() {
    const controls = document.getElementById('tableControls');
    if (!controls) return;

    const statsBtn = document.createElement('button');
    statsBtn.className = 'btn btn-small btn-info';
    statsBtn.id = 'showStatsBtn';
    statsBtn.innerHTML = '<i class="fas fa-chart-bar"></i> Статистика';
    statsBtn.title = 'Показать статистику колонок и строк';
    statsBtn.onclick = showColumnStats;

    const columnGroup = controls.querySelector('.control-group');
    if (columnGroup) {
        columnGroup.appendChild(statsBtn);
    }
}

function deleteEmptyColumnsDOM() {
    const table = document.getElementById('dataTable');
    if (!table) {
        showNotification('Таблица не найдена', 'warning');
        return;
    }

    const headers = table.querySelectorAll('#tableHeader th');
    const rows = table.querySelectorAll('#tableBody tr');

    if (rows.length === 0) {
        showNotification('Таблица пуста', 'warning');
        return;
    }

    // Находим пустые колонки (кроме characteristic)
    const emptyColumnIndices = [];

    for (let colIndex = 1; colIndex < headers.length; colIndex++) {
        let isEmpty = true;

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const cells = rows[rowIndex].querySelectorAll('td');
            if (colIndex < cells.length) {
                const value = cells[colIndex].textContent.trim();
                if (value && value !== '—' && value !== '') {
                    isEmpty = false;
                    break;
                }
            }
        }

        if (isEmpty) {
            emptyColumnIndices.push(colIndex);
        }
    }

    if (emptyColumnIndices.length === 0) {
        showNotification('Нет пустых колонок', 'info');
        return;
    }

    if (!confirm(`Удалить ${emptyColumnIndices.length} пустых колонок?`)) {
        return;
    }

    try {
        // Удаляем из DOM
        // Заголовки
        emptyColumnIndices.reverse().forEach(colIndex => {
            const header = headers[colIndex];
            if (header && header.parentNode) {
                header.parentNode.removeChild(header);
            }
        });

        // Ячейки
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            emptyColumnIndices.forEach(colIndex => {
                if (colIndex < cells.length) {
                    const cell = cells[colIndex];
                    if (cell && cell.parentNode) {
                        cell.parentNode.removeChild(cell);
                    }
                }
            });
        });

        // Обновляем данные JSON
        updateJSONFromTable();

        showNotification(`Удалено ${emptyColumnIndices.length} пустых колонок`, 'success');

    } catch (error) {
        console.error('Ошибка при удалении колонок:', error);
        showNotification('Ошибка при удалении колонок', 'error');
    }
}

function updateJSONFromTable() {
    const table = document.getElementById('dataTable');
    const headers = table.querySelectorAll('#tableHeader th');
    const rows = table.querySelectorAll('#tableBody tr');

    const tableData = [];

    // Собираем данные из таблицы
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const rowData = {};

        cells.forEach((cell, index) => {
            if (index === 0) {
                rowData.characteristic = cell.textContent.trim();
            } else if (index < headers.length) {
                const headerText = headers[index].textContent;
                const columnName = headerText.startsWith('Col ') ?
                    `column_${headerText.replace('Col ', '')}` :
                    headerText.toLowerCase();
                rowData[columnName] = cell.textContent.trim();
            }
        });

        tableData.push(rowData);
    });

    // Обновляем JSON
    const data = { table_data: tableData };
    jsonData = JSON.stringify(data, null, 2);
    elements.jsonOutput.textContent = jsonData;
    highlightJSON();
}

function deleteEmptyColumnsSimple() {
    console.log('Функция deleteEmptyColumnsSimple вызвана');

    try {
        // Получаем текущие данные
        const jsonText = elements.jsonOutput.textContent;
        const data = JSON.parse(jsonText);

        if (!data.table_data || !Array.isArray(data.table_data)) {
            showNotification('Нет табличных данных', 'warning');
            return;
        }

        if (data.table_data.length === 0) {
            showNotification('Таблица пуста', 'warning');
            return;
        }

        // Находим все уникальные колонки (кроме characteristic)
        const allColumns = new Set();
        data.table_data.forEach(row => {
            Object.keys(row).forEach(key => {
                if (key !== 'characteristic') {
                    allColumns.add(key);
                }
            });
        });

        // Находим пустые колонки
        const emptyColumns = [];
        allColumns.forEach(colName => {
            let isEmpty = true;

            data.table_data.forEach(row => {
                const value = row[colName];
                if (value !== undefined && value !== null && value !== '' && String(value).trim() !== '') {
                    isEmpty = false;
                }
            });

            if (isEmpty) {
                emptyColumns.push(colName);
            }
        });

        if (emptyColumns.length === 0) {
            showNotification('Нет пустых колонок для удаления', 'info');
            return;
        }

        // Подтверждение
        if (!confirm(`Удалить ${emptyColumns.length} пустых колонок?\n\n${emptyColumns.join(', ')}`)) {
            return;
        }

        // Удаляем пустые колонки
        const cleanedData = data.table_data.map(row => {
            const newRow = { characteristic: row.characteristic };

            // Копируем только непустые колонки
            Object.keys(row).forEach(key => {
                if (key !== 'characteristic' && !emptyColumns.includes(key)) {
                    newRow[key] = row[key];
                }
            });

            return newRow;
        });

        // Обновляем данные
        data.table_data = cleanedData;

        // Обновляем JSON
        elements.jsonOutput.textContent = JSON.stringify(data, null, 2);
        highlightJSON();

        // Обновляем таблицу, если она видна
        if (elements.tableView.style.display === 'block') {
            displayTable(data.table_data);
        }

        // Сохраняем глобальные данные
        jsonData = JSON.stringify(data);

        showNotification(`Удалено ${emptyColumns.length} пустых колонок`, 'success');
        console.log('Удалены колонки:', emptyColumns);

    } catch (error) {
        console.error('Ошибка при удалении пустых колонок:', error);
        showNotification('Ошибка при удалении колонок: ' + error.message, 'error');
    }
}

const buttonHandlers = {
    // ... существующие обработчики
    'deleteEmptyColumnsBtn': deleteEmptyColumnsSimple, // или deleteEmptyColumns
    // ... остальные обработчики
};

console.log('Кнопка удаления колонок:', document.getElementById('deleteEmptyColumnsBtn'));
console.log('Функция deleteEmptyColumnsSimple:', typeof deleteEmptyColumnsSimple);
document.getElementById('deleteEmptyColumnsBtn')?.click();

document.addEventListener('DOMContentLoaded', function() {
    // Ждем полной загрузки страницы
    setTimeout(function() {
        const deleteBtn = document.getElementById('deleteEmptyColumnsBtn');
        if (deleteBtn) {
            console.log('Кнопка "Удалить пустые колонки" найдена, добавляем прямой обработчик');

            // Удаляем все старые обработчики
            const newBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newBtn, deleteBtn);

            // Добавляем новый обработчик
            document.getElementById('deleteEmptyColumnsBtn').addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Кнопка "Удалить пустые колонки" нажата (прямой обработчик)');
                deleteEmptyColumnsSimple();
            });
        }
    }, 2000);
});

// Запуск приложения
document.addEventListener('DOMContentLoaded', init);

// Функции экспорта таблицы
function setupExportDropdown() {
    const exportBtn = document.getElementById('exportDropdownBtn');
    const dropdown = document.getElementById('exportDropdown');

    if (!exportBtn || !dropdown) return;

    // Показываем/скрываем dropdown
    exportBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    // Закрываем dropdown при клике вне его
    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target) && !exportBtn.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    // Обработчики для кнопок экспорта
    document.getElementById('exportExcelBtn')?.addEventListener('click', exportToExcel);
    document.getElementById('exportPdfBtn')?.addEventListener('click', exportToPDF);
    document.getElementById('exportCsvBtn')?.addEventListener('click', exportToCSV);
    document.getElementById('exportJsonBtn')?.addEventListener('click', exportToJSON);
}

function exportToExcel() {
    try {
        const data = JSON.parse(jsonData);
        if (!data.table_data || !Array.isArray(data.table_data) || data.table_data.length === 0) {
            throw new Error('Нет табличных данных для экспорта');
        }

        // Создаем новую книгу Excel
        const wb = XLSX.utils.book_new();

        // Подготавливаем данные
        const wsData = [];

        // Заголовки
        const headers = ['Characteristic'];
        const firstRow = data.table_data[0];

        // Получаем все колонки кроме characteristic
        const columns = Object.keys(firstRow || {}).filter(key => key !== 'characteristic');

        // Сортируем колонки по номеру
        columns.sort((a, b) => {
            const numA = parseInt(a.replace('column_', '')) || 0;
            const numB = parseInt(b.replace('column_', '')) || 0;
            return numA - numB;
        });

        headers.push(...columns);
        wsData.push(headers);

        // Данные
        data.table_data.forEach(row => {
            const rowData = [row.characteristic || ''];
            columns.forEach(col => {
                rowData.push(row[col] || '');
            });
            wsData.push(rowData);
        });

        // Создаем worksheet
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Настраиваем ширину колонок
        const colWidths = headers.map((header, index) => {
            let maxLength = header.length;
            data.table_data.forEach(row => {
                const cellValue = index === 0
                    ? String(row.characteristic || '')
                    : String(row[columns[index-1]] || '');
                maxLength = Math.max(maxLength, cellValue.length);
            });
            return { wch: Math.min(Math.max(maxLength, 10), 50) };
        });
        ws['!cols'] = colWidths;

        // Добавляем стили (если нужно)
        // Для более продвинутого форматирования можно использовать xlsx-style

        // Добавляем worksheet в книгу
        XLSX.utils.book_append_sheet(wb, ws, 'Table Data');

        // Генерируем файл
        const fileName = `table_export_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, fileName);

        showNotification('Таблица экспортирована в Excel', 'success');

    } catch (error) {
        console.error('Ошибка при экспорте в Excel:', error);
        showNotification('Ошибка экспорта: ' + error.message, 'error');
    }
}

function exportToPDF() {
    try {
        const data = JSON.parse(jsonData);
        if (!data.table_data || !Array.isArray(data.table_data) || data.table_data.length === 0) {
            throw new Error('Нет данных для экспорта');
        }

        // Импортируем jsPDF
        const { jsPDF } = window.jspdf;

        // Создаем PDF с поддержкой кириллицы
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Добавляем поддержку кириллицы (стандартный шрифт поддерживает русские буквы)
        pdf.setFont("helvetica");

        const pageWidth = pdf.internal.pageSize.width;
        const pageHeight = pdf.internal.pageSize.height;
        const margin = 10;
        let y = margin;

        // Заголовок - используем английский или простой текст
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.text("TABLE EXPORT", pageWidth / 2, y, { align: "center" });
        y += 8;

        // Информация на английском
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        const exportDate = new Date().toLocaleDateString('en-GB');
        pdf.text(`Export date: ${exportDate}`, margin, y);
        pdf.text(`Total rows: ${data.table_data.length}`, pageWidth - margin, y, { align: "right" });
        y += 10;

        // Получаем все колонки из данных
        const allColumns = new Set();
        data.table_data.forEach(row => {
            Object.keys(row).forEach(key => {
                if (key !== 'characteristic') {
                    allColumns.add(key);
                }
            });
        });

        // Сортируем колонки по номеру
        const sortedColumns = Array.from(allColumns).sort((a, b) => {
            const numA = parseInt(a.replace('column_', '')) || 0;
            const numB = parseInt(b.replace('column_', '')) || 0;
            return numA - numB;
        });

        // Ограничиваем количество колонок для читаемости
        const maxColumns = Math.min(sortedColumns.length, 15);
        const displayColumns = sortedColumns.slice(0, maxColumns);

        // Рассчитываем ширину колонок
        const tableWidth = pageWidth - (2 * margin);
        const charColWidth = 35; // Ширина для характеристики
        const dataColWidth = (tableWidth - charColWidth - 10) / Math.max(displayColumns.length, 1);

        // Заголовки таблицы (на английском)
        const headers = ['#', 'Characteristic', ...displayColumns.map(col =>
            `Col ${col.replace('column_', '')}`
        )];

        // Подготавливаем данные
        const tableData = [];
        const maxRows = Math.min(data.table_data.length, 100);

        for (let i = 0; i < maxRows; i++) {
            const row = data.table_data[i];
            const rowData = [
                (i + 1).toString(),
                row.characteristic || '',
                ...displayColumns.map(col => row[col] || '')
            ];
            tableData.push(rowData);
        }

        // Стили для заголовков
        pdf.setFillColor(44, 62, 80); // Темно-синий
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");

        // Рисуем заголовки таблицы
        let x = margin;
        const headerHeight = 6;

        // Номер
        pdf.rect(x, y, 10, headerHeight, 'F');
        pdf.text('#', x + 3, y + 4);
        x += 10;

        // Характеристика
        pdf.rect(x, y, charColWidth, headerHeight, 'F');
        pdf.text('Characteristic', x + 2, y + 4);
        x += charColWidth;

        // Колонки
        displayColumns.forEach((col, index) => {
            pdf.rect(x, y, dataColWidth, headerHeight, 'F');
            const colNum = col.replace('column_', '');
            pdf.text(colNum, x + dataColWidth/2, y + 4, { align: 'center' });
            x += dataColWidth;
        });

        y += headerHeight;

        // Рисуем данные
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(0, 0, 0);

        const rowHeight = 5;

        tableData.forEach((row, rowIndex) => {
            // Проверяем, нужна ли новая страница
            if (y + rowHeight > pageHeight - margin - 10) {
                pdf.addPage();
                y = margin;

                // Рисуем заголовки на новой странице
                x = margin;
                pdf.setFillColor(44, 62, 80);
                pdf.setTextColor(255, 255, 255);
                pdf.setFont("helvetica", "bold");

                // Номер
                pdf.rect(x, y, 10, headerHeight, 'F');
                pdf.text('#', x + 3, y + 4);
                x += 10;

                // Характеристика
                pdf.rect(x, y, charColWidth, headerHeight, 'F');
                pdf.text('Characteristic', x + 2, y + 4);
                x += charColWidth;

                // Колонки
                displayColumns.forEach((col, index) => {
                    pdf.rect(x, y, dataColWidth, headerHeight, 'F');
                    const colNum = col.replace('column_', '');
                    pdf.text(colNum, x + dataColWidth/2, y + 4, { align: 'center' });
                    x += dataColWidth;
                });

                y += headerHeight;

                // Возвращаем стили для данных
                pdf.setFont("helvetica", "normal");
                pdf.setTextColor(0, 0, 0);
            }

            // Рисуем строку
            x = margin;

            // Чередующийся цвет фона
            if (rowIndex % 2 === 0) {
                pdf.setFillColor(248, 249, 250); // Светло-серый
                let fillX = margin;

                // Номер
                pdf.rect(fillX, y, 10, rowHeight, 'F');
                fillX += 10;

                // Характеристика
                pdf.rect(fillX, y, charColWidth, rowHeight, 'F');
                fillX += charColWidth;

                // Колонки
                displayColumns.forEach(() => {
                    pdf.rect(fillX, y, dataColWidth, rowHeight, 'F');
                    fillX += dataColWidth;
                });
            }

            // Номер строки
            pdf.text(row[0], x + 3, y + 3.5, { align: 'center' });
            x += 10;

            // Характеристика (обрезаем если слишком длинная)
            const characteristic = row[1] || '';
            const maxCharLength = 30;
            const displayChar = characteristic.length > maxCharLength
                ? characteristic.substring(0, maxCharLength - 3) + '...'
                : characteristic;
            pdf.text(displayChar, x + 2, y + 3.5);
            x += charColWidth;

            // Значения колонок
            row.slice(2).forEach((cell, cellIndex) => {
                const cellValue = String(cell || '');

                // Устанавливаем цвет в зависимости от значения
                if (cellValue === '+') {
                    pdf.setTextColor(16, 185, 129); // Green
                } else if (cellValue === '-') {
                    pdf.setTextColor(239, 68, 68); // Red
                } else if (cellValue === '?') {
                    pdf.setTextColor(245, 158, 11); // Orange
                } else if (cellValue.toUpperCase() === 'W') {
                    pdf.setTextColor(139, 92, 246); // Purple
                } else if (cellValue.toUpperCase() === 'ND') {
                    pdf.setTextColor(156, 163, 175); // Gray
                } else {
                    pdf.setTextColor(0, 0, 0); // Black
                }

                // Центрируем текст
                pdf.text(cellValue, x + dataColWidth/2, y + 3.5, { align: 'center' });
                x += dataColWidth;

                // Сбрасываем цвет
                pdf.setTextColor(0, 0, 0);
            });

            y += rowHeight;
        });

        // Легенда на английском
        y = pageHeight - margin - 10;
        pdf.setFontSize(7);
        pdf.setTextColor(102, 102, 102);
        pdf.text("Legend: + (positive)  - (negative)  ? (unknown)  W (weak positive)  ND (no data)",
            margin, y);

        // Номер страницы
        pdf.text("Page 1", pageWidth - margin, pageHeight - margin, { align: "right" });

        // Сохраняем PDF
        const fileName = `table_export_${new Date().toISOString().slice(0, 10)}.pdf`;
        pdf.save(fileName);

        showNotification('PDF successfully created', 'success');

    } catch (error) {
        console.error('Error creating PDF:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

// Функция для рисования таблицы
function drawTable(pdf, tableData, headers, options) {
    const {
        startX,
        startY,
        tableWidth,
        charColWidth,
        dataColWidth,
        headerStyle,
        cellStyle,
        margin,
        pageHeight
    } = options;

    const colCount = headers.length;
    const rowHeight = 6;
    let x = startX;
    let y = startY;
    let currentPage = 1;

    // Рисуем заголовки
    pdf.setFillColor(...headerStyle.fillColor);
    pdf.setTextColor(...headerStyle.textColor);
    pdf.setFont("helvetica", headerStyle.fontStyle);
    pdf.setFontSize(headerStyle.fontSize);

    headers.forEach((header, colIndex) => {
        // Рассчитываем ширину колонки
        let colWidth;
        if (colIndex === 0) {
            colWidth = 8; // Для номера
        } else if (colIndex === 1) {
            colWidth = charColWidth; // Для характеристики
        } else {
            colWidth = dataColWidth; // Для остальных колонок
        }

        // Рисуем ячейку заголовка
        pdf.rect(x, y, colWidth, rowHeight, 'F');

        // Текст заголовка
        const text = colIndex === 0 ? '№' :
                    colIndex === 1 ? 'Characteristic' :
                    header;

        const maxTextWidth = colWidth - 4; // Минус отступы
        const textWidth = pdf.getTextWidth(text);
        let displayText = text;

        if (textWidth > maxTextWidth) {
            // Укорачиваем текст если не помещается
            for (let i = text.length - 1; i > 0; i--) {
                const shortText = text.substring(0, i) + '...';
                if (pdf.getTextWidth(shortText) <= maxTextWidth) {
                    displayText = shortText;
                    break;
                }
            }
        }

        pdf.text(displayText, x + 2, y + rowHeight - 2);
        x += colWidth;
    });

    y += rowHeight;

    // Рисуем данные
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(cellStyle.fontSize);
    pdf.setTextColor(...cellStyle.textColor);

    tableData.forEach((row, rowIndex) => {
        // Проверяем, нужна ли новая страница
        if (y + rowHeight > pageHeight - margin - 10) {
            pdf.addPage();
            currentPage++;
            y = margin;

            // Повторяем заголовки на новой странице
            x = startX;
            pdf.setFillColor(...headerStyle.fillColor);
            pdf.setTextColor(...headerStyle.textColor);
            pdf.setFont("helvetica", headerStyle.fontStyle);
            pdf.setFontSize(headerStyle.fontSize);

            headers.forEach((header, colIndex) => {
                let colWidth;
                if (colIndex === 0) {
                    colWidth = 8;
                } else if (colIndex === 1) {
                    colWidth = charColWidth;
                } else {
                    colWidth = dataColWidth;
                }

                pdf.rect(x, y, colWidth, rowHeight, 'F');

                const text = colIndex === 0 ? '№' :
                            colIndex === 1 ? 'Characteristic' :
                            header;

                const maxTextWidth = colWidth - 4;
                const textWidth = pdf.getTextWidth(text);
                let displayText = text;

                if (textWidth > maxTextWidth) {
                    for (let i = text.length - 1; i > 0; i--) {
                        const shortText = text.substring(0, i) + '...';
                        if (pdf.getTextWidth(shortText) <= maxTextWidth) {
                            displayText = shortText;
                            break;
                        }
                    }
                }

                pdf.text(displayText, x + 2, y + rowHeight - 2);
                x += colWidth;
            });

            y += rowHeight;
        }

        // Рисуем строку данных
        x = startX;

        row.forEach((cell, colIndex) => {
            // Рассчитываем ширину колонки
            let colWidth;
            if (colIndex === 0) {
                colWidth = 8;
            } else if (colIndex === 1) {
                colWidth = charColWidth;
            } else {
                colWidth = dataColWidth;
            }

            // Чередуем цвет фона строк
            if (rowIndex % 2 === 0) {
                pdf.setFillColor(248, 249, 250);
                pdf.rect(x, y, colWidth, rowHeight, 'F');
            }

            // Рисуем границу
            pdf.setDrawColor(200, 200, 200);
            pdf.rect(x, y, colWidth, rowHeight);

            // Устанавливаем цвет текста в зависимости от значения
            const cellValue = String(cell || '');
            if (cellValue === '+') {
                pdf.setTextColor(16, 185, 129); // Зеленый
            } else if (cellValue === '-') {
                pdf.setTextColor(239, 68, 68); // Красный
            } else if (cellValue === '?') {
                pdf.setTextColor(245, 158, 11); // Оранжевый
            } else if (cellValue.toUpperCase() === 'W') {
                pdf.setTextColor(139, 92, 246); // Фиолетовый
            } else if (cellValue.toUpperCase() === 'ND') {
                pdf.setTextColor(156, 163, 175); // Серый
            } else {
                pdf.setTextColor(0, 0, 0); // Черный
            }

            // Отображаем текст с переносом
            const maxTextWidth = colWidth - 4;
            let displayText = cellValue;

            // Если текст слишком длинный, обрезаем его
            if (pdf.getTextWidth(cellValue) > maxTextWidth) {
                for (let i = cellValue.length - 1; i > 0; i--) {
                    const shortText = cellValue.substring(0, i);
                    if (pdf.getTextWidth(shortText) <= maxTextWidth) {
                        displayText = shortText;
                        break;
                    }
                }
            }

            // Центрируем текст для числовых колонок, левый край для характеристик
            const textX = colIndex <= 1 ? x + 2 : x + (colWidth / 2);
            const align = colIndex <= 1 ? 'left' : 'center';

            pdf.text(displayText, textX, y + rowHeight - 2, { align: align });

            x += colWidth;
        });

        y += rowHeight;

        // Сбрасываем цвет текста
        pdf.setTextColor(0, 0, 0);
    });

    // Информация о страницах
    pdf.setFontSize(7);
    pdf.setTextColor(102, 102, 102);
    pdf.text(`Страница ${currentPage}`, margin, pageHeight - margin);
}

// Альтернативная упрощенная версия для больших таблиц
function exportToPDFSimple() {
    try {
        const data = JSON.parse(jsonData);
        if (!data.table_data || !Array.isArray(data.table_data) || data.table_data.length === 0) {
            throw new Error('Нет данных для экспорта');
        }

        // Используем jsPDF autotable если доступен
        if (typeof pdf.autoTable !== 'undefined') {
            exportWithAutoTable(data);
            return;
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('l', 'mm', 'a4');

        const margin = 15;
        let y = margin;

        // Заголовок
        pdf.setFontSize(18);
        pdf.setFont("helvetica", "bold");
        pdf.text("ЭКСПОРТ ТАБЛИЦЫ", 148.5, y, { align: "center" });
        y += 8;

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Экспортировано: ${new Date().toLocaleString()}`, margin, y);
        pdf.text(`Строк: ${data.table_data.length}`, 280, y, { align: "right" });
        y += 15;

        // Получаем колонки
        const columns = [];
        const sampleRow = data.table_data[0];
        Object.keys(sampleRow).forEach(key => {
            if (key !== 'characteristic') {
                const colNum = parseInt(key.replace('column_', '')) || 0;
                columns.push({ key, num: colNum });
            }
        });

        columns.sort((a, b) => a.num - b.num);
        const displayColumns = columns.slice(0, 15); // Ограничиваем 15 колонками

        // Создаем заголовки
        const headers = ['№', 'Characteristic', ...displayColumns.map(col => `C${col.num}`)];

        // Создаем данные
        const tableData = [];
        const maxRows = Math.min(data.table_data.length, 100);

        for (let i = 0; i < maxRows; i++) {
            const row = data.table_data[i];
            const rowData = [
                (i + 1).toString(),
                row.characteristic || '',
                ...displayColumns.map(col => row[col.key] || '')
            ];
            tableData.push(rowData);
        }

        // Простая таблица без сложной логики
        const colWidths = [10, 40, ...Array(displayColumns.length).fill(15)];
        const rowHeight = 6;

        // Заголовки
        pdf.setFillColor(44, 62, 80);
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(9);

        let x = margin;
        headers.forEach((header, i) => {
            pdf.rect(x, y, colWidths[i], rowHeight, 'F');
            pdf.text(header.substring(0, 8), x + 2, y + 4);
            x += colWidths[i];
        });
        y += rowHeight;

        // Данные
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0);

        tableData.forEach((row, rowIndex) => {
            if (y > 190) { // Конец страницы
                pdf.addPage();
                y = margin;

                // Повторяем заголовки
                x = margin;
                pdf.setFillColor(44, 62, 80);
                pdf.setTextColor(255, 255, 255);
                headers.forEach((header, i) => {
                    pdf.rect(x, y, colWidths[i], rowHeight, 'F');
                    pdf.text(header.substring(0, 8), x + 2, y + 4);
                    x += colWidths[i];
                });
                y += rowHeight;

                pdf.setFontSize(8);
                pdf.setTextColor(0, 0, 0);
            }

            // Цвет фона для четных строк
            if (rowIndex % 2 === 0) {
                x = margin;
                pdf.setFillColor(248, 249, 250);
                colWidths.forEach(width => {
                    pdf.rect(x, y, width, rowHeight, 'F');
                    x += width;
                });
            }

            // Текст
            x = margin;
            row.forEach((cell, cellIndex) => {
                // Форматирование значений
                let displayCell = String(cell || '');
                if (displayCell.length > 8) {
                    displayCell = displayCell.substring(0, 7) + '...';
                }

                pdf.text(displayCell,
                    cellIndex === 1 ? x + 2 : x + colWidths[cellIndex] / 2,
                    y + 4,
                    { align: cellIndex === 1 ? 'left' : 'center' }
                );
                x += colWidths[cellIndex];
            });

            y += rowHeight;
        });

        // Сохраняем
        pdf.save(`table_${Date.now()}.pdf`);
        showNotification('PDF успешно создан', 'success');

    } catch (error) {
        console.error('Ошибка при создании PDF:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

// Если у вас есть autotable, используйте эту функцию
function exportWithAutoTable(data) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l', 'mm', 'a4');

    // Получаем колонки
    const columns = [];
    const sampleRow = data.table_data[0];
    Object.keys(sampleRow).forEach(key => {
        if (key !== 'characteristic') {
            const colNum = parseInt(key.replace('column_', '')) || 0;
            columns.push({ key, num: colNum, name: `C${colNum}` });
        }
    });

    columns.sort((a, b) => a.num - b.num);
    const displayColumns = columns.slice(0, 20);

    // Заголовки
    const headers = ['№', 'Characteristic', ...displayColumns.map(col => col.name)];

    // Данные
    const tableData = [];
    const maxRows = Math.min(data.table_data.length, 200);

    for (let i = 0; i < maxRows; i++) {
        const row = data.table_data[i];
        const rowData = [
            (i + 1).toString(),
            row.characteristic || '',
            ...displayColumns.map(col => row[col.key] || '')
        ];
        tableData.push(rowData);
    }

    // Создаем таблицу
    pdf.autoTable({
        head: [headers],
        body: tableData,
        startY: 20,
        theme: 'grid',
        styles: {
            fontSize: 7,
            cellPadding: 2,
            overflow: 'linebreak',
            lineColor: [200, 200, 200],
            lineWidth: 0.1
        },
        headStyles: {
            fillColor: [44, 62, 80],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8
        },
        alternateRowStyles: {
            fillColor: [248, 249, 250]
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 40, halign: 'left' }
        },
        margin: { top: 20 },
        didDrawPage: function(data) {
            // Заголовок на каждой странице
            pdf.setFontSize(10);
            pdf.text(`Страница ${data.pageNumber}`, data.settings.margin.left, 10);
        }
    });

    // Сохраняем
    pdf.save(`table_autotable_${Date.now()}.pdf`);
    showNotification('PDF с использованием AutoTable создан', 'success');
}

// Альтернативная функция для создания простого PDF
function createSimplePDF(data) {
    try {
        const pdf = new window.jspdf.jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // Заголовок
        pdf.setFontSize(16);
        pdf.setTextColor(44, 62, 80);
        pdf.text('Экспорт таблицы', 20, 20);

        pdf.setFontSize(10);
        pdf.setTextColor(127, 140, 141);
        pdf.text(`Создано: ${new Date().toLocaleString()}`, 20, 30);

        // Получаем колонки
        const columns = new Set();
        data.table_data.forEach(row => {
            Object.keys(row).forEach(key => {
                if (key !== 'characteristic') {
                    columns.add(key);
                }
            });
        });

        const sortedColumns = Array.from(columns).sort((a, b) => {
            const numA = parseInt(a.replace('column_', '')) || 0;
            const numB = parseInt(b.replace('column_', '')) || 0;
            return numA - numB;
        });

        // Ограничиваем количество колонок для читаемости
        const displayColumns = sortedColumns.slice(0, 15);
        const colWidth = 180 / (displayColumns.length + 1); // мм на колонку

        // Заголовки таблицы
        pdf.setFillColor(44, 62, 80);
        pdf.setTextColor(255, 255, 255);
        pdf.rect(20, 40, 180, 8, 'F');

        pdf.setFontSize(9);
        pdf.text('Characteristic', 22, 46);

        displayColumns.forEach((col, index) => {
            pdf.text(`Col ${col.replace('column_', '')}`, 22 + (colWidth * (index + 1)), 46);
        });

        // Данные таблицы (ограничиваем количество строк)
        const maxRows = Math.min(data.table_data.length, 50);
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0);

        for (let i = 0; i < maxRows; i++) {
            const row = data.table_data[i];
            const yPos = 50 + (i * 5);

            // Рисуем строку
            if (i % 2 === 0) {
                pdf.setFillColor(248, 249, 250);
                pdf.rect(20, yPos - 4, 180, 5, 'F');
            }

            // Характеристика
            const characteristic = row.characteristic || '';
            pdf.text(characteristic.substring(0, 30), 22, yPos);

            // Значения колонок
            displayColumns.forEach((col, index) => {
                const value = row[col] || '';
                pdf.text(value, 22 + (colWidth * (index + 1)), yPos);
            });
        }

        // Информация
        pdf.setFontSize(8);
        pdf.setTextColor(102, 102, 102);
        pdf.text(`Показано ${maxRows} из ${data.table_data.length} строк`, 20, 50 + (maxRows * 5) + 10);

        // Сохраняем PDF
        const fileName = `table_simple_${new Date().toISOString().slice(0,10)}.pdf`;
        pdf.save(fileName);

        showNotification('Таблица экспортирована в упрощенный PDF', 'info');

    } catch (error) {
        console.error('Ошибка при создании простого PDF:', error);
        showNotification('Не удалось создать PDF файл', 'error');
    }
}

function exportToCSV() {
    try {
        const data = JSON.parse(jsonData);
        if (!data.table_data || !Array.isArray(data.table_data)) {
            throw new Error('Нет табличных данных для экспорта');
        }

        // Создаем CSV
        let csv = '';

        // Находим все колонки
        const allColumns = new Set();
        data.table_data.forEach(row => {
            Object.keys(row).forEach(key => {
                if (key !== 'characteristic') {
                    allColumns.add(key);
                }
            });
        });

        // Сортируем колонки
        const sortedColumns = Array.from(allColumns).sort((a, b) => {
            const numA = parseInt(a.replace('column_', '')) || 0;
            const numB = parseInt(b.replace('column_', '')) || 0;
            return numA - numB;
        });

        // Заголовки
        const headers = ['Characteristic', ...sortedColumns];
        csv += headers.map(h => `"${h}"`).join(',') + '\n';

        // Данные
        data.table_data.forEach(row => {
            const rowData = [row.characteristic || ''];
            sortedColumns.forEach(col => {
                rowData.push(row[col] || '');
            });
            csv += rowData.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
        });

        // Создаем и скачиваем файл
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `table_export_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('Таблица экспортирована в CSV', 'success');

    } catch (error) {
        console.error('Ошибка при экспорте в CSV:', error);
        showNotification('Ошибка экспорта: ' + error.message, 'error');
    }
}

function exportToJSON() {
    try {
        if (!jsonData) {
            throw new Error('Нет данных для экспорта');
        }

        const data = JSON.parse(jsonData);
        const formattedData = JSON.stringify(data, null, 2);

        const blob = new Blob([formattedData], { type: 'application/json' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `table_export_${new Date().toISOString().slice(0,10)}.json`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('Таблица экспортирована в JSON', 'success');

    } catch (error) {
        console.error('Ошибка при экспорте в JSON:', error);
        showNotification('Ошибка экспорта: ' + error.message, 'error');
    }
}

// Улучшенная функция для Excel с форматированием
function exportToExcelWithFormatting() {
    try {
        const data = JSON.parse(jsonData);
        if (!data.table_data || !Array.isArray(data.table_data)) {
            throw new Error('Нет табличных данных для экспорта');
        }

        // Создаем новую книгу
        const wb = XLSX.utils.book_new();

        // Подготавливаем данные
        const wsData = [];

        // Заголовки
        const headers = ['№', 'Characteristic'];
        const columns = [];

        // Находим все колонки
        data.table_data.forEach(row => {
            Object.keys(row).forEach(key => {
                if (key !== 'characteristic' && !columns.includes(key)) {
                    columns.push(key);
                }
            });
        });

        // Сортируем колонки
        columns.sort((a, b) => {
            const numA = parseInt(a.replace('column_', '')) || 0;
            const numB = parseInt(b.replace('column_', '')) || 0;
            return numA - numB;
        });

        headers.push(...columns);
        wsData.push(headers);

        // Данные с номерами строк
        data.table_data.forEach((row, index) => {
            const rowData = [index + 1, row.characteristic || ''];
            columns.forEach(col => {
                rowData.push(row[col] || '');
            });
            wsData.push(rowData);
        });

        // Создаем worksheet
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Автоматическая ширина колонок
        const colWidths = headers.map((header, idx) => {
            let maxLength = header.length;
            wsData.forEach((row, rowIdx) => {
                if (rowIdx > 0) { // Пропускаем заголовки
                    const cellValue = String(row[idx] || '');
                    maxLength = Math.max(maxLength, cellValue.length);
                }
            });
            return { wch: Math.min(Math.max(maxLength + 2, 10), 30) };
        });

        ws['!cols'] = colWidths;

        // Добавляем фильтры
        ws['!autofilter'] = { ref: XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: wsData.length - 1, c: headers.length - 1 }
        })};

        // Добавляем закрепление первой строки
        ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomRight' };

        // Добавляем worksheet в книгу
        XLSX.utils.book_append_sheet(wb, ws, 'Table Data');

        // Добавляем информационный лист
        const infoData = [
            ['Информация об экспорте'],
            [''],
            ['Дата экспорта:', new Date().toLocaleString()],
            ['Количество строк:', data.table_data.length],
            ['Количество колонок:', columns.length + 1],
            [''],
            ['Обозначения:'],
            ['+', 'Положительный результат'],
            ['-', 'Отрицательный результат'],
            ['?', 'Неопределенный результат'],
            ['W', 'Слабоположительный'],
            ['ND', 'Нет данных']
        ];

        const infoWs = XLSX.utils.aoa_to_sheet(infoData);
        infoWs['!cols'] = [{ wch: 20 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, infoWs, 'Информация');

        // Сохраняем файл
        const fileName = `table_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, fileName);

        showNotification('Файл Excel успешно создан', 'success');

    } catch (error) {
        console.error('Ошибка при создании Excel файла:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

// Функция для включения/выключения кнопок экспорта
function updateExportButtons() {
    const exportBtn = document.getElementById('exportDropdownBtn');
    if (!exportBtn) return;

    // Проверяем, есть ли данные для экспорта
    const hasData = jsonData && jsonData !== '{"table_data": []}' && jsonData !== '';

    console.log('updateExportButtons вызвана. hasData:', hasData, 'jsonData:', jsonData?.substring(0, 100));

    // Включаем/выключаем кнопку
    exportBtn.disabled = !hasData;

    // Добавляем визуальную обратную связь
    if (hasData) {
        exportBtn.title = 'Экспорт табличных данных';
        exportBtn.classList.remove('disabled');
    } else {
        exportBtn.title = 'Нет данных для экспорта';
        exportBtn.classList.add('disabled');
    }
}

// Обновляем функцию displayJSON для включения кнопок экспорта
const originalDisplayJSON = displayJSON;
displayJSON = function(jsonStr) {
    originalDisplayJSON(jsonStr);
    updateExportButtons();
};

function forceEnableExport() {
    const exportBtn = document.getElementById('exportDropdownBtn');
    if (exportBtn) {
        exportBtn.disabled = false;
        console.log('Кнопка экспорта принудительно включена');
    }
}

// Добавьте эту функцию в обработчик клика по кнопке редактирования
if (document.getElementById('editTableBtn')) {
    document.getElementById('editTableBtn').addEventListener('click', function() {
        // Включаем кнопку экспорта при входе в режим редактирования
        forceEnableExport();
        toggleEditMode();
    });
}