// @vitest-environment jsdom
// Карточка «Коротко» (#902): строки сводки как список определений, пустой
// список — ничего; хук useConceptDigest склеивает черновик с сервером и
// терпит легаси-концептуализацию без полей связей.
import { describe, it, expect } from 'vitest';
import { render, renderHook, screen, within } from '@testing-library/react';
import { ConceptDigest, useConceptDigest } from './ConceptDigest';
import type { DigestRow } from './conceptDigestModel';
import { withPaper } from './conceptPaper.test-helpers';
import { ConceptSkinContext, type ConceptSkin } from './conceptSkin';

const SKIN: ConceptSkin = {
  seg: { group: 'sk-seg', btn: 'sk-seg-btn' },
  label: 'sk-label',
  link: 'sk-link',
  card: 'sk-card',
  fold: { root: 'f-root', btn: 'f-btn', chev: 'f-chev', body: 'f-body' },
  digest: {
    title: 'dg-title',
    list: 'dg-list',
    row: 'dg-row',
    term: 'dg-term',
    value: 'dg-value',
  },
};

const ROWS: DigestRow[] = [
  {
    key: 'schemas',
    label: 'Схемы',
    kind: 'chips',
    items: [{ text: 'Неуспешность', hue: 70 }],
    text: 'Неуспешность',
  },
  {
    key: 'modes',
    label: 'Режимы',
    kind: 'chips',
    items: [
      { text: 'Карающий Критик', hue: 310 },
      { text: '→', plain: 'arrow' },
      { text: 'Здоровый Взрослый', hue: 145 },
    ],
    text: 'Карающий Критик → Здоровый Взрослый',
  },
  {
    key: 'goal',
    label: 'Цель',
    kind: 'text',
    items: [{ text: 'Снизить тревогу' }],
    text: 'Снизить тревогу',
  },
];

