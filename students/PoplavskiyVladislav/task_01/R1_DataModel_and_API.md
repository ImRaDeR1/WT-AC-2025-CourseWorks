# Вариант 42 — Учебные группы «Соберёмся и решим» 🧪 — Ключевые сущности, связи и API (эскиз)

## Сущности (основные)

- User
  - id: UUID
  - username: string (unique)
  - email: string (unique)
  - password_hash: string
  - role: enum [admin, user]
  - created_at: datetime

- StudyGroup
  - id: UUID
  - title: string (required)
  - description: string (optional)
  - owner_id: reference -> User.id (required)
  - is_public: boolean (default: true)
  - created_at: datetime

- Membership
  - id: UUID
  - group_id: reference -> StudyGroup.id (required)
  - user_id: reference -> User.id (required)
  - role: enum [owner, member] (default: member)
  - joined_at: datetime
  - unique(group_id, user_id)

- Topic
  - id: UUID
  - group_id: reference -> StudyGroup.id (required)
  - title: string (required)
  - description: string (optional)
  - order: int (optional)

- Meeting
  - id: UUID
  - group_id: reference -> StudyGroup.id (required)
  - topic_id: reference -> Topic.id (optional)
  - starts_at: datetime (required)
  - duration_minutes: int (required)
  - place: string (optional)  // аудитория/адрес
  - link: string (optional)   // ссылка на видеовстречу
  - notes: string (optional)

- Material
  - id: UUID
  - group_id: reference -> StudyGroup.id (required)
  - topic_id: reference -> Topic.id (optional)
  - title: string (required)
  - type: enum [link, file, note] (required)
  - url: string (required if type=link)
  - content: string (required if type=note)
  - created_by: reference -> User.id (required)
  - created_at: datetime

- Task
  - id: UUID
  - group_id: reference -> StudyGroup.id (required)
  - topic_id: reference -> Topic.id (optional)
  - title: string (required)
  - description: string (optional)
  - due_at: datetime (optional)
  - assignee_id: reference -> User.id (optional)
  - status: enum [todo, in_progress, done] (default: todo)
  - created_by: reference -> User.id (required)
  - created_at: datetime

## Связи (ER-эскиз)

- User 1..* StudyGroup (пользователь владеет группами)
- User *..* StudyGroup через Membership (участники групп)
- StudyGroup 1..* Topic
- StudyGroup 1..* Meeting
- StudyGroup 1..* Material
- StudyGroup 1..* Task

## Обязательные поля и ограничения (кратко)

- unique(User.username), unique(User.email)
- StudyGroup.owner_id -> User.id (FK, not null)
- Membership.group_id + Membership.user_id unique
- Topic.group_id (FK, not null)
- Meeting.group_id (FK, not null)
- Material.group_id (FK, not null)
- Task.group_id (FK, not null)

---

## API — верхнеуровневые ресурсы и операции

Общий формат ответов:

- `{ "status": "ok", "data": ... }`
- `{ "status": "error", "error": { "code": string, "message": string, "fields"?: object } }`

Пагинация: `limit`, `offset` (по умолчанию limit=50).

Аутентификация: `Authorization: Bearer <jwt>`.

### Auth

- POST `/auth/register` — `{username, email, password}`
- POST `/auth/login` — `{email, password}` → `{accessToken, user}`

### Users (admin)

- GET `/users?limit=&offset=`
- GET `/users/{id}`
- PUT `/users/{id}`
- DELETE `/users/{id}`

### Groups

- GET `/groups?query=&isPublic=&limit=&offset=` — список групп
- POST `/groups` — создать группу (user/admin)
- GET `/groups/{id}` — детали группы (только member/admin; если is_public=true — допускается просмотр без member по политике)
- PUT `/groups/{id}` — admin или owner
- DELETE `/groups/{id}` — admin или owner

### Memberships

- POST `/groups/{id}/join` — вступить
- POST `/groups/{id}/leave` — выйти
- GET `/groups/{id}/members` — список участников
- PUT `/groups/{id}/members/{memberId}` — изменить роль/удалить (admin/owner)

### Topics

- GET `/topics?groupId=&limit=&offset=`
- POST `/topics` — `{groupId, title, description?, order?}` (admin/owner)
- PUT `/topics/{id}` (admin/owner)
- DELETE `/topics/{id}` (admin/owner)

### Meetings

- GET `/meetings?groupId=&from=&to=&limit=&offset=`
- POST `/meetings` — `{groupId, topicId?, startsAt, durationMinutes, place?, link?, notes?}` (admin/owner)
- PUT `/meetings/{id}` (admin/owner)
- DELETE `/meetings/{id}` (admin/owner)

### Materials

- GET `/materials?groupId=&topicId=&type=&limit=&offset=`
- POST `/materials` — `{groupId, topicId?, title, type, url?, content?}` (admin/owner)
- DELETE `/materials/{id}` (admin/owner)

### Tasks

- GET `/tasks?groupId=&topicId=&status=&assigneeId=&limit=&offset=`
- POST `/tasks` — `{groupId, topicId?, title, description?, dueAt?, assigneeId?}` (admin/owner)
- PUT `/tasks/{id}` — обновление полей + `status` (admin/owner; status может менять member по политике)
- DELETE `/tasks/{id}` (admin/owner)

---

AC — критерии приёмки (MVP)

- AC1: Пользователь может создать группу и автоматически становится owner (Membership.role=owner).
- AC2: Owner может создать встречу и она отображается в списке встреч группы.
- AC3: Owner может создать задачу и она отображается в списке задач группы.
