import { describe, it, expect } from 'vitest';
import { buildConceptGraph } from './conceptGraphModel';
import type { ConceptGraphSource } from './conceptGraphTypes';
import { emptyModeLink } from './modeLinks';
import { emptySchemaLink } from './schemaLinks';
import type { ConceptModeLink, ConceptSchemaLink } from '../../apiTypes';

const ty = (a: string) => a;
const vy = (_a: string, b: string) => b;

const src = (patch: Partial<ConceptGraphSource> = {}): ConceptGraphSource => ({
  modeIds: [],
  schemaIds: [],
  modeLinks: [],
  schemaLinks: [],
  ...patch,
});

const linked = (modeId: string, patch: Partial<ConceptModeLink>) => ({
  ...emptyModeLink(modeId),
  ...patch,
});

const schemaLink = (schemaId: string, patch: Partial<ConceptSchemaLink>) => ({
  ...emptySchemaLink(schemaId),
  ...patch,
});

const gapIds = (s: ConceptGraphSource) =>
  buildConceptGraph(s, ty).gaps.map((g) => g.id);

describe('раскладка по клеткам', () => {
  it('режимы встают в свои клетки в порядке реестра, а не порядке клика', () => {
    const g = buildConceptGraph(
      src({
        modeIds: [
          'healthy_adult',
          'punitive_critic',
          'detached_protector',
          'lonely_child',
          'vulnerable_child',
          'compliant_surrenderer',
        ],
      }),
      ty,
    );
    expect(g.lanes.child.map((c) => c.modeId)).toEqual([
      'vulnerable_child',
      'lonely_child',
    ]);
    expect(g.lanes.coping.map((c) => c.modeId)).toEqual([
      'compliant_surrenderer',
      'detached_protector',
    ]);
    expect(g.lanes.critic.map((c) => c.modeId)).toEqual(['punitive_critic']);
    expect(g.lanes.healthy.map((c) => c.modeId)).toEqual(['healthy_adult']);
    expect(g.modeCount).toBe(6);
  });

  it('копинг несёт вид, цвет группы и подсказку метода', () => {
    const g = buildConceptGraph(
      src({ modeIds: ['detached_protector', 'vulnerable_child'] }),
      ty,
    );
    const [coping] = g.lanes.coping;
    expect(coping.copingKind).toBe('avoidance');
    expect(coping.color).toBe('var(--accent)');
    expect(coping.strategyHint).toMatch(/^Обходить, а не ломать/);
    expect(g.lanes.child[0].copingKind).toBeUndefined();
    expect(g.lanes.child[0].strategyHint).toMatch(
      /^Прямой контакт с чувствами/,
    );
  });

  it('неизвестные режимы пропускаются', () => {
    const g = buildConceptGraph(
      src({ modeIds: ['vulnerable_child', 'nope'] }),
      ty,
    );
    expect(g.modeCount).toBe(1);
  });

  it('связи режимов, которых нет на карте, на схему не попадают', () => {
    const g = buildConceptGraph(
      src({
        modeIds: ['vulnerable_child'],
        modeLinks: [
          linked('punitive_critic', { alias: 'Судья', needIds: ['limits'] }),
        ],
      }),
      ty,
    );
    expect(g.lanes.critic).toEqual([]);
    expect(g.schemas).toEqual([]);
  });
});

describe('карточка', () => {
  it('имя клиента, схемы по порядку доменов, потребности по NEED_ORDER, неизвестные id пропускаются', () => {
    const g = buildConceptGraph(
      src({
        modeIds: ['vulnerable_child'],
        modeLinks: [
          linked('vulnerable_child', {
            alias: '  Маленькая Аня ',
            schemaIds: ['failure', 'abandonment', 'ghost'],
            needIds: ['limits', 'attachment', 'ghost'],
            origin: ' мама уезжала ',
            manifest: 'замирает',
            strategy: 'рескриптинг',
          }),
        ],
      }),
      ty,
    );
    const [card] = g.lanes.child;
    expect(card.alias).toBe('Маленькая Аня');
    expect(card.name).toBe('Уязвимый Ребёнок');
    expect(card.schemas.map((s) => s.id)).toEqual(['abandonment', 'failure']);
    expect(card.needs.map((n) => n.name)).toEqual(['Привязанность', 'Границы']);
    expect(card.lane).toBe('child');
    expect(card.manifest).toBe('замирает');
    expect(card.empty).toBe(false);
  });

  it('режим без связи — empty, с одним только именем — уже нет', () => {
    const g = buildConceptGraph(
      src({
        modeIds: ['vulnerable_child', 'lonely_child'],
        modeLinks: [linked('lonely_child', { alias: 'Одинокий' })],
      }),
      ty,
    );
    expect(g.lanes.child.map((c) => c.empty)).toEqual([true, false]);
  });
});