describe('ConceptDigest', () => {
  it('карточка «Коротко»: метка и значение каждой строки, только чтение, в картинку не идёт', () => {
    render(<ConceptDigest rows={ROWS} />);
    const card = screen.getByRole('region', { name: 'Коротко' });
    expect(card.hasAttribute('data-export-skip')).toBe(true);
    const terms = within(card)
      .getAllByRole('term')
      .map((el) => el.textContent);
    expect(terms).toEqual(['Схемы', 'Режимы', 'Цель']);
    const values = within(card)
      .getAllByRole('definition')
      .map((el) => el.textContent);
    expect(values).toEqual([
      'Неуспешность',
      'Карающий КритикЗдоровый Взрослый',
      'Снизить тревогу',
    ]);
    expect(within(card).queryByRole('button')).toBeNull();
  });

  it('со skin: классы карточки и ярлыков, инлайн-вида нет', () => {
    render(
      <ConceptSkinContext.Provider value={SKIN}>
        <ConceptDigest rows={ROWS} />
      </ConceptSkinContext.Provider>,
    );
    const card = screen.getByRole('region', { name: 'Коротко' });
    expect(card.className).toBe('sk-card');
    expect(card.getAttribute('style')).toBeNull();
    // Раскладка ветки skin — классами, а не инлайном: инлайн margin/flex/lineHeight спорил с ds-label.
    const head = screen.getByRole('heading', { name: 'Коротко' });
    expect(head.className).toBe('sk-label dg-title');
    expect(head.getAttribute('style')).toBeNull();
    const list = card.querySelector('dl')!;
    expect(list.className).toBe('dg-list');
    expect(list.getAttribute('style')).toBeNull();
    for (const row of Array.from(list.children)) {
      expect(row.className).toBe('dg-row');
      expect(row.getAttribute('style')).toBeNull();
    }
    for (const t of within(card).getAllByRole('term')) {
      expect(t.className).toBe('sk-label dg-term');
      expect(t.getAttribute('style')).toBeNull();
    }
    const [schemas, modes, goal] = within(card).getAllByRole('definition');
    for (const d of [schemas, modes, goal]) {
      expect(d.className).toBe('dg-value');
      expect(d.getAttribute('style')).toBeNull();
    }
    // плашки сущностей — белые чипы без цвета в инлайне (не радуга), «→» — значок-путь, не глиф
    const chip = within(schemas).getByText('Неуспешность');
    expect(chip.className).toBe('cg-tag');
    expect(chip.getAttribute('style')).toBeNull();
    expect(
      within(modes).getByText('Карающий Критик').getAttribute('style'),
    ).toBeNull();
    expect(within(modes).queryByText('→')).toBeNull();
    expect(modes.querySelector('svg[data-mark="arrow"]')).toBeTruthy();
  });

  it('на бумаге сайта: знак раздела у метки строки, знак сущности в чипе, ✗ и ✓ — значками', () => {
    render(
      withPaper(
        <ConceptDigest
          rows={[
            {
              key: 'schemas',
              label: 'Схемы',
              kind: 'chips',
              items: [
                { text: 'Неуспешность', hue: 70, sign: 'domain_autonomy' },
              ],
              text: 'Неуспешность',
            },
            {
              key: 'needs',
              label: 'Потребности',
              kind: 'chips',
              items: [
                { text: '✗ блокированы:', plain: 'caption' },
                { text: 'Автономия', hue: 70, sign: 'need_autonomy' },
                { text: '✓ есть опора:', plain: 'caption' },
                { text: 'Границы', hue: 135, sign: 'need_limits' },
              ],
              text: '',
            },
          ]}
        />,
      ),
    );
    const [schemasTerm, needsTerm] = screen.getAllByRole('term');
    expect(schemasTerm.querySelector('[data-sign="layers"]')).toBeTruthy();
    expect(
      needsTerm
        .querySelector('[data-sign="strokes"]')
        ?.getAttribute('data-size'),
    ).toBe('row');
    expect(
      screen
        .getByText('Неуспешность')
        .querySelector('[data-sign="domain_autonomy"]'),
    ).toBeTruthy();
    const needs = screen.getAllByRole('definition')[1];
    // слова подписи остаются, глифов ✗ и ✓ в тексте нет — они нарисованы путём
    expect(needs.textContent).toBe('блокированы:Автономияесть опора:Границы');
    expect(needs.querySelector('svg[data-mark="block"]')).toBeTruthy();
    expect(needs.querySelector('svg[data-mark="meet"]')).toBeTruthy();
  });

  it('пустой список строк — карточки нет', () => {
    const { container } = render(<ConceptDigest rows={[]} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('useConceptDigest', () => {
  const concept = {
    schemaIds: ['failure'],
    modeIds: ['punitive_critic'],
    modeLinks: [],
    schemaLinks: [],
    goals: 'Снизить тревогу',
    modeTransitions: null,
  };

  it('черновик сильнее сервера: цель и режимы из localConcept', () => {
    const { result } = renderHook(() =>
      useConceptDigest(concept, {
        goals: 'Вернуть злость',
        modeIds: ['punitive_critic', 'healthy_adult'],
      }),
    );
    expect(result.current.map((r) => [r.key, r.text])).toEqual([
      ['schemas', 'Неуспешность'],
      ['modes', 'Карающий Критик → Здоровый Взрослый'],
      ['goal', 'Вернуть злость'],
    ]);
  });

  it('концептуализации нет — строк нет; легаси без modeLinks/schemaLinks не роняет', () => {
    expect(renderHook(() => useConceptDigest(null)).result.current).toEqual([]);
    expect(
      renderHook(() => useConceptDigest(undefined, {})).result.current,
    ).toEqual([]);
    const legacy = { schemaIds: ['failure'], modeIds: [], goals: null };
    expect(
      renderHook(() => useConceptDigest(legacy)).result.current.map(
        (r) => r.key,
      ),
    ).toEqual(['schemas']);
  });
});
