// Промпты ИИ-наставника. Общие для браузера и сервера: так ответы одинаковы,
// какая бы модель и через какой канал ни отвечала.
//
// Персонализация «у каждого ученика своя интеграция»: в каждый запрос
// входит профиль ученика — уровень, трек, пройденные понятия, слабые места,
// стиль наставника и то, что наставник уже о нём запомнил.

export type MentorStyle = 'socratic' | 'direct'

export interface LearnerContext {
  name: string
  level: number
  track: string
  mastered: string[]
  current?: { title: string; summary: string; material?: string }
  weakSpots: string[] // карточки с высокой сложностью / частыми забываниями
  memory: string[] // наблюдения наставника об ученике
  style: MentorStyle
}

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

function learnerBlock(c: LearnerContext) {
  const lines = [
    `Ученик: ${c.name}, уровень ${c.level}. Трек: «${c.track}».`,
    c.mastered.length ? `Уже освоил: ${c.mastered.slice(-12).join(', ')}.` : 'Только начинает трек.',
    c.current ? `Сейчас изучает: «${c.current.title}» — ${c.current.summary}` : '',
    c.weakSpots.length ? `Даётся тяжело (по данным интервального повторения): ${c.weakSpots.slice(0, 6).join('; ')}.` : '',
    c.memory.length ? `Что наставник уже знает об ученике:\n${c.memory.slice(-8).map((m) => `- ${m}`).join('\n')}` : '',
  ]
  return lines.filter(Boolean).join('\n')
}

const STYLE: Record<MentorStyle, string> = {
  socratic: 'Стиль — сократовский диалог: не выдавай готовый ответ сразу. Задай один наводящий вопрос или дай подсказку, чтобы ученик дошёл сам. Если ученик застрял после двух попыток — объясни прямо.',
  direct: 'Стиль — прямой: коротко объясни суть, приведи один пример из жизни и одну аналогию, затем предложи вопрос для самопроверки.',
}

/** Системная часть для чата с наставником. */
export function mentorSystem(c: LearnerContext) {
  return [
    'Ты — ИИ-наставник платформы NextGenLearn. Помогаешь понять тему, а не просто запомнить.',
    'Отвечай по-русски, тепло и по делу, 3–8 предложений, без воды. Опирайся на то, что ученик уже знает, и связывай новое с пройденным.',
    'Если нужны точные вычисления (подсети, формулы, вероятности), вызывай инструменты, а не считай в уме.',
    'Не выдумывай факты. Если не уверен — так и скажи и предложи, как проверить.',
    STYLE[c.style],
    '',
    learnerBlock(c),
    c.current?.material ? `\nМатериал текущего урока:\n${c.current.material.slice(0, 4000)}` : '',
  ].join('\n')
}

/** В браузерном канале нет system-роли: инструкции идут первым ходом пользователя. */
export function mentorTurns(c: LearnerContext, history: ChatTurn[]): ChatTurn[] {
  return [{ role: 'user', content: `${mentorSystem(c)}\n\n(Это инструкции наставнику. Дальше — разговор с учеником.)` }, ...history]
}

// ---------------------------------------------------------------------------
// Проверка объяснения «своими словами» (метод Фейнмана)
// ---------------------------------------------------------------------------

export interface FeynmanVerdict {
  /** Понял ли ученик главную идею */
  understood: boolean
  /** 0..100 */
  score: number
  /** Отзыв ученику: 2–3 предложения, на «ты» */
  feedback: string
  /** Чего не хватило (пусто, если всё хорошо) */
  missing: string[]
  /** Короткое наблюдение для памяти наставника, или пустая строка */
  insight: string
}

export const FEYNMAN_SCHEMA = {
  type: 'object',
  properties: {
    understood: { type: 'boolean' },
    score: { type: 'integer' },
    feedback: { type: 'string' },
    missing: { type: 'array', items: { type: 'string' } },
    insight: { type: 'string' },
  },
  required: ['understood', 'score', 'feedback', 'missing', 'insight'],
  additionalProperties: false,
} as const

export function feynmanPrompt(c: LearnerContext, task: { prompt: string; keyIdeas: string[]; answer: string }) {
  return [
    'Ты проверяешь объяснение ученика методом Фейнмана: понял ли он идею так, чтобы объяснить её простыми словами.',
    `Задание ученику: «${task.prompt}»`,
    `Ключевые идеи, которые должны прозвучать (не дословно): ${task.keyIdeas.join('; ')}`,
    `Объяснение ученика: «${task.answer}»`,
    '',
    learnerBlock(c),
    '',
    'Оцени по смыслу, а не по словам. Неточная, но верная по сути формулировка — это хорошо. Фактическая ошибка — снижай оценку и назови её мягко.',
    'feedback — 2–3 предложения ученику на «ты»: что получилось, что уточнить. insight — одно короткое наблюдение об ученике для памяти наставника (например «путает MAC и IP»), или пустая строка.',
    'Ответь только JSON вида {"understood": true, "score": 85, "feedback": "...", "missing": ["..."], "insight": "..."}.',
  ].join('\n')
}

// ---------------------------------------------------------------------------
// Карточки из конспекта
// ---------------------------------------------------------------------------

export interface CardDraft { front: string; back: string }

export const CARDS_SCHEMA = {
  type: 'object',
  properties: { cards: { type: 'array', items: { type: 'object', properties: { front: { type: 'string' }, back: { type: 'string' } }, required: ['front', 'back'], additionalProperties: false } } },
  required: ['cards'],
  additionalProperties: false,
} as const

export function cardsPrompt(c: LearnerContext, note: { topic: string; text: string }) {
  return [
    `Составь флеш-карточки для интервального повторения по конспекту ученика на тему «${note.topic}».`,
    'Правила хорошей карточки: один вопрос — один короткий ответ (до 25 слов); вопрос проверяет понимание, а не пересказ; без карточек «перечисли всё». Исправь фактические ошибки конспекта в ответах.',
    'Сделай от 3 до 6 карточек. Не дублируй то, что ученик уже знает хорошо.',
    '',
    learnerBlock(c),
    '',
    `Конспект:\n${note.text.slice(0, 6000)}`,
    '',
    'Ответь только JSON вида {"cards": [{"front": "...", "back": "..."}]}.',
  ].join('\n')
}

/** Проверка ответа модели (структура не гарантирована в браузерном канале). */
export function coerceVerdict(v: unknown): FeynmanVerdict | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (typeof o.feedback !== 'string') return null
  return {
    understood: Boolean(o.understood),
    score: Math.max(0, Math.min(100, Math.round(Number(o.score) || 0))),
    feedback: o.feedback,
    missing: Array.isArray(o.missing) ? o.missing.map(String).slice(0, 5) : [],
    insight: typeof o.insight === 'string' ? o.insight.slice(0, 160) : '',
  }
}

export function coerceCards(v: unknown): CardDraft[] {
  const arr = Array.isArray(v) ? v : v && typeof v === 'object' && Array.isArray((v as { cards?: unknown }).cards) ? (v as { cards: unknown[] }).cards : []
  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({ front: String(x.front ?? '').trim(), back: String(x.back ?? '').trim() }))
    .filter((x) => x.front && x.back)
    .slice(0, 8)
}
