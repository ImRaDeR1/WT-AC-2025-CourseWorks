# Курсовой проект — Вариант 42 «Учебные группы» (task_02)

MVP по варианту 42:
- Группы подготовки (StudyGroup)
- Темы (Topic)
- Встречи (Meeting)
- Материалы (Material)
- Задачи (Task)
- Чат — заглушка (без real-time)

Бонусы (реализовано):
- Прогресс по темам: `Topic.isDone` + `Topic.doneAt`, чекбоксы в UI + проценты
- Экспорт календаря `.ics` по встречам + напоминания (`VALARM`)
- Документация API: OpenAPI JSON + Swagger UI
- Тесты: минимальные интеграционные тесты (Vitest + Supertest)
- CI: GitHub Actions workflow
- Kubernetes: манифесты для Postgres + API

## Структура

- `apps/server` — backend (REST API)
- `apps/web` — frontend (SPA)

## Модули разработки (поэтапно)

1) Каркас проекта (workspaces, конфиги)
2) Backend skeleton (healthcheck, формат ответов, ошибки)
3) DB + миграции (User/Group/Membership/Topic/Meeting/Material/Task)
4) Auth + RBAC/scope по membership
5) MVP endpoints варианта 42
6) Frontend MVP экраны
7) Docker Compose + инструкция запуска

## Быстрый старт (будет дополнено по мере модулей)

- Требования: Node.js LTS, npm.

Из корня `task_02`:

1 Установка зависимостей

`npm install`

2 Запуск backend

`npm run dev:server`

- Healthcheck: `GET http://localhost:3001/health`
- Swagger UI: `http://localhost:3001/docs`
- OpenAPI JSON: `http://localhost:3001/openapi.json`

3 Запуск frontend (в отдельном терминале)

`npm run dev:web`

### Альтернатива: запуск backend через Docker Compose

Если не хочешь поднимать backend через `npm`, можно запустить Postgres + API одной командой:

`docker compose up -d`

Важно: если ты запускаешь API в Docker (`api` слушает `3001`), то **не запускай параллельно** `npm run dev:server` на хосте — будет конфликт порта.

Демо-данные (опционально):

- Засидить (после `docker compose up -d`):

`docker compose run --rm api npm run db:seed`

- Дефолтные учётки из seed:
- `admin@example.com` / `password123`
- `user@example.com` / `password123`
- Демо-группа: `00000000-0000-0000-0000-000000000042`

## База данных (PostgreSQL) + Prisma

`docker compose up -d db`
- Применить миграции (когда DB поднята):
Переменные окружения для backend лежат в `apps/server/.env` (см. пример `apps/server/.env.example`).
Засидить демо-данные:
 `npm run db:seed -w apps/server`

`npm run db:migrate -w apps/server`

## Экспорт календаря + напоминания (bonus)

- Endpoint: `GET /groups/:groupId/calendar.ics`
- Возвращает файл `text/calendar` (iCalendar) с событиями из встреч.
- По умолчанию добавляется напоминание `VALARM` за 30 минут.
- Можно отключить/изменить: `GET /groups/:groupId/calendar.ics?alarmMinutes=0` или другое число минут.

Во фронтенде в вкладке Meetings есть кнопка `Download calendar (.ics)`.

## Тесты (bonus)

Требования: запущенный Postgres и корректный `DATABASE_URL`.

1 Поднять DB:

`docker compose up -d db`

2 Применить миграции:

`npm run db:deploy --workspace=server`

3 Запустить тесты:

`npm run test --workspace=server`

## CI (bonus)

Workflow: `.github/workflows/ci.yml` — поднимает Postgres service, применяет миграции и запускает build + tests.

## Kubernetes (bonus)

Манифесты: `k8s/`.

- Применить:

`kubectl apply -k k8s`

Примечание: образ API `study-groups-api:latest` нужно собрать/загрузить в кластер (например, через kind: `kind load docker-image ...`).

## Smoke-проверка API (runtime)

Из корня `task_02`:

`powershell -ExecutionPolicy Bypass -File .\scripts\smoke_api.ps1`

Скрипт:
- поднимает Postgres через `docker-compose.yml`
- генерирует Prisma client, применяет миграции, выполняет seed
- стартует backend (через `node dist/index.js`) и проверяет: `/health` → `/openapi.json` → `/docs` → `/auth/login` → `groups` create/patch/delete → calendar export
