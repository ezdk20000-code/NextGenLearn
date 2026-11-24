// Генерирует docs/curriculum.md из src/data/cs-program.ts (единый источник правды).
import { writeFileSync } from 'node:fs'
import { BOOKS, CS_PROGRAM, ENGINES, programStats } from '../src/data/cs-program'

const st = programStats()
const pl = (n: number, f: [string, string, string]) => { const a = n % 100, b = n % 10; return `${n} ${a > 10 && a < 20 ? f[2] : b === 1 ? f[0] : b > 1 && b < 5 ? f[1] : f[2]}` }
const L: string[] = []
L.push(`# ${CS_PROGRAM.title}`, '', CS_PROGRAM.subtitle, '')
L.push(`**${pl(st.courses, ['курс', 'курса', 'курсов'])} · ${pl(st.modules, ['модуль', 'модуля', 'модулей'])} · ${pl(st.concepts, ['понятие', 'понятия', 'понятий'])} · ${pl(st.labs, ['лаборатория', 'лаборатории', 'лабораторий'])} · ${pl(st.projects, ['проект', 'проекта', 'проектов'])} · ${pl(st.updates, ['обновление', 'обновления', 'обновлений'])} «было → стало» · ≈${st.weeks} недель по часу в день**`, '')
L.push('> Файл сгенерирован из `src/data/cs-program.ts` командой `npm run docs:curriculum`. Править нужно данные, а не этот файл.', '')
L.push('## Книги-источники', '', ...Object.values(BOOKS).map((b) => `- ${b}`), '')
L.push('## Путь', '', ...CS_PROGRAM.courses.map((c, i) => `${i + 1}. **${c.code} · ${c.title}** — ≈${c.weeks} нед.${c.requires.length ? ` (после: ${c.requires.map((r) => CS_PROGRAM.courses.find((x) => x.id === r)!.code).join(', ')})` : ''}`), '')
for (const c of CS_PROGRAM.courses) {
  L.push(`## ${c.code}. ${c.title}`, '', `*${c.subtitle}*`, '', `Книги: ${c.books.join('; ')}`, '')
  L.push('**После курса:**', ...c.outcomes.map((o) => `- ${o}`), '', '**Итоговые проекты:**', ...c.capstones.map((o) => `- ${o}`), '')
  c.modules.forEach((m, i) => {
    L.push(`### ${c.code}.${i + 1} ${m.title} · ${m.level}`, '', `Источники: ${m.sources.join('; ')}`, '')
    L.push(`Понятия (${m.concepts.length}): ${m.concepts.join(' · ')}`, '')
    L.push('Лаборатории:', ...m.labs.map((l) => `- **${l.title}** (${ENGINES[l.engine].label}) — ${l.goal}`), '')
    if (m.project) L.push(`Проект: ${m.project}`, '')
    if (m.evolution.length) L.push('Обновления знаний:', ...m.evolution.map((e) => `- **${e.topic}.** Было: ${e.was}. Стало: ${e.now}.`), '')
  })
}
writeFileSync('docs/curriculum.md', L.join('\n'))
console.log(`docs/curriculum.md: ${L.length} строк`)
