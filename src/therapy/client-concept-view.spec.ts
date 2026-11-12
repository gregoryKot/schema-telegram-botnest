// Белый список схемы случая для клиента (client-concept-view.ts): клиент видит
// схемы, режимы, их цикл и потребности — без истоков, задач терапии, рабочих
// полей терапевта и истории. Новое поле по умолчанию НЕ уходит клиенту: и
// колонка строки, и поле внутри связи режима/схемы.
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ClientConceptualization } from '@prisma/client';
import {
  CLIENT_CONCEPT_FIELDS,
  CLIENT_CONCEPT_HIDDEN,
  clientConceptView,
} from './client-concept-view';
import { encryptConceptFields } from './concept-store';
import { encryptNeedLinks } from './concept-need-links';

const SHARED_AT = new Date('2026-11-06T09:00:00Z');
const UPDATED_AT = new Date('2026-11-06T10:00:00Z');

const modeLink = {
  modeId: 'punitive_critic',
  alias: 'Судья',
  schemaIds: ['defectiveness'],
  needIds: ['acceptance'],
  origin: 'голос отца — ИСТОКИ',
  manifest: 'Ты опять всё испортила',
  strategy: 'ограничить — ЗАДАЧА ТЕРАПИИ',
};
const schemaLink = {
  schemaId: 'defectiveness',
  belief: 'Со мной что-то не так',
  origin: 'дома стыдили — ДЕТСКИЙ ОПЫТ',
  needIds: ['acceptance'],
};

/** Строка как в БД: поля зашифрованы тем же путём, что пишет сервис. */
function row(
  over: Partial<ClientConceptualization> = {},
): ClientConceptualization {
  const enc = encryptConceptFields({
    schemaIds: ['defectiveness'],
    modeIds: ['punitive_critic'],
    earlyExperience: 'ранний опыт — ИСТОКИ',
    unmetNeeds: 'рабочее поле',
    triggers: 'рабочее поле',
    copingStyles: 'рабочее поле',
    goals: 'цели — ЗАДАЧА ТЕРАПИИ',
    currentProblems: 'рабочее поле',
    modeTransitions: 'Судья → Послушный Капитулянт',
    modeLinks: [modeLink],
    schemaLinks: [schemaLink],
    modeMapNodes: [{ id: 'n1' }],
    modeMapEdges: [],
  });
  return {
    id: 1,
    therapistId: 100n,
    clientId: 555n,
    ...enc,
    history: [{ savedAt: '2026-10-01T00:00:00Z', goals: 'старая версия' }],
    sharedWithClientAt: SHARED_AT,
    updatedAt: UPDATED_AT,
    ...over,
  } as unknown as ClientConceptualization;
}

