# Курсив

Платформа обучения на React, Express и MongoDB. Курсы состоят из недель, дней и уроков. Автор редактирует урок прямо на странице: Markdown, изображения, видео, PDF/DOCX, ссылки, списки и разделители. Изменения автоматически сохраняются через 800 мс после последнего ввода.

## Запуск

Нужны Node.js 20+ и MongoDB 7+.

1. Скопируйте `.env.example` в `.env`. Замените `JWT_SECRET` случайной строкой длиной не менее 32 символов. Укажите свою `MONGODB_URI`, если база не запущена локально.
2. Установите зависимости:

   ```bash
   npm install
   npm install --prefix client
   npm install --prefix server
   ```

3. Запустите MongoDB. Пример для Docker:

   ```bash
   docker run -d --name course-studio-mongo -p 127.0.0.1:27017:27017 -v course_studio_mongo_data:/data/db mongo:7
   ```

4. Создайте первого администратора:

   ```bash
   cd server
   npm run create-admin -- ramazankantaev.dev@gmail.com ramazan2008 Рамазан Крутой
   cd ..
   ```

5. Выполните `npm run dev` в корне проекта и откройте http://localhost:5173.

При первом подключении к пустой базе автоматически создаётся демонстрационный курс с неделей, двумя днями и уроком. Учётные записи автоматически не создаются. Пароли и `JWT_SECRET` не входят в архив проекта.

## Роли

| Роль | Возможности |
| --- | --- |
| Администратор | Управляет пользователями и ролями, видит все курсы, статистику и прогресс учеников; редактирует любой курс. |
| Куратор | Регистрирует своих учеников, назначает им курсы, видит профили, уроки и прогресс. |
| Учитель | Создаёт и редактирует собственные курсы, недели, дни и уроки. |
| Ученик | Открывает назначенные курсы, отмечает уроки пройденными и видит свой прогресс. |

Все роли могут менять свой профиль: имя, фамилию, email, телефон, описание и аватар. Вход использует bcrypt для паролей и JWT сроком 12 часов. Сервер проверяет роль и право на конкретный курс. Загруженные файлы доступны после входа.

Прогресс вычисляется по записям о завершённых уроках: число пройденных уроков делится на число уроков в назначенном курсе. Отдельное поле процента не хранится.

## Основные API

| Ресурс | Методы |
| --- | --- |
| `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` | POST, POST, GET |
| `/api/profile` | PUT |
| `/api/dashboard` | GET |
| `/api/admin/users`, `/api/admin/users/:id` | GET/POST, PUT/DELETE |
| `/api/admin/stats`, `/api/admin/progress` | GET |
| `/api/curator/students`, `/api/curator/students/:id` | GET/POST, GET |
| `/api/curator/students/:id/courses` | PUT |
| `/api/progress/me`, `/api/progress/users/:id` | GET |
| `/api/progress/lessons/:id/complete` | POST/DELETE |
| `/api/courses`, `/api/courses/:id` | GET/POST, GET/PUT/DELETE |
| `/api/weeks`, `/api/weeks/:id` | POST, PUT/DELETE |
| `/api/days`, `/api/days/:id` | POST, PUT/DELETE |
| `/api/lessons`, `/api/lessons/:id` | POST, GET/PUT/DELETE |
| `/api/upload`, `/api/upload/:id` | POST/DELETE |

Публично доступны главная страница и список курсов. Для чтения содержания курса нужен вход. Размер файла до 100 МБ; разрешены JPG, PNG, WebP, GIF, MP4, WebM, PDF и DOCX.

## Структура

`client/src/pages` — страницы и кабинеты, `components` — общие элементы, `layouts` — header, `editor` — существующий редактор блоков, `hooks` — автосохранение, `services` — API и навигация. `server/models` — Mongoose-модели, `routes` — API, `controllers` — дерево курсов и расчёт прогресса, `middleware` — проверка JWT и прав.