describe('схемы на схеме случая', () => {
  const ed = 'emotional_deprivation';

  it('схемы — отмеченные в концептуализации плюс упомянутые связями режимов с карты, в порядке доменов', () => {
    const g = buildConceptGraph(
      src({
        modeIds: ['vulnerable_child', 'guilt_critic'],
        schemaIds: ['failure', 'ghost'],
        modeLinks: [
          linked('guilt_critic', { schemaIds: [ed] }),
          linked('vulnerable_child', { schemaIds: ['abandonment'] }),
        ],
      }),
      ty,
    );
    expect(g.schemas.map((s) => s.id)).toEqual([ed, 'abandonment', 'failure']);
    expect(g.schemas[0]).toMatchObject({
      name: 'Эмоциональная депривация',
      domain: 'Нарушение связи и отвержение',
      color: 'var(--accent-red)',
    });
  });

  it('связь режима не с карты и связь здорового режима схему не показывают', () => {
    const g = buildConceptGraph(
      src({
        modeIds: ['healthy_adult'],
        modeLinks: [
          linked('healthy_adult', { schemaIds: ['failure'] }),
          linked('punitive_critic', { schemaIds: ['abandonment'] }),
        ],
      }),
      ty,
    );
    expect(g.schemas).toEqual([]);
  });

  it('тексты схемы обрезаются, потребности идут по NEED_ORDER без неизвестных; пусто — empty', () => {
    const g = buildConceptGraph(
      src({
        schemaIds: [ed, 'failure'],
        schemaLinks: [
          schemaLink(ed, {
            belief: ' Я верю, что… ',
            origin: ' нужно было молчать ',
            needIds: ['limits', 'attachment', 'ghost'],
          }),
        ],
      }),
      ty,
    );
    const [first, second] = g.schemas;
    expect(first).toMatchObject({
      belief: 'Я верю, что…',
      origin: 'нужно было молчать',
      needIds: ['attachment', 'limits'],
      empty: false,
    });
    expect(second).toMatchObject({
      belief: '',
      origin: '',
      needIds: [],
      empty: true,
    });
  });

  it('тексты схемы, снятой из концептуализации, на схему случая не возвращают схему', () => {
    const g = buildConceptGraph(
      src({ schemaLinks: [schemaLink(ed, { belief: 'х' })] }),
      ty,
    );
    expect(g.schemas).toEqual([]);
  });
});

describe('переходы между режимами', () => {
  it('тексты обрезаются, пустое и null дают пустую строку', () => {
    expect(
      buildConceptGraph(src({ modeTransitions: '\n  ' }), ty).sequence,
    ).toBe('');
    expect(buildConceptGraph(src({ modeTransitions: null }), ty).sequence).toBe(
      '',
    );
  });

  it('sequence — обрезанный текст переходов', () => {
    expect(
      buildConceptGraph(src({ modeTransitions: ' А → Б ' }), ty).sequence,
    ).toBe('А → Б');
  });
});

describe('пустая концептуализация', () => {
  it('без мусора: пустые клетки, ноль режимов, ни одной подсказки', () => {
    const g = buildConceptGraph(src(), ty);
    expect(g.lanes).toEqual({ healthy: [], child: [], critic: [], coping: [] });
    expect(g.modeCount).toBe(0);
    expect(g.gaps).toEqual([]);
    expect(g.schemas).toEqual([]);
    expect(JSON.stringify(g)).not.toMatch(/undefined|NaN|null/);
  });
});

describe('подсказки «чего не хватает»', () => {
  const filled = (modeId: string) => linked(modeId, { alias: 'х' });

  it('coping_without_child: копинги есть, детских нет', () => {
    expect(gapIds(src({ modeIds: ['detached_protector'] }))).toContain(
      'coping_without_child',
    );
  });

  it('coping_without_child не включается: есть детский режим, или нет копингов', () => {
    expect(
      gapIds(src({ modeIds: ['detached_protector', 'vulnerable_child'] })),
    ).not.toContain('coping_without_child');
    expect(gapIds(src({ modeIds: ['punitive_critic'] }))).not.toContain(
      'coping_without_child',
    );
  });

  it('no_angry: детские есть, злого нет', () => {
    expect(gapIds(src({ modeIds: ['vulnerable_child'] }))).toContain(
      'no_angry',
    );
  });

  it('no_angry не включается: есть злой/упрямый/разъярённый, или детских нет вовсе', () => {
    for (const angry of ['angry_child', 'stubborn_child', 'enraged_child']) {
      expect(
        gapIds(src({ modeIds: ['vulnerable_child', angry] })),
      ).not.toContain('no_angry');
    }
    expect(gapIds(src({ modeIds: ['detached_protector'] }))).not.toContain(
      'no_angry',
    );
    // импульсивный — детский, но не из группы злых
    expect(gapIds(src({ modeIds: ['impulsive_child'] }))).toContain('no_angry');
  });

  it('unlinked: есть карточка без связей; не включается, когда у всех связи', () => {
    expect(gapIds(src({ modeIds: ['vulnerable_child'] }))).toContain(
      'unlinked',
    );
    expect(
      gapIds(
        src({
          modeIds: ['vulnerable_child'],
          modeLinks: [filled('vulnerable_child')],
        }),
      ),
    ).not.toContain('unlinked');
  });

  it('без режимов подсказок нет вовсе', () => {
    expect(gapIds(src({ modeLinks: [filled('vulnerable_child')] }))).toEqual(
      [],
    );
  });

  it('порядок: копинги без детского → злой → связи', () => {
    expect(
      gapIds(src({ modeIds: ['detached_protector', 'impulsive_child'] })),
    ).toEqual(['no_angry', 'unlinked']);
    expect(gapIds(src({ modeIds: ['detached_protector'] }))).toEqual([
      'coping_without_child',
      'unlinked',
    ]);
  });

  it('текст unlinked зависит от формы обращения, остальные — нет', () => {
    const s = src({ modeIds: ['detached_protector'] });
    const ty$ = buildConceptGraph(s, ty).gaps;
    const vy$ = buildConceptGraph(s, vy).gaps;
    expect(ty$.find((g) => g.id === 'unlinked')!.text).toMatch(
      /нажми на фигуру режима, чтобы связать/,
    );
    expect(vy$.find((g) => g.id === 'unlinked')!.text).toMatch(
      /нажмите на фигуру режима, чтобы связать/,
    );
    expect(ty$.find((g) => g.id === 'coping_without_child')!.text).toBe(
      vy$.find((g) => g.id === 'coping_without_child')!.text,
    );
  });
});