describe('clientConceptView — что видит клиент', () => {
  it('не показана — null', () => {
    expect(clientConceptView(row({ sharedWithClientAt: null }))).toBeNull();
  });

  it('ровно поля белого списка, расшифрованные', () => {
    const view = clientConceptView(row())!;
    expect(Object.keys(view).sort()).toEqual([...CLIENT_CONCEPT_FIELDS].sort());
    expect(view).toMatchObject({
      schemaIds: ['defectiveness'],
      modeIds: ['punitive_critic'],
      modeTransitions: 'Судья → Послушный Капитулянт',
      sharedWithClientAt: SHARED_AT,
      updatedAt: UPDATED_AT,
    });
  });

  it('истоки, задачи терапии, рабочие поля и история не уходят', () => {
    const text = JSON.stringify(clientConceptView(row()));
    for (const secret of [
      'ИСТОКИ',
      'ЗАДАЧА ТЕРАПИИ',
      'ДЕТСКИЙ ОПЫТ',
      'рабочее поле',
      'старая версия',
      'n1',
    ])
      expect(text).not.toContain(secret);
  });

  it('связи режима и схемы — без origin и strategy, остальное на месте', () => {
    const view = clientConceptView(row())!;
    expect(view.modeLinks).toEqual([
      {
        modeId: 'punitive_critic',
        alias: 'Судья',
        schemaIds: ['defectiveness'],
        needIds: ['acceptance'],
        manifest: 'Ты опять всё испортила',
      },
    ]);
    expect(view.schemaLinks).toEqual([
      {
        schemaId: 'defectiveness',
        belief: 'Со мной что-то не так',
        needIds: ['acceptance'],
      },
    ]);
  });

  it('новое поле по умолчанию не уходит: ни колонка, ни поле связи', () => {
    const enc = encryptConceptFields({
      modeLinks: [{ ...modeLink, secretNote: 'НОВОЕ' }],
      schemaLinks: [{ ...schemaLink, secretNote: 'НОВОЕ' }],
    });
    const view = clientConceptView(
      row({ ...enc, newColumn: 'НОВОЕ' } as Partial<ClientConceptualization>),
    );
    expect(JSON.stringify(view)).not.toContain('НОВОЕ');
  });

  // «Делали сегодня» (#995) — рабочий журнал терапевта: какие техники и когда
  // делали на сессиях, клиенту не показывается.
  it('отметки техник (done) у связей режима и схемы клиенту не уходят', () => {
    const done = [{ techniqueId: 'chairwork', day: '2026-11-05' }];
    const enc = encryptConceptFields({
      modeLinks: [{ ...modeLink, done }],
      schemaLinks: [{ ...schemaLink, done }],
    });
    const view = clientConceptView(row(enc))!;
    expect(view.modeLinks[0]).not.toHaveProperty('done');
    expect(view.schemaLinks[0]).not.toHaveProperty('done');
    expect(JSON.stringify(view)).not.toMatch(/chairwork|2026-11-05/);
  });

  // Колесо потребностей (needLinks) — рабочая запись терапевта: оценки и
  // заметки по периодам жизни клиента в схему случая для клиента не входят.
  it('колесо потребностей клиенту не уходит: ни поля, ни оценок, ни заметок', () => {
    const needLinks = encryptNeedLinks([
      {
        needId: 'attachment',
        ratings: { child: 2, now: 7 },
        notes: { child: 'КОЛЕСО — заметка терапевта' },
      },
    ]);
    const view = clientConceptView(row({ needLinks }))!;
    expect(view).not.toHaveProperty('needLinks');
    expect(JSON.stringify(view)).not.toMatch(/КОЛЕСО|ratings|attachment/);
    expect(CLIENT_CONCEPT_FIELDS).not.toContain('needLinks');
    expect(CLIENT_CONCEPT_HIDDEN).toHaveProperty('needLinks');
  });

  it('битые связи (не объект, не строки) не роняют вид', () => {
    const enc = encryptConceptFields({
      modeLinks: [null, 'x', { modeId: 'a', schemaIds: [1, 'b'] }],
    });
    const view = clientConceptView(row(enc))!;
    expect(view.modeLinks).toEqual([
      { modeId: 'a', alias: '', schemaIds: ['b'], needIds: [], manifest: '' },
    ]);
  });
});

// Сверка со schema.prisma (правило №4): каждая колонка решена — видна клиенту
// или скрыта с причиной; новая колонка без решения роняет спек.
describe('белый список ↔ schema.prisma', () => {
  const schema = readFileSync(
    join(__dirname, '..', '..', 'prisma', 'schema.prisma'),
    'utf8',
  );
  const body = /model ClientConceptualization \{([\s\S]*?)\n\}/.exec(
    schema,
  )![1];
  const columns = [...body.matchAll(/^\s{2}(\w+)\s+\w+/gm)].map((m) => m[1]);

  it('каждая колонка либо в белом списке, либо скрыта с причиной — ровно одно', () => {
    const fields = new Set<string>(CLIENT_CONCEPT_FIELDS);
    const problems = columns.filter(
      (c) => fields.has(c) === c in CLIENT_CONCEPT_HIDDEN,
    );
    expect(problems).toEqual([]);
    for (const [col, why] of Object.entries(CLIENT_CONCEPT_HIDDEN))
      expect({ col, ok: why.length >= 20 }).toEqual({ col, ok: true });
  });

  it('нет протухших записей', () => {
    const stale = [
      ...CLIENT_CONCEPT_FIELDS,
      ...Object.keys(CLIENT_CONCEPT_HIDDEN),
    ].filter((c) => !columns.includes(c));
    expect(stale).toEqual([]);
  });
});
