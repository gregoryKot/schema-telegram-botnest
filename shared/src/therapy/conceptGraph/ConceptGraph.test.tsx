// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import {
  Harness,
  badges,
  edgeOpacity,
  edges,
  modeFigure,
  needPill,
  schemaFigure,
} from './ConceptGraph.test-helpers';
import { emptyModeLink } from './modeLinks';
import { emptySchemaLink } from './schemaLinks';
import { STRATEGY_HINTS } from './modeLanes';

const CASE = {
  modeIds: ['guilt_critic', 'detached_protector', 'healthy_adult'],
  schemaIds: ['emotional_deprivation', 'emotional_inhibition'],
  modeLinks: [
    {
      ...emptyModeLink('guilt_critic'),
      manifest: 'Если я заявлю о своих потребностях, близким будет плохо',
      schemaIds: ['emotional_deprivation'],
    },
    {
      ...emptyModeLink('detached_protector'),
      alias: 'Глиняная оболочка',
      manifest: 'Перестаёт чувствовать, говорит на отстранённые темы',
      schemaIds: ['emotional_inhibition'],
    },
    {
      ...emptyModeLink('healthy_adult'),
      manifest: 'Я имею право на поддержку и заботу',
      needIds: ['autonomy', 'play'],
    },
  ],
  schemaLinks: [
    {
      schemaId: 'emotional_deprivation',
      belief: 'Я верю, что мои переживания не имеют смысла',
      origin: 'Был вынужден поддерживать маму после ухода папы',
      needIds: ['attachment', 'expression'],
    },
    {
      ...emptySchemaLink('emotional_inhibition'),
      belief: 'Кажется, что я просто ничего не чувствую',
      needIds: ['expression'],
    },
  ],
};

const guideButton = () =>
  screen.getByRole('button', { name: /Как читать схему/ });
const openGuide = () => fireEvent.click(guideButton());
const gapsButton = () =>
  screen.getByRole('button', { name: /Подсказки по схеме/ });
const skipped = (el: Element) => el.closest('[data-export-skip]') !== null;

