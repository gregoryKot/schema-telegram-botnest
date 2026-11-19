// Тест гейта check-owner-waiting.mjs — раздел «Ждёт владельца» в бэклоге
// стоит первым, а каждая строка годится для ответа без поиска чата.
import { runGate } from './gate-sandbox';

const GATE = 'check-owner-waiting.mjs';
const doc = (section: string) => ({
  'docs/BACKLOG.md': `# Бэклог\n\nВступление.\n\n${section}\n## В работе\n\n- 🔧 задача без даты\n`,
});
const GOOD =
  '- **Искать ли по дневникам?** Рекомендация: да, только на устройстве. [чат](https://claude.ai/code/session_01) · 2026-11-19';

describe('check-owner-waiting.mjs', () => {
  it('строка с вопросом, рекомендацией, ссылкой и датой — exit 0', () => {
    const res = runGate(GATE, doc(`## Ждёт владельца\n\n${GOOD}\n`));
    expect(res.status).toBe(0);
  });

  it('пустой раздел со строкой «Пусто.» — exit 0', () => {
    expect(runGate(GATE, doc('## Ждёт владельца\n\nПусто.\n')).status).toBe(0);
  });

  it('раздела нет или он не первый — exit 1', () => {
    expect(runGate(GATE, doc('')).status).toBe(1);
    const res = runGate(GATE, {
      'docs/BACKLOG.md': `## В работе\n\n## Ждёт владельца\n\n${GOOD}\n`,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('первым разделом');
  });

  it('строка без рекомендации, ссылки и даты — exit 1 с номером строки и списком', () => {
    const res = runGate(
      GATE,
      doc('## Ждёт владельца\n\n- **Рисуем в стиле эталона?**\n'),
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('docs/BACKLOG.md:7');
    expect(res.stderr).toContain(
      '«Рекомендация:», ссылка на чат или артефакт, дата YYYY-MM-DD',
    );
  });

  it('раздел без строк и без «Пусто.», либо «Пусто.» рядом с вопросом — exit 1', () => {
    expect(runGate(GATE, doc('## Ждёт владельца\n')).status).toBe(1);
    expect(
      runGate(GATE, doc(`## Ждёт владельца\n\nПусто.\n${GOOD}\n`)).status,
    ).toBe(1);
  });
});
