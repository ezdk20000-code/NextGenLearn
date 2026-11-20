-- ============================================================================
-- NextGenLearn (NGL) — схема базы данных, PostgreSQL 16
-- Принцип: ни одна тема не зашита в схему. Треки, узлы, уроки, лаборатории
-- и карточки — это данные, которые генерирует ИИ под запрос пользователя.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- 1. Пользователи
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         citext UNIQUE NOT NULL,
    display_name  text NOT NULL,
    locale        text NOT NULL DEFAULT 'ru',
    timezone      text NOT NULL DEFAULT 'Europe/Moscow',   -- нужен для серий и «сегодня»
    daily_minutes smallint NOT NULL DEFAULT 30 CHECK (daily_minutes BETWEEN 5 AND 480),
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- Опыт хранится журналом, а не числом: так XP нельзя «потерять» и легко пересчитать.
-- Уровень и серия дней вычисляются из журнала.
CREATE TABLE xp_events (
    id         bigserial PRIMARY KEY,
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount     integer NOT NULL,
    reason     text NOT NULL CHECK (reason IN ('lesson', 'lab', 'review', 'focus', 'bonus')),
    ref_id     uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX xp_events_user_time ON xp_events (user_id, created_at);

-- ---------------------------------------------------------------------------
-- 2. Треки и граф знаний
-- ---------------------------------------------------------------------------
CREATE TYPE track_status AS ENUM ('generating', 'ready', 'failed', 'archived');
CREATE TYPE learner_level AS ENUM ('zero', 'some', 'pro');

CREATE TABLE tracks (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_text   text NOT NULL,               -- что ввёл пользователь: «сетевые протоколы с нуля»
    title          text NOT NULL,
    subtitle       text,
    domain         text NOT NULL,               -- свободная строка, не enum: «Компьютерные сети», «Испанский»…
    level          learner_level NOT NULL,
    goal           text,
    status         track_status NOT NULL DEFAULT 'generating',
    generator      jsonb NOT NULL DEFAULT '{}', -- модель, версия промпта, токены — для отладки качества
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tracks_owner ON tracks (owner_id, created_at DESC);

-- Узел = одно понятие. tier 0..4: корень → вершина.
CREATE TABLE nodes (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    track_id     uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    slug         text NOT NULL,
    title        text NOT NULL,
    summary      text NOT NULL,
    tier         smallint NOT NULL CHECK (tier BETWEEN 0 AND 4),
    pos_x        real NOT NULL DEFAULT 0,       -- раскладка карты 0..1000 × 0..660
    pos_y        real NOT NULL DEFAULT 0,
    est_minutes  smallint NOT NULL DEFAULT 15,
    xp_reward    smallint NOT NULL DEFAULT 100,
    UNIQUE (track_id, slug)
);

-- Ребро «чтобы изучать node, нужно знать requires». Граф обязан быть ацикличным
-- (проверяется в сервисе при сохранении сгенерированного трека).
CREATE TABLE node_prerequisites (
    node_id     uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    requires_id uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (node_id, requires_id),
    CHECK (node_id <> requires_id)
);
CREATE INDEX node_prereq_requires ON node_prerequisites (requires_id);

-- Мосты между понятиями из разных треков («синапсы» MindFlow).
-- Не нужны для MVP, но таблица дешёвая и не мешает.
CREATE TABLE node_bridges (
    source_id   uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id   uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    weight      real NOT NULL CHECK (weight BETWEEN 0 AND 1),
    explanation text NOT NULL,                  -- почему связаны: это и есть ценность для ученика
    PRIMARY KEY (source_id, target_id),
    CHECK (source_id <> target_id)
);

-- ---------------------------------------------------------------------------
-- 3. Контент: уроки, лаборатории, карточки
-- ---------------------------------------------------------------------------
-- Урок — массив блоков-примитивов (text, analogy, quiz, order, feynman, terms, widget).
-- Формат блоков описан в api/openapi.yaml → LessonBlock. Версии — чтобы перегенерация
-- не ломала прогресс тех, кто проходит старую.
CREATE TABLE lessons (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id     uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    version     integer NOT NULL DEFAULT 1,
    title       text NOT NULL,
    blocks      jsonb NOT NULL CHECK (jsonb_typeof(blocks) = 'array'),
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (node_id, version)
);

-- Лаборатория = универсальный движок (primitive) + конфиг под тему.
-- Тот же 'stepper' — это и TCP-рукопожатие, и химическая реакция, и переговоры.
CREATE TYPE lab_primitive AS ENUM (
    'stepper',        -- пошаговый симулятор с состояниями и действиями (TCP)
    'param_explorer', -- ползунки → визуализация → задания на подбор (подсети)
    'builder',        -- собрать объект из частей в правильном порядке (инкапсуляция)
    'scenario',       -- ветвящийся кейс с решениями и последствиями
    'code_sandbox',   -- код с проверкой тестами
    'roleplay'        -- диалог с ИИ-персонажем (переговоры, язык)
);

CREATE TABLE labs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id     uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    primitive   lab_primitive NOT NULL,
    title       text NOT NULL,
    config      jsonb NOT NULL,                 -- состояния, действия, правила, задания, подсказки
    xp_reward   smallint NOT NULL DEFAULT 120,
    version     integer NOT NULL DEFAULT 1
);
CREATE INDEX labs_node ON labs (node_id);

CREATE TABLE cards (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id     uuid REFERENCES nodes(id) ON DELETE SET NULL,
    owner_id    uuid REFERENCES users(id) ON DELETE CASCADE, -- NULL = карточка трека, иначе личная
    front       text NOT NULL,
    back        text NOT NULL,
    source      text NOT NULL DEFAULT 'lesson' CHECK (source IN ('lesson', 'user', 'mistake')),
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 4. Прогресс ученика
-- ---------------------------------------------------------------------------
CREATE TABLE user_tracks (
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id    uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    started_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, track_id)
);

CREATE TABLE user_nodes (
    user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    node_id              uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    lesson_completed_at  timestamptz,
    lab_completed_at     timestamptz,
    PRIMARY KEY (user_id, node_id)
);
-- Мастерство и «витальность» узла НЕ хранятся: они считаются из уроков, лабораторий
-- и текущей R карточек узла. Хранимое число устаревает в ту же секунду.

-- Ответы на блоки урока: по ним видно, где ученики ошибаются, и ИИ улучшает урок.
CREATE TABLE lesson_answers (
    id          bigserial PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id   uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    block_index smallint NOT NULL,
    answer      jsonb NOT NULL,
    correct     boolean,
    feedback    text,                           -- отзыв ИИ-наставника для feynman-блоков
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lesson_answers_lesson ON lesson_answers (lesson_id, block_index);

CREATE TABLE lab_attempts (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lab_id       uuid NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
    lab_version  integer NOT NULL,
    actions      jsonb NOT NULL,                -- журнал действий; сервер переигрывает его и сам решает, пройдено ли
    passed       boolean NOT NULL,
    mistakes     smallint NOT NULL DEFAULT 0,
    xp_awarded   smallint NOT NULL DEFAULT 0,
    started_at   timestamptz NOT NULL,
    finished_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lab_attempts_user ON lab_attempts (user_id, lab_id);

-- ---------------------------------------------------------------------------
-- 5. Интервальное повторение (FSRS-4.5)
-- ---------------------------------------------------------------------------
CREATE TYPE card_status AS ENUM ('new', 'learning', 'review', 'relearning');

CREATE TABLE user_cards (
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id         uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    stability       real NOT NULL DEFAULT 0,    -- S, дни
    difficulty      real NOT NULL DEFAULT 0,    -- D, 1..10 (0 — ещё не оценивалась)
    status          card_status NOT NULL DEFAULT 'new',
    reps            integer NOT NULL DEFAULT 0,
    lapses          integer NOT NULL DEFAULT 0,
    last_review_at  timestamptz,
    due_at          timestamptz NOT NULL DEFAULT now(),
    suspended       boolean NOT NULL DEFAULT false,
    PRIMARY KEY (user_id, card_id)
);
CREATE INDEX user_cards_due ON user_cards (user_id, due_at) WHERE NOT suspended;

-- Полный журнал повторений. Нужен, чтобы позже подобрать личные веса FSRS
-- под каждого ученика (оптимизатор fsrs-rs / fsrs-optimizer работает именно по нему).
CREATE TABLE review_logs (
    id              bigserial PRIMARY KEY,
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id         uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    grade           smallint NOT NULL CHECK (grade BETWEEN 1 AND 4),
    status_before   card_status NOT NULL,
    elapsed_days    real NOT NULL,
    scheduled_days  real NOT NULL,
    retrievability  real,                       -- R в момент ответа
    stability_after real NOT NULL,
    difficulty_after real NOT NULL,
    duration_ms     integer,
    reviewed_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_logs_user_time ON review_logs (user_id, reviewed_at);

CREATE TABLE user_fsrs_params (
    user_id            uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    weights            real[] NOT NULL CHECK (array_length(weights, 1) = 17),
    request_retention  real NOT NULL DEFAULT 0.9 CHECK (request_retention BETWEEN 0.7 AND 0.99),
    maximum_interval   integer NOT NULL DEFAULT 36500,
    optimized_at       timestamptz
);

-- ---------------------------------------------------------------------------
-- 6. План и фокус
-- ---------------------------------------------------------------------------
CREATE TABLE plan_items (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_date   date NOT NULL,                  -- в часовом поясе пользователя
    starts_at   time,
    kind        text NOT NULL CHECK (kind IN ('review', 'lesson', 'lab', 'focus')),
    ref_id      uuid,                           -- узел или лаборатория
    title       text NOT NULL,
    minutes     smallint NOT NULL,
    done_at     timestamptz
);
CREATE INDEX plan_items_user_date ON plan_items (user_id, plan_date);

CREATE TABLE focus_sessions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_item_id uuid REFERENCES plan_items(id) ON DELETE SET NULL,
    planned_min smallint NOT NULL,
    actual_min  smallint,
    parked_thoughts text[] NOT NULL DEFAULT '{}',
    started_at  timestamptz NOT NULL DEFAULT now(),
    ended_at    timestamptz
);
