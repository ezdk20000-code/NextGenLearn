import { afterEach, describe, expect, it, vi } from 'vitest'
import { coerceCards, coerceVerdict, feynmanPrompt, mentorSystem, mentorTurns, type LearnerContext } from '../shared/tutor'
import { offlineChannel, serverChannel } from '../src/ai/channels'

const ctx: LearnerContext = {
  name: 'Алексей', level: 3, track: 'Сетевые протоколы с нуля', mastered: ['Что такое сеть', 'Модель TCP/IP'],
  current: { title: 'TCP', summary: 'Надёжная доставка' }, weakSpots: ['Диапазоны частных IPv4'], memory: ['путает MAC и IP'], style: 'socratic',
}

describe('промпты наставника персональны', () => {
  it('включают прогресс, слабые места, память и стиль ученика', () => {
    const sys = mentorSystem(ctx)
    for (const piece of ['Алексей', 'Модель TCP/IP', 'Диапазоны частных IPv4', 'путает MAC и IP', 'сократовский', 'TCP']) expect(sys).toContain(piece)
    expect(mentorSystem({ ...ctx, style: 'direct' })).toContain('прямой')
  })
  it('в браузерном канале инструкции идут первым ходом, диалог кончается вопросом ученика', () => {
    const turns = mentorTurns(ctx, [{ role: 'user', content: 'Что такое SYN?' }])
    expect(turns[0].role).toBe('user')
    expect(turns.at(-1)).toEqual({ role: 'user', content: 'Что такое SYN?' })
  })
  it('проверка Фейнмана видит ответ ученика и ключевые идеи', () => {
    const p = feynmanPrompt(ctx, { prompt: 'Объясни TCP', keyIdeas: ['подтверждение', 'повтор'], answer: 'TCP переспрашивает' })
    expect(p).toContain('TCP переспрашивает'); expect(p).toContain('подтверждение')
  })
})

describe('разбор ответа модели устойчив к мусору', () => {
  it('вердикт', () => {
    expect(coerceVerdict({ understood: 1, score: 140, feedback: 'ок', missing: 'x' })).toEqual({ understood: true, score: 100, feedback: 'ок', missing: [], insight: '' })
    expect(coerceVerdict('не JSON')).toBeNull()
    expect(coerceVerdict({ score: 50 })).toBeNull()
  })
  it('карточки: принимает массив или {cards}, выкидывает пустые', () => {
    expect(coerceCards([{ front: 'A', back: 'B' }, { front: '', back: 'x' }])).toEqual([{ front: 'A', back: 'B' }])
    expect(coerceCards({ cards: [{ front: ' Q ', back: ' R ' }] })).toEqual([{ front: 'Q', back: 'R' }])
    expect(coerceCards(null)).toEqual([])
  })
})

describe('офлайн-канал', () => {
  it('проверяет по ключевым словам и честно говорит об этом', async () => {
    const ok = await offlineChannel.grade(ctx, { prompt: 'p', keyIdeas: ['конверт'], answer: 'Каждый слой кладёт данные в свой конверт с заголовком' })
    expect(ok.understood).toBe(true)
    expect(ok.feedback).toContain('ключевым словам')
    const bad = await offlineChannel.grade(ctx, { prompt: 'p', keyIdeas: ['конверт'], answer: 'не знаю' })
    expect(bad.understood).toBe(false)
  })
  it('делает карточки из строк «термин — определение»', async () => {
    const cards = await offlineChannel.cards(ctx, { topic: 'x', text: '- MAC — адрес сетевой карты\nпросто текст\nARP: находит MAC по IP' })
    expect(cards).toEqual([{ front: 'Что такое «MAC»?', back: 'адрес сетевой карты' }, { front: 'Что такое «ARP»?', back: 'находит MAC по IP' }])
  })
})

describe('канал сервера NGL', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('читает поток SSE: текст, вызов инструмента, конец', async () => {
    const sse = 'event: tool\ndata: {"name":"ipv4_subnet"}\n\nevent: delta\ndata: {"delta":"В /26 "}\n\nevent: delta\ndata: {"delta":"62 адреса."}\n\nevent: done\ndata: {"refused":false}\n\n'
    const fetchMock = vi.fn(async (_u: string, init: RequestInit) => {
      expect((init.headers as Record<string, string>)['x-ngl-user']).toBe('u-1')
      // отдаём поток кусками, разрезая событие посередине
      const enc = new TextEncoder()
      return new Response(new ReadableStream({ start(c) { c.enqueue(enc.encode(sse.slice(0, 30))); c.enqueue(enc.encode(sse.slice(30))); c.close() } }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const seen: string[] = []; const tools: string[] = []
    const text = await serverChannel('https://ngl.test', 'u-1').mentor(ctx, [{ role: 'user', content: '?' }], { onText: (t) => seen.push(t), onTool: (n) => tools.push(n) })
    expect(text).toBe('В /26 62 адреса.')
    expect(seen.at(-1)).toBe(text)
    expect(tools).toEqual(['ipv4_subnet'])
    expect(fetchMock.mock.calls[0][0]).toBe('https://ngl.test/api/v1/ai/mentor')
  })
  it('ошибка сервера превращается в понятный код', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'not_configured', message: 'нет ключа' }), { status: 503 })))
    await expect(serverChannel('https://ngl.test', 'u').grade(ctx, { prompt: 'p', keyIdeas: [], answer: 'a' })).rejects.toMatchObject({ code: 'not_configured' })
  })
})