describe('ConceptGraph: общий вид', () => {
  it('«Как читать схему»: на пустой схеме открыта, на заполненной свёрнута и открывается кликом; подсказки о пробелах — не в ней', () => {
    const { unmount } = render(<Harness initial={{}} />);
    expect(guideButton().getAttribute('aria-expanded')).toBe('true');
    expect(
      screen.getByText(/Схема случая: в центре базовые потребности/),
    ).toBeTruthy();
    unmount();

    render(<Harness initial={{ modeIds: ['detached_protector'] }} />);
    expect(guideButton().getAttribute('aria-expanded')).toBe('false');
    expect(
      screen.queryByText(/Схема случая: в центре базовые потребности/),
    ).toBeNull();
    expect(screen.queryByRole('note')).toBeNull();
    openGuide();
    expect(
      screen.getByText(/Схема случая: в центре базовые потребности/),
    ).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
    fireEvent.click(gapsButton());
    expect(screen.getAllByRole('note')[0].textContent).toMatch(/Копинги есть/);
  });

  it('подсказки о пробелах — под схемой и свёрнуты; ни они, ни инструкция в картинку не идут', () => {
    render(<Harness initial={{ modeIds: ['detached_protector'] }} />);
    const fold = gapsButton();
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    expect(fold.textContent).toMatch(/Подсказки по схеме · \d/);
    // Под фигурами, а не над ними: плашка, появившаяся после тапа в выборе
    // «+ режим», не сдвигает схему и выбор под пальцем.
    const order = modeFigure('Отстранённый Защитник').compareDocumentPosition(
      fold,
    );
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(skipped(guideButton())).toBe(true);
    expect(skipped(fold)).toBe(true);
    fireEvent.click(fold);
    expect(skipped(screen.getAllByRole('note')[0])).toBe(true);
    expect(skipped(modeFigure('Отстранённый Защитник'))).toBe(false);
  });

  it('пустая по режимам, но со схемой — не пустая: инструкция свёрнута', () => {
    render(<Harness initial={{ schemaIds: ['emotional_deprivation'] }} />);
    expect(guideButton().getAttribute('aria-expanded')).toBe('false');
  });

  it('пустая концептуализация: вводный текст дословно, три заготовки, круг с пятью потребностями, ни линий, ни подсказок', () => {
    render(<Harness initial={{}} />);
    expect(
      screen.getByText(
        'Схема случая: в центре базовые потребности. Слева схемы — во что человек верит и какой детский опыт их сформировал; ✗ отмечает потребность, которую схема блокирует. Ещё левее режимы, которые эти схемы включают. Справа Здоровый Взрослый: ✓ — потребности, о которых он уже умеет заботиться.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Нажми на схему или режим, чтобы записать текст — он появится на схеме. Карта меняется вместе с терапией — прошлые версии остаются в истории.',
      ),
    ).toBeTruthy();
    for (const text of [
      'Режим не отмечен',
      'Схема не отмечена',
      'Здоровый Взрослый не отмечен',
    ]) {
      expect(screen.getByRole('button', { name: text })).toBeTruthy();
    }
    expect(document.querySelector('[data-needs-circle]')).toBeTruthy();
    expect(screen.getByText('Базовые эмоциональные потребности')).toBeTruthy();
    for (const name of [
      'Привязанность',
      'Автономия',
      'Выражение чувств',
      'Спонтанность',
      'Границы',
    ]) {
      expect(needPill(name).getAttribute('aria-pressed')).toBe('false');
    }
    expect(edges()).toHaveLength(0);
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByText(/Как режимы сменяют друг друга/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
  });

  it('форма «вы» меняет вводный текст и подсказку о связях', () => {
    render(<Harness initial={{ modeIds: ['vulnerable_child'] }} form="vy" />);
    openGuide();
    expect(
      screen.getByText(
        'Нажмите на схему или режим, чтобы записать текст — он появится на схеме. Карта меняется вместе с терапией — прошлые версии остаются в истории.',
      ),
    ).toBeTruthy();
    fireEvent.click(gapsButton());
    expect(
      screen.getByText(
        /нажмите на фигуру режима, чтобы связать его со схемами/,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Нажми на схему/)).toBeNull();
  });

  it('тексты терапевта стоят на своих фигурах: что говорит критик, убеждение схемы, опыт в овале, опора Здорового Взрослого', () => {
    render(<Harness initial={CASE} />);
    expect(
      within(modeFigure('Внушающий Вину Критик')).getByText(
        'Если я заявлю о своих потребностях, близким будет плохо',
      ),
    ).toBeTruthy();
    expect(
      within(schemaFigure('Эмоциональная депривация')).getByText(
        'Я верю, что мои переживания не имеют смысла',
      ),
    ).toBeTruthy();
    const origin = screen.getByRole('button', {
      name: 'Как нарушалась потребность: схема Эмоциональная депривация',
    });
    expect(within(origin).getByText('Как нарушалась потребность')).toBeTruthy();
    expect(
      within(origin).getByText(
        'Был вынужден поддерживать маму после ухода папы',
      ),
    ).toBeTruthy();
    expect(
      within(modeFigure('Здоровый Взрослый')).getByText(
        'Я имею право на поддержку и заботу',
      ),
    ).toBeTruthy();
    // овала у схемы без опыта нет
    expect(
      screen.queryByRole('button', {
        name: /Как нарушалась потребность: схема Эмоциональная скованность/,
      }),
    ).toBeNull();
  });

  it('фигуры по типу, имя клиента — главная строка, название режима — мелко', () => {
    render(<Harness initial={CASE} />);
    const protector = modeFigure('Отстранённый Защитник');
    expect(within(protector).getByText('Глиняная оболочка')).toBeTruthy();
    expect(within(protector).getByText('Отстранённый Защитник')).toBeTruthy();
    expect(protector.dataset.shape).toBe('shield');
    expect(modeFigure('Внушающий Вину Критик').dataset.shape).toBe('octagon');
    expect(modeFigure('Здоровый Взрослый').dataset.shape).toBe('rounded');
    expect(schemaFigure('Эмоциональная депривация').dataset.shape).toBe(
      'rounded',
    );
  });

  it('режим и схема без связей помечены «связи не заполнены» (для чтения с экрана), со связями — нет', () => {
    render(
      <Harness
        initial={{
          modeIds: ['vulnerable_child', 'punitive_critic'],
          schemaIds: ['failure', 'mistrust'],
          modeLinks: [{ ...emptyModeLink('punitive_critic'), alias: 'Судья' }],
          schemaLinks: [{ ...emptySchemaLink('failure'), belief: 'я хуже' }],
        }}
      />,
    );
    const hint = 'связи не заполнены';
    expect(within(modeFigure('Уязвимый Ребёнок')).getByText(hint)).toBeTruthy();
    expect(
      modeFigure('Уязвимый Ребёнок').getAttribute('aria-describedby'),
    ).toBeTruthy();
    expect(within(modeFigure('Карающий Критик')).queryByText(hint)).toBeNull();
    expect(
      within(
        schemaFigure('Недоверие / Ожидание жестокого обращения'),
      ).getByText(hint),
    ).toBeTruthy();
    expect(within(schemaFigure('Неуспешность')).queryByText(hint)).toBeNull();
  });

  it('подсказки о пробелах — плашками; порядок смены режимов — строкой', () => {
    render(
      <Harness
        initial={{
          modeIds: ['detached_protector'],
          modeTransitions: 'Критик → Защитник',
        }}
      />,
    );
    fireEvent.click(gapsButton());
    expect(screen.getAllByRole('note')[0].textContent).toMatch(
      /Копинги есть, а детского режима нет/,
    );
    expect(
      screen.getByText('Как режимы сменяют друг друга:').parentElement
        ?.textContent,
    ).toBe('Как режимы сменяют друг друга: Критик → Защитник');
  });

  it('нет ни одной фигуры или текста от прежней зонной раскладки: триггер, цели, проблемы, «давит», «цена»', () => {
    render(<Harness initial={CASE} />);
    expect(document.body.textContent).not.toMatch(
      /давит|Цена|запускает|За кулисами|Корни|Цели терапии/,
    );
  });
});

describe('ConceptGraph: ✗, ✓ и подсветка', () => {
  it('значки рисуются по needIds: ✗ на каждую блокируемую потребность схемы, ✓ — на каждую опору Здорового Взрослого', () => {
    render(<Harness initial={CASE} />);
    expect(badges('block')).toHaveLength(3);
    expect(badges('meet')).toHaveLength(2);
    expect(edges().filter((e) => e.dataset.kind === 'blocks')).toHaveLength(3);
    expect(edges().filter((e) => e.dataset.kind === 'meets')).toHaveLength(2);
  });

  it('нет needIds — нет значков; needIds обычных режимов линий не дают', () => {
    render(
      <Harness
        initial={{
          modeIds: ['vulnerable_child'],
          modeLinks: [
            { ...emptyModeLink('vulnerable_child'), needIds: ['limits'] },
          ],
        }}
      />,
    );
    expect(badges('block')).toHaveLength(0);
    expect(badges('meet')).toHaveLength(0);
    expect(edges()).toHaveLength(0);
  });

  it('значки сделаны контуром, а не символом: нет текстовых ✗ и ✓ внутри диаграммы', () => {
    render(<Harness initial={CASE} />);
    const diagram = document.querySelector('[data-concept-diagram]')!;
    expect(diagram.textContent).not.toMatch(/[✗✓✕✔]/);
    expect(diagram.querySelector('[data-badge="block"] path')).toBeTruthy();
  });

  it('нажатая потребность: aria-pressed, её ✗ и ✓ яркие, остальные приглушены; повторный тап снимает', () => {
    render(<Harness initial={CASE} />);
    const base = edgeOpacity(edges()[0]);
    expect(base).toBeGreaterThan(0.3);
    const pill = needPill('Выражение чувств');
    fireEvent.click(pill);
    expect(pill.getAttribute('aria-pressed')).toBe('true');
    const own = edges().filter((e) =>
      e.dataset.edge?.endsWith('>need:expression'),
    );
    const rest = edges().filter(
      (e) => !e.dataset.edge?.endsWith('>need:expression'),
    );
    expect(own).toHaveLength(2);
    for (const e of own) expect(edgeOpacity(e)).toBe(1);
    for (const e of rest) expect(edgeOpacity(e)).toBeLessThan(0.2);
    fireEvent.click(pill);
    expect(pill.getAttribute('aria-pressed')).toBe('false');
    expect(edgeOpacity(edges()[0])).toBe(base);
  });

  it('тап по режиму или схеме подсвечивает их линии и снимает нажатие потребности', () => {
    render(<Harness initial={CASE} />);
    const pill = needPill('Привязанность');
    fireEvent.click(pill);
    fireEvent.click(modeFigure('Внушающий Вину Критик'));
    expect(pill.getAttribute('aria-pressed')).toBe('false');
    const link = edges().find(
      (e) =>
        e.dataset.edge ===
        'link:mode:guilt_critic>schema:emotional_deprivation',
    )!;
    const other = edges().find(
      (e) =>
        e.dataset.edge ===
        'link:mode:detached_protector>schema:emotional_inhibition',
    )!;
    expect(edgeOpacity(link)).toBe(1);
    expect(edgeOpacity(other)).toBeLessThan(0.2);
    fireEvent.click(schemaFigure('Эмоциональная скованность'));
    expect(edgeOpacity(other)).toBe(1);
    expect(edgeOpacity(link)).toBeLessThan(0.2);
  });
});

describe('ConceptGraph: узкий вид', () => {
  it('те же фигуры, линии и значки на ширине телефона', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    const spy = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(358);
    try {
      render(<Harness initial={CASE} />);
      const box = document.querySelector<HTMLElement>(
        '[data-concept-diagram]',
      )!;
      expect(box.querySelector('svg')!.getAttribute('width')).toBe('358');
      expect(modeFigure('Внушающий Вину Критик')).toBeTruthy();
      expect(schemaFigure('Эмоциональная депривация')).toBeTruthy();
      expect(badges('block')).toHaveLength(3);
      expect(badges('meet')).toHaveLength(2);
    } finally {
      spy.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});

describe('ConceptGraph: редактор режима', () => {
  const base = { modeIds: ['vulnerable_child'], schemaIds: ['failure'] };
  const open = (name: string) => fireEvent.click(modeFigure(name));

  it('тап по фигуре открывает редактор, повторный тап и «Готово» закрывают', () => {
    render(<Harness initial={base} />);
    expect(screen.queryByLabelText('Как называет клиент')).toBeNull();
    open('Уязвимый Ребёнок');
    expect(screen.getByLabelText('Как называет клиент')).toBeTruthy();
    expect(modeFigure('Уязвимый Ребёнок').getAttribute('aria-expanded')).toBe(
      'true',
    );
    open('Уязвимый Ребёнок');
    expect(screen.queryByLabelText('Как называет клиент')).toBeNull();
    open('Уязвимый Ребёнок');
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(screen.queryByLabelText('Как называет клиент')).toBeNull();
  });

  it('открытый редактор подвозится к глазам', () => {
    const scrollIntoView = vi.fn();
    const orig = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<Harness initial={base} />);
      open('Уязвимый Ребёнок');
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(
        screen.getByRole('region', { name: 'Уязвимый Ребёнок: связи' }),
      );
    } finally {
      HTMLElement.prototype.scrollIntoView = orig;
    }
  });

  it('ввод имени зовёт onChangeLink; сохранение → отображение на фигуре', () => {
    const onChangeLink = vi.fn();
    render(<Harness initial={base} spies={{ onChangeLink }} />);
    open('Уязвимый Ребёнок');
    const input = screen.getByLabelText<HTMLInputElement>(
      'Как называет клиент',
    );
    expect(input.maxLength).toBe(80);
    fireEvent.change(input, { target: { value: 'Маленькая Аня' } });
    expect(onChangeLink).toHaveBeenLastCalledWith({
      ...emptyModeLink('vulnerable_child'),
      alias: 'Маленькая Аня',
    });
    expect(
      within(modeFigure('Уязвимый Ребёнок')).getByText('Маленькая Аня'),
    ).toBeTruthy();
  });

  it('подпись текста зависит от группы режима и объясняет, что он виден на схеме', () => {
    const expected: [string, string, string][] = [
      ['punitive_critic', 'Карающий Критик', 'Что говорит'],
      ['vulnerable_child', 'Уязвимый Ребёнок', 'Что чувствует и чего хочет'],
      [
        'detached_protector',
        'Отстранённый Защитник',
        'Что делает и как это выглядит',
      ],
      ['healthy_adult', 'Здоровый Взрослый', 'На что опирается'],
    ];
    for (const [id, name, label] of expected) {
      const { unmount } = render(<Harness initial={{ modeIds: [id] }} />);
      open(name);
      expect(screen.getByLabelText(label)).toBeTruthy();
      expect(screen.getByText('Этот текст виден на схеме')).toBeTruthy();
      expect(screen.queryByLabelText('Как проявляется сейчас')).toBeNull();
      unmount();
    }
  });

  it('подсказка-поле критика и Здорового Взрослого — слова из образца владельца', () => {
    render(
      <Harness initial={{ modeIds: ['punitive_critic', 'healthy_adult'] }} />,
    );
    open('Карающий Критик');
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Что говорит').placeholder,
    ).toBe('Его словами: «Слабых бросают», «Сначала заслужи»');
    open('Карающий Критик');
    open('Здоровый Взрослый');
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('На что опирается')
        .placeholder,
    ).toBe(
      'Что говорит себе и чем это подтверждается: «Я имею право…», «У меня получилось…»',
    );
  });

  it('текст режима, введённый в редакторе, виден на фигуре сразу (сохранил → нашёл)', () => {
    render(<Harness initial={{ modeIds: ['punitive_critic'] }} />);
    open('Карающий Критик');
    fireEvent.change(screen.getByLabelText('Что говорит'), {
      target: { value: 'Слабых бросают' },
    });
    expect(
      within(modeFigure('Карающий Критик')).getByText('Слабых бросают'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    open('Карающий Критик');
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Что говорит').value,
    ).toBe('Слабых бросают');
  });

  it('поле потребностей только у здорового режима («О каких потребностях уже умеет заботиться»), у критика его нет', () => {
    const onChangeLink = vi.fn();
    render(
      <Harness
        initial={{ modeIds: ['healthy_adult', 'punitive_critic'] }}
        spies={{ onChangeLink }}
      />,
    );
    open('Карающий Критик');
    expect(
      screen.queryByRole('group', {
        name: 'О каких потребностях уже умеет заботиться',
      }),
    ).toBeNull();
    expect(
      screen.getByRole('group', { name: 'Какие схемы включают режим' }),
    ).toBeTruthy();
    open('Карающий Критик');
    open('Здоровый Взрослый');
    expect(
      screen.queryByRole('group', { name: 'Какие схемы включают режим' }),
    ).toBeNull();
    const needs = within(
      screen.getByRole('group', {
        name: 'О каких потребностях уже умеет заботиться',
      }),
    );
    fireEvent.click(needs.getByRole('button', { name: /Автономия/ }));
    expect(onChangeLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ needIds: ['autonomy'] }),
    );
    // ✓ рисуется сразу
    expect(badges('meet')).toHaveLength(1);
  });

  it('«Откуда режим» не показывается на фигуре, но живёт в связи', () => {
    render(<Harness initial={base} />);
    open('Уязвимый Ребёнок');
    fireEvent.change(screen.getByLabelText('Откуда режим'), {
      target: { value: 'мама уезжала' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(screen.queryByText('мама уезжала')).toBeNull();
    open('Уязвимый Ребёнок');
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Откуда режим').value,
    ).toBe('мама уезжала');
  });

  it('«Взять за основу» кладёт подсказку метода в поле и пропадает', () => {
    const onChangeLink = vi.fn();
    render(<Harness initial={base} spies={{ onChangeLink }} />);
    open('Уязвимый Ребёнок');
    fireEvent.click(screen.getByRole('button', { name: 'Взять за основу' }));
    expect(onChangeLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ strategy: STRATEGY_HINTS.vulnerable }),
    );
    expect(
      screen.queryByRole('button', { name: 'Взять за основу' }),
    ).toBeNull();
  });

  it('схема режима: чип ставит её и рисует линию ⇄; повторный тап снимает линию', () => {
    const onChangeLink = vi.fn();
    render(<Harness initial={base} spies={{ onChangeLink }} />);
    open('Уязвимый Ребёнок');
    expect(edges()).toHaveLength(0);
    const schemas = within(
      screen.getByRole('group', { name: 'Какие схемы включают режим' }),
    );
    fireEvent.click(schemas.getByRole('button', { name: /Неуспешность/ }));
    expect(onChangeLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ schemaIds: ['failure'] }),
    );
    expect(edges().filter((e) => e.dataset.kind === 'link')).toHaveLength(1);
    fireEvent.click(schemas.getByRole('button', { name: /Неуспешность/ }));
    expect(edges()).toHaveLength(0);
  });

  it('схема вне концептуализации: «Все схемы» → выбор зовёт и onAddSchema, и onChangeLink, схема появляется на схеме', () => {
    const onChangeLink = vi.fn();
    const onAddSchema = vi.fn();
    render(<Harness initial={base} spies={{ onChangeLink, onAddSchema }} />);
    open('Уязвимый Ребёнок');
    const schemas = within(
      screen.getByRole('group', { name: 'Какие схемы включают режим' }),
    );
    fireEvent.click(schemas.getByRole('button', { name: 'Все схемы' }));
    fireEvent.click(schemas.getByRole('button', { name: /Покинутость/ }));
    expect(onAddSchema).toHaveBeenCalledWith('abandonment');
    expect(onChangeLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ schemaIds: ['abandonment'] }),
    );
    expect(schemaFigure('Покинутость / Нестабильность')).toBeTruthy();
  });

  it('схем в концептуализации нет: сразу все 20 и подсказка; список не схлопывается после выбора', () => {
    render(<Harness initial={{ modeIds: ['vulnerable_child'] }} />);
    open('Уязвимый Ребёнок');
    const schemas = within(
      screen.getByRole('group', { name: 'Какие схемы включают режим' }),
    );
    expect(
      schemas.getByText(/Схемы в концептуализации ещё не отмечены/),
    ).toBeTruthy();
    expect(schemas.getAllByRole('button')).toHaveLength(21);
    fireEvent.click(schemas.getByRole('button', { name: /Покинутость/ }));
    expect(schemas.getAllByRole('button')).toHaveLength(21);
  });

  it('«Убрать режим с карты» снимает режим и закрывает редактор; связь остаётся в данных', () => {
    const onToggleMode = vi.fn();
    render(
      <Harness
        initial={{
          ...base,
          modeLinks: [{ ...emptyModeLink('vulnerable_child'), alias: 'Аня' }],
        }}
        spies={{ onToggleMode }}
      />,
    );
    open('Уязвимый Ребёнок');
    fireEvent.click(
      screen.getByRole('button', { name: 'Убрать режим с карты' }),
    );
    expect(onToggleMode).toHaveBeenCalledWith('vulnerable_child');
    expect(screen.queryByLabelText('Как называет клиент')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Уязвимый Ребёнок: связи' }),
    ).toBeNull();
    // вернули режим — вернулись и связи, редактор сам не открывается
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Режимы' })).getByRole(
        'button',
        { name: '+ режим' },
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /Уязвимый Ребёнок/ }));
    expect(
      within(modeFigure('Уязвимый Ребёнок')).getByText('Аня'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Как называет клиент')).toBeNull();
  });
});
