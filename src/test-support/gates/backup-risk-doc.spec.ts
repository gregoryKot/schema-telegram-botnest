// Принятый риск про резервные копии Amvera держится сверкой, а не памятью.
//
// У нас нет ответов поддержки Amvera на четыре вопроса про копии CNPG:
// шифруются ли, где лежат, у кого доступ, чей ключ. Риск, принятый молча,
// через полгода читается как недосмотр. А запись «ответов нет», оставшаяся
// после того как ответы пришли, читается как ложный долг (CLAUDE.md, правила
// №15 п.4 и №26). Спек держит обе стороны:
//  - пока ответов нет, §13 SECURITY.md обязан сказать об этом вслух;
//  - как только все четыре ответа вписаны в таблицу, §13 обязан перестать
//    говорить, что ответов нет: риск пора переписать под факты.
// Заодно (правило №4) таблица не должна разъехаться по разметке, SECURITY.md
// и CLAUDE.md ссылаются на единственный список вопросов, а механизмы, которыми
// документ «снижает» риск, существуют на диске.
//
// Красный спек не значит «подправь тест»: сделай то, что написано в сообщении.
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..', '..');
const QUESTIONS_DOC = 'docs/AMVERA_BACKUP_QUESTIONS.md';
const SECURITY_DOC = 'docs/SECURITY.md';
const CLAUDE_DOC = 'CLAUDE.md';

/** Фраза, которой §13 явно признаёт: ответов поддержки нет. */
const NO_ANSWERS_MARKER = 'Ответов от поддержки нет';
const HEADER = ['#', 'Вопрос', 'Ответ Amvera', 'Дата'];
const ANSWER_COL = 2;
const DATE_COL = 3;
/** «Пусто» в таблице пишется тире; остальное считается вписанным ответом. */
const EMPTY_CELLS = ['', '—', '–', '-'];

/** Механизмы из документа: файл и то, как документ его называет. */
const PROBE_FILE = 'src/infra/self-check/probe-backup-freshness.ts';
const MECHANISMS = [
  { file: 'scripts/backup-to-b2.sh', token: 'scripts/backup-to-b2.sh' },
  { file: 'scripts/restore-backup.sh', token: 'scripts/restore-backup.sh' },
  {
    file: 'src/infra/backup-restore.spec.ts',
    token: 'src/infra/backup-restore.spec.ts',
  },
  { file: PROBE_FILE, token: 'backupFreshness' },
  { file: 'deploy/backup-scheduler.cjs', token: 'deploy/backup-scheduler.cjs' },
];

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());
}

function parseTable(): { header: string[]; rows: string[][] } {
  const lines = read(QUESTIONS_DOC).split('\n');
  const headerLine = lines.find((l) => /^\|\s*#\s*\|/.test(l));
  return {
    header: headerLine ? splitRow(headerLine) : [],
    rows: lines.filter((l) => /^\|\s*\d+\s*\|/.test(l)).map(splitRow),
  };
}

/** Текст §13 «Принятые риски» — от своего заголовка до следующего `## `. */
function section13(): string {
  const text = read(SECURITY_DOC);
  const start = text.search(/^## 13\. Принятые риски/m);
  if (start === -1) return '';
  const rest = text.slice(start + 1);
  const next = rest.search(/^## /m);
  return next === -1 ? rest : rest.slice(0, next);
}

/** Пустая строка = состояние согласовано; иначе — что именно сделать. */
function riskVerdict(allAnswered: boolean, hasMarker: boolean): string {
  if (!allAnswered && !hasMarker) {
    return `Ответов Amvera в ${QUESTIONS_DOC} нет, а §13 ${SECURITY_DOC} не говорит «${NO_ANSWERS_MARKER}»: принятый риск пропал или переписан. Верни явное описание риска в §13 (или впиши ответы в таблицу).`;
  }
  if (allAnswered && hasMarker) {
    return `Все четыре ответа Amvera вписаны в ${QUESTIONS_DOC}, а §13 ${SECURITY_DOC} всё ещё говорит «${NO_ANSWERS_MARKER}»: запись протухла. Перепиши принятый риск под факты (или сними его) и убери строку из docs/README.md, «Что осталось открытым».`;
  }
  return '';
}

describe('риск резервных копий Amvera: документы и ответы сверены', () => {
  it('таблица ответов: ровно 4 строки-вопроса, номера 1..4 по порядку', () => {
    expect(parseTable().rows.map((r) => Number(r[0]))).toEqual([1, 2, 3, 4]);
  });

  it('таблица не разъехалась: шапка прежняя, колонок везде поровну, ответ и дата не пусты', () => {
    const { header, rows } = parseTable();
    expect(header).toEqual(HEADER);
    expect(rows.map((r) => r.length)).toEqual(rows.map(() => HEADER.length));
    const blank = rows
      .filter((r) => r[ANSWER_COL] === '' || r[DATE_COL] === '')
      .map((r) => r[0]);
    expect(blank).toEqual([]);
  });

  it('SECURITY.md §13 и CLAUDE.md ссылаются на единый список вопросов', () => {
    expect(section13()).toMatch(/\]\(AMVERA_BACKUP_QUESTIONS\.md\)/);
    expect(read(CLAUDE_DOC)).toMatch(/\]\(docs\/AMVERA_BACKUP_QUESTIONS\.md\)/);
  });

  it('ответы вписаны ⇔ §13 перестал говорить «Ответов от поддержки нет»', () => {
    const { rows } = parseTable();
    const allAnswered =
      rows.length > 0 &&
      rows.every((r) => !EMPTY_CELLS.includes(r[ANSWER_COL]));
    const hasMarker = section13().includes(NO_ANSWERS_MARKER);
    expect(riskVerdict(allAnswered, hasMarker)).toBe('');
  });

  it('сама сверка краснеет в обе стороны и зеленеет в согласованных состояниях', () => {
    expect(riskVerdict(false, true)).toBe('');
    expect(riskVerdict(true, false)).toBe('');
    expect(riskVerdict(false, false)).toMatch(/принятый риск пропал/);
    expect(riskVerdict(true, true)).toMatch(/запись протухла/);
  });

  it('механизмы из документа существуют и названы в нём так же, как в спеке', () => {
    const missing = MECHANISMS.filter(
      (m) => !existsSync(join(ROOT, m.file)),
    ).map((m) => m.file);
    expect(missing).toEqual([]);
    const doc = read(QUESTIONS_DOC);
    const unnamed = MECHANISMS.filter((m) => !doc.includes(`\`${m.token}\``));
    expect(unnamed.map((m) => m.token)).toEqual([]);
    expect(read(PROBE_FILE)).toMatch(/id: 'backupFreshness'/);
  });
});
