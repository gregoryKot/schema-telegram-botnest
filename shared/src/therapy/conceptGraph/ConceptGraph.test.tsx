// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ConceptModeLink } from '../../apiTypes';
import { AddressFormContext } from '../../utils/addressForm';
import { ConceptGraph } from './ConceptGraph';
import type { ConceptGraphSource } from './conceptGraphTypes';
import { emptyModeLink, upsertModeLink } from './modeLinks';
import { STRATEGY_HINTS } from './modeLanes';

interface Spies {
  onToggleMode?: (id: string) => void;
  onChangeLink?: (l: ConceptModeLink) => void;
  onAddSchema?: (id: string) => void;
  track?: (name: string, meta?: Record<string, unknown>) => void;
}

/** Хозяин состояния, как фронтенд: колбэки графа меняют source, который он рисует. */
function Harness({
  initial,
  spies = {},
  form = 'ty',
}: {
  initial: Partial<ConceptGraphSource>;
  spies?: Spies;
  form?: 'ty' | 'vy';
}) {
  const [src, setSrc] = useState<ConceptGraphSource>({
    modeIds: [],
    schemaIds: [],
    modeLinks: [],
    ...initial,
  });
  return (
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      <ConceptGraph
        source={src}
        track={spies.track ?? (() => {})}
        onToggleMode={(id) => {
          spies.onToggleMode?.(id);
          setSrc((s) => ({
            ...s,
            modeIds: s.modeIds.includes(id)
              ? s.modeIds.filter((x) => x !== id)
              : [...s.modeIds, id],
          }));
        }}
        onChangeLink={(l) => {
          spies.onChangeLink?.(l);
          setSrc((s) => ({ ...s, modeLinks: upsertModeLink(s.modeLinks, l) }));
        }}
        onAddSchema={(id) => {
          spies.onAddSchema?.(id);
          setSrc((s) => ({ ...s, schemaIds: [...s.schemaIds, id] }));
        }}
      />
    </AddressFormContext.Provider>
  );
}

const card = (name: string) =>
  screen.getByRole('button', { name: `${name}: связи` });
const openEditor = (name: string) => fireEvent.click(card(name));
const placeholder = (title: RegExp) => screen.getByTitle(title);
const edges = () =>
  Array.from(document.querySelectorAll<SVGPathElement>('path[data-edge]'));
const edgeOpacity = (el: Element) => Number((el as SVGElement).style.opacity);

describe('ConceptGraph: общий вид', () => {
  it('пустая концептуализация: вводный текст, четыре заготовки с объяснением дефицита, ни блоков, ни линий', () => {
    render(<Harness initial={{}} />);
    expect(
      screen.getByText(
        /Схема случая по модели режимов: наверху опора и цели, ниже корни и схемы — линии ведут к режимам, которые они питают\. За кулисами Критик давит на Ребёнка, на сцене копинги, внизу их цена\. Пустая клетка тоже говорит о случае — её стоит обсудить\./,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Нажми на режим — откроются его связи; на схему или потребность — подсветятся её линии\. Карта меняется вместе с терапией/,
      ),
    ).toBeTruthy();
    expect(placeholder(/Здорового Взрослого стоит назвать/).textContent).toBe(
      'Здоровый Взрослый не отмечен',
    );
    expect(placeholder(/Без детского режима непонятно/).textContent).toBe(
      'Детский режим не отмечен',
    );
    expect(placeholder(/критикующий голос не отмечен/).textContent).toBe(
      'Критик не отмечен',
    );
    expect(placeholder(/Копинг обычно виден первым/).textContent).toBe(
      'Копинг не отмечен',
    );
    expect(screen.getByText('За кулисами')).toBeTruthy();
    expect(edges()).toHaveLength(0);
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByText(/Как режимы сменяют друг друга/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
  });

  it('форма «вы» меняет вводный текст и подсказку про связи', () => {
    render(<Harness initial={{ modeIds: ['vulnerable_child'] }} form="vy" />);
    expect(
      screen.getByText(/Нажмите на режим — откроются его связи; на схему или/),
    ).toBeTruthy();
    expect(
      screen.getByText(/нажмите на фигуру режима, чтобы добавить схемы/),
    ).toBeTruthy();
    expect(screen.queryByText(/Нажми на режим/)).toBeNull();
  });

  it('тексты концептуализации попадают в свои фигуры: цели — к здоровым режимам, триггер — к детям', () => {
    render(
      <Harness
        initial={{
          modeIds: ['healthy_adult', 'vulnerable_child'],
          triggers: 'критика на работе',
          goals: 'научиться отдыхать',
          currentProblems: 'выгорание',
          modeTransitions: 'Критик → Уязвимый',
          earlyExperience: 'строгий отец',
          unmetNeeds: 'нужна опора',
        }}
      />,
    );
    const shape = (text: string) =>
      screen.getByText(text).closest('[data-node]') as HTMLElement;
    expect(shape('научиться отдыхать').dataset.node).toBe('goals');
    expect(
      within(shape('научиться отдыхать')).getByText('Цели терапии'),
    ).toBeTruthy();
    expect(shape('критика на работе').dataset.shape).toBe('cloud');
    expect(shape('выгорание').dataset.shape).toBe('tag');
    expect(shape('строгий отец').dataset.node).toBe('experience');
    expect(shape('нужна опора').dataset.node).toBe('unmet');
    expect(
      screen.getByText('Как режимы сменяют друг друга:').parentElement
        ?.textContent,
    ).toBe('Как режимы сменяют друг друга: Критик → Уязвимый');
  });

  it('подсказки о пробелах показываются плашками', () => {
    render(<Harness initial={{ modeIds: ['detached_protector'] }} />);
    const notes = screen.getAllByRole('note').map((n) => n.textContent);
    expect(notes[0]).toMatch(/Копинги есть, а детского режима нет/);
  });
});

describe('ConceptGraph: фигура режима', () => {
  it('имя клиента — главная строка, название режима — мелко, копинг помечен видом (формой и подписью)', () => {
    render(
      <Harness
        initial={{
          modeIds: [
            'punitive_critic',
            'detached_protector',
            'vulnerable_child',
          ],
          modeLinks: [{ ...emptyModeLink('punitive_critic'), alias: 'Судья' }],
        }}
      />,
    );
    const critic = card('Карающий Критик');
    expect(within(critic).getByText('Судья')).toBeTruthy();
    expect(within(critic).getByText('Карающий Критик')).toBeTruthy();
    expect(critic.dataset.shape).toBe('octagon');
    const coping = card('Отстранённый Защитник');
    expect(coping.dataset.shape).toBe('shield');
    expect(within(coping).getByText('Избегание')).toBeTruthy();
    expect(card('Уязвимый Ребёнок').dataset.shape).toBe('ellipse');
  });

  it('режим без связей помечен «связи не заполнены» (для чтения с экрана), со связями — нет', () => {
    render(
      <Harness
        initial={{
          modeIds: ['detached_protector', 'vulnerable_child'],
          schemaIds: ['failure'],
          modeLinks: [
            { ...emptyModeLink('vulnerable_child'), schemaIds: ['failure'] },
          ],
        }}
      />,
    );
    const empty = card('Отстранённый Защитник');
    expect(within(empty).getByText('связи не заполнены')).toBeTruthy();
    expect(empty.getAttribute('aria-describedby')).toBeTruthy();
    expect(
      within(card('Уязвимый Ребёнок')).queryByText('связи не заполнены'),
    ).toBeNull();
  });

  it('все схемы режима — фигуры со своей линией (без «+N»), потребности — отдельные фигуры с пунктиром', () => {
    render(
      <Harness
        initial={{
          modeIds: ['vulnerable_child'],
          modeLinks: [
            {
              ...emptyModeLink('vulnerable_child'),
              schemaIds: [
                'abandonment',
                'failure',
                'mistrust',
                'defectiveness',
                'dependence',
              ],
              needIds: ['attachment'],
              origin: 'первая строка\nвторая строка',
            },
          ],
        }}
      />,
    );
    for (const name of [
      /Покинутость/,
      /Неуспешность/,
      /Недоверие/,
      /Дефективность/,
      /Зависимость/,
    ]) {
      expect(screen.getByRole('button', { name, pressed: false })).toBeTruthy();
    }
    const need = screen.getByRole('button', {
      name: 'Привязанность',
      pressed: false,
    });
    expect(need.dataset.node).toBe('need:attachment');
    expect(edges().filter((e) => e.dataset.kind === 'feeds')).toHaveLength(5);
    const dashed = edges().filter((e) => e.dataset.kind === 'need');
    expect(dashed).toHaveLength(1);
    expect(dashed[0].getAttribute('stroke-dasharray')).toBeTruthy();
    expect(
      within(card('Уязвимый Ребёнок')).queryByText('связи не заполнены'),
    ).toBeNull();
    expect(screen.queryByText(/\+\d/)).toBeNull();
  });

  it('снятая связь убирает линию: сохранение → отображение на линиях', () => {
    render(
      <Harness
        initial={{
          modeIds: ['vulnerable_child'],
          schemaIds: ['failure'],
          modeLinks: [
            { ...emptyModeLink('vulnerable_child'), schemaIds: ['failure'] },
          ],
        }}
      />,
    );
    expect(edges()).toHaveLength(1);
    openEditor('Уязвимый Ребёнок');
    const schemas = within(
      screen.getByRole('group', { name: 'Какие схемы питают режим' }),
    );
    fireEvent.click(schemas.getByRole('button', { name: /Неуспешность/ }));
    expect(edges()).toHaveLength(0);
    fireEvent.click(schemas.getByRole('button', { name: /Неуспешность/ }));
    expect(edges()).toHaveLength(1);
  });
});

describe('ConceptGraph: линии и подсветка', () => {
  const linked = {
    modeIds: ['vulnerable_child', 'punitive_critic'],
    schemaIds: ['abandonment', 'defectiveness'],
    modeLinks: [
      { ...emptyModeLink('vulnerable_child'), schemaIds: ['abandonment'] },
      { ...emptyModeLink('punitive_critic'), schemaIds: ['defectiveness'] },
    ],
  };
  const edgeTo = (modeId: string) =>
    edges().find(
      (e) =>
        e.dataset.edge?.endsWith(`>mode:${modeId}`) &&
        e.dataset.kind === 'feeds',
    )!;

  it('нажатая схема: aria-pressed, её линия яркая, остальные приглушены; повторный тап снимает', () => {
    render(<Harness initial={linked} />);
    const base = edgeOpacity(edgeTo('vulnerable_child'));
    expect(base).toBeGreaterThan(0.3);
    expect(base).toBeLessThan(0.7);
    const pill = screen.getByRole('button', {
      name: /Покинутость/,
      pressed: false,
    });
    fireEvent.click(pill);
    expect(pill.getAttribute('aria-pressed')).toBe('true');
    expect(edgeOpacity(edgeTo('vulnerable_child'))).toBe(1);
    expect(edgeOpacity(edgeTo('punitive_critic'))).toBeLessThan(0.2);
    fireEvent.click(pill);
    expect(pill.getAttribute('aria-pressed')).toBe('false');
    expect(edgeOpacity(edgeTo('vulnerable_child'))).toBe(base);
    expect(edgeOpacity(edgeTo('punitive_critic'))).toBe(base);
  });

  it('нажатая потребность подсвечивает свои линии так же', () => {
    render(
      <Harness
        initial={{
          ...linked,
          modeLinks: [
            { ...linked.modeLinks[0], needIds: ['attachment'] },
            { ...linked.modeLinks[1], needIds: ['limits'] },
          ],
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Привязанность', pressed: false }),
    );
    const needEdge = (id: string) =>
      edges().find(
        (e) =>
          e.dataset.edge ===
          `need:need:${id}>mode:${id === 'attachment' ? 'vulnerable_child' : 'punitive_critic'}`,
      )!;
    expect(edgeOpacity(needEdge('attachment'))).toBe(1);
    expect(edgeOpacity(needEdge('limits'))).toBeLessThan(0.2);
  });

  it('открытый режим тоже подсвечивает свои линии, закрытие возвращает как было', () => {
    render(<Harness initial={linked} />);
    openEditor('Карающий Критик');
    expect(edgeOpacity(edgeTo('punitive_critic'))).toBe(1);
    expect(edgeOpacity(edgeTo('vulnerable_child'))).toBeLessThan(0.2);
    openEditor('Карающий Критик');
    expect(edgeOpacity(edgeTo('vulnerable_child'))).toBeGreaterThan(0.3);
  });

  it('тап по режиму снимает нажатие схемы: подсвечивается открытый режим', () => {
    render(<Harness initial={linked} />);
    const pill = screen.getByRole('button', {
      name: /Покинутость/,
      pressed: false,
    });
    fireEvent.click(pill);
    openEditor('Карающий Критик');
    expect(pill.getAttribute('aria-pressed')).toBe('false');
    expect(edgeOpacity(edgeTo('punitive_critic'))).toBe(1);
  });

  it('схема, снятая вместе с режимом, не оставляет схему приглушённой навсегда', () => {
    render(<Harness initial={linked} />);
    fireEvent.click(
      screen.getByRole('button', { name: /Покинутость/, pressed: false }),
    );
    openEditor('Уязвимый Ребёнок');
    fireEvent.click(
      screen.getByRole('button', { name: 'Убрать режим с карты' }),
    );
    expect(edgeOpacity(edgeTo('punitive_critic'))).toBeGreaterThan(0.3);
  });
});

describe('ConceptGraph: редактор связей', () => {
  const base = { modeIds: ['vulnerable_child'], schemaIds: ['failure'] };

  it('тап по фигуре режима открывает редактор, повторный тап и «Готово» закрывают', () => {
    render(<Harness initial={base} />);
    expect(screen.queryByLabelText('Как называет клиент')).toBeNull();
    openEditor('Уязвимый Ребёнок');
    expect(screen.getByLabelText('Как называет клиент')).toBeTruthy();
    expect(card('Уязвимый Ребёнок').getAttribute('aria-expanded')).toBe('true');
    openEditor('Уязвимый Ребёнок');
    expect(screen.queryByLabelText('Как называет клиент')).toBeNull();
    openEditor('Уязвимый Ребёнок');
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(screen.queryByLabelText('Как называет клиент')).toBeNull();
  });

  it('открытый редактор подвозится к глазам: на телефоне он встаёт ниже соседней клетки', () => {
    const scrollIntoView = vi.fn();
    const orig = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<Harness initial={base} />);
      expect(scrollIntoView).not.toHaveBeenCalled();
      openEditor('Уязвимый Ребёнок');
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(
        screen.getByRole('region', { name: 'Уязвимый Ребёнок: связи' }),
      );
    } finally {
      HTMLElement.prototype.scrollIntoView = orig;
    }
  });

  it('ввод имени зовёт onChangeLink с обновлённой связью; сохранение → отображение на фигуре', () => {
    const onChangeLink = vi.fn();
    render(<Harness initial={base} spies={{ onChangeLink }} />);
    openEditor('Уязвимый Ребёнок');
    const input = screen.getByLabelText<HTMLInputElement>(
      'Как называет клиент',
    );
    expect(input.maxLength).toBe(80);
    expect(input.placeholder).toBe('Например, «Судья» или «Маленькая Аня»');
    fireEvent.change(input, { target: { value: 'Маленькая Аня' } });
    expect(onChangeLink).toHaveBeenLastCalledWith({
      ...emptyModeLink('vulnerable_child'),
      alias: 'Маленькая Аня',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(
      within(card('Уязвимый Ребёнок')).getByText('Маленькая Аня'),
    ).toBeTruthy();
  });

  it('«Откуда режим» и «Как проявляется» не показываются на фигуре, но живут в связи: закрыл → открыл, текст на месте', () => {
    render(<Harness initial={base} />);
    openEditor('Уязвимый Ребёнок');
    fireEvent.change(screen.getByLabelText('Откуда режим'), {
      target: { value: 'мама уезжала' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    expect(screen.queryByText('мама уезжала')).toBeNull();
    openEditor('Уязвимый Ребёнок');
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Откуда режим').value,
    ).toBe('мама уезжала');
  });

  it('потребности: чип ставит needIds, тексты пишутся в origin/manifest', () => {
    const onChangeLink = vi.fn();
    render(<Harness initial={base} spies={{ onChangeLink }} />);
    openEditor('Уязвимый Ребёнок');
    const needs = within(
      screen.getByRole('group', {
        name: 'Какая потребность не встретила ответа',
      }),
    );
    fireEvent.click(needs.getByRole('button', { name: /Привязанность/ }));
    expect(onChangeLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ needIds: ['attachment'] }),
    );
    fireEvent.change(screen.getByLabelText('Откуда режим'), {
      target: { value: 'мама уезжала' },
    });
    expect(onChangeLink).toHaveBeenLastCalledWith(
      expect.objectContaining({
        origin: 'мама уезжала',
        needIds: ['attachment'],
      }),
    );
    fireEvent.change(screen.getByLabelText('Как проявляется сейчас'), {
      target: { value: 'замирает' },
    });
    expect(onChangeLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ manifest: 'замирает' }),
    );
  });

  it('«Взять за основу» кладёт подсказку метода в поле и пропадает', () => {
    const onChangeLink = vi.fn();
    render(<Harness initial={base} spies={{ onChangeLink }} />);
    openEditor('Уязвимый Ребёнок');
    expect(screen.getByText('Обычно в методе')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Взять за основу' }));
    expect(onChangeLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ strategy: STRATEGY_HINTS.vulnerable }),
    );
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Что делаем в терапии').value,
    ).toBe(STRATEGY_HINTS.vulnerable);
    expect(
      screen.queryByRole('button', { name: 'Взять за основу' }),
    ).toBeNull();
  });

  it('схема из концептуализации ставится без onAddSchema', () => {
    const onChangeLink = vi.fn();
    const onAddSchema = vi.fn();
    render(<Harness initial={base} spies={{ onChangeLink, onAddSchema }} />);
    openEditor('Уязвимый Ребёнок');
    const schemas = within(
      screen.getByRole('group', { name: 'Какие схемы питают режим' }),
    );
    fireEvent.click(schemas.getByRole('button', { name: /Неуспешность/ }));
    expect(onChangeLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ schemaIds: ['failure'] }),
    );
    expect(onAddSchema).not.toHaveBeenCalled();
    expect(schemas.queryByRole('button', { name: /Покинутость/ })).toBeNull();
  });

  it('схема вне концептуализации: «Все схемы» → выбор зовёт и onAddSchema, и onChangeLink', () => {
    const onChangeLink = vi.fn();
    const onAddSchema = vi.fn();
    render(<Harness initial={base} spies={{ onChangeLink, onAddSchema }} />);
    openEditor('Уязвимый Ребёнок');
    const schemas = within(
      screen.getByRole('group', { name: 'Какие схемы питают режим' }),
    );
    fireEvent.click(schemas.getByRole('button', { name: 'Все схемы' }));
    fireEvent.click(schemas.getByRole('button', { name: /Покинутость/ }));
    expect(onAddSchema).toHaveBeenCalledWith('abandonment');
    expect(onChangeLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ schemaIds: ['abandonment'] }),
    );
  });

  it('схем в концептуализации нет: сразу все 20 и подсказка; список не схлопывается после выбора', () => {
    const onAddSchema = vi.fn();
    render(
      <Harness
        initial={{ modeIds: ['vulnerable_child'] }}
        spies={{ onAddSchema }}
      />,
    );
    openEditor('Уязвимый Ребёнок');
    const schemas = within(
      screen.getByRole('group', { name: 'Какие схемы питают режим' }),
    );
    expect(
      schemas.getByText(
        /Схемы в концептуализации ещё не отмечены — выбранная здесь добавится и туда\./,
      ),
    ).toBeTruthy();
    // 20 схем + кнопка «Все схемы»
    expect(schemas.getAllByRole('button')).toHaveLength(21);
    fireEvent.click(schemas.getByRole('button', { name: /Покинутость/ }));
    expect(onAddSchema).toHaveBeenCalledWith('abandonment');
    expect(schemas.getAllByRole('button')).toHaveLength(21);
  });

  it('повторный тап по выбранной схеме снимает её', () => {
    const onChangeLink = vi.fn();
    render(
      <Harness
        initial={{
          ...base,
          modeLinks: [
            { ...emptyModeLink('vulnerable_child'), schemaIds: ['failure'] },
          ],
        }}
        spies={{ onChangeLink }}
      />,
    );
    openEditor('Уязвимый Ребёнок');
    const schemas = within(
      screen.getByRole('group', { name: 'Какие схемы питают режим' }),
    );
    fireEvent.click(schemas.getByRole('button', { name: /Неуспешность/ }));
    expect(onChangeLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ schemaIds: [] }),
    );
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
    openEditor('Уязвимый Ребёнок');
    fireEvent.click(
      screen.getByRole('button', { name: 'Убрать режим с карты' }),
    );
    expect(onToggleMode).toHaveBeenCalledWith('vulnerable_child');
    expect(screen.queryByLabelText('Как называет клиент')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Уязвимый Ребёнок: связи' }),
    ).toBeNull();
    // вернули режим — вернулись и связи
    fireEvent.click(screen.getByRole('button', { name: '+ режим' }));
    fireEvent.click(screen.getByRole('button', { name: /Уязвимый Ребёнок/ }));
    expect(within(card('Уязвимый Ребёнок')).getByText('Аня')).toBeTruthy();
    // и редактор после возврата сам не открывается
    expect(screen.queryByLabelText('Как называет клиент')).toBeNull();
  });
});

describe('ConceptGraph: «+ режим»', () => {
  const chip = (name: RegExp, pressed?: boolean) =>
    screen.getByRole('button', { name, pressed });

  it('кнопка над схемой раскрывает выбор по всем группам, повторный тап сворачивает', () => {
    render(<Harness initial={{}} />);
    const btn = screen.getByRole('button', { name: '+ режим' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(
      screen.queryByRole('button', { name: /Одинокий Ребёнок/ }),
    ).toBeNull();
    fireEvent.click(btn);
    expect(chip(/Одинокий Ребёнок/)).toBeTruthy();
    expect(chip(/Карающий Критик/)).toBeTruthy();
    expect(chip(/Хищник/)).toBeTruthy();
    expect(chip(/^Здоровый Взрослый$/)).toBeTruthy();
    const close = screen.getByRole('button', { name: 'Свернуть' });
    expect(close.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(close);
    expect(
      screen.queryByRole('button', { name: /Одинокий Ребёнок/ }),
    ).toBeNull();
  });

  it('выбранные режимы помечены, тап ставит режим на схему и снимает', () => {
    const onToggleMode = vi.fn();
    render(
      <Harness
        initial={{ modeIds: ['vulnerable_child'] }}
        spies={{ onToggleMode }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '+ режим' }));
    expect(chip(/^Уязвимый Ребёнок$/, true)).toBeTruthy();
    fireEvent.click(chip(/Одинокий Ребёнок/));
    expect(onToggleMode).toHaveBeenCalledWith('lonely_child');
    expect(card('Одинокий Ребёнок').dataset.shape).toBe('ellipse');
    fireEvent.click(chip(/^Одинокий Ребёнок$/, true));
    expect(
      screen.queryByRole('button', { name: 'Одинокий Ребёнок: связи' }),
    ).toBeNull();
  });

  it('заготовка детской клетки открывает выбор только детских режимов и заменяется режимом', () => {
    const onToggleMode = vi.fn();
    render(<Harness initial={{}} spies={{ onToggleMode }} />);
    fireEvent.click(placeholder(/Без детского режима непонятно/));
    expect(chip(/Одинокий Ребёнок/)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Карающий Критик/ }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /Хищник/ })).toBeNull();
    fireEvent.click(chip(/Одинокий Ребёнок/));
    expect(onToggleMode).toHaveBeenCalledWith('lonely_child');
    expect(card('Одинокий Ребёнок')).toBeTruthy();
    expect(screen.queryByTitle(/Без детского режима непонятно/)).toBeNull();
    // пустые клетки критика и копингов остались заготовками
    expect(placeholder(/критикующий голос не отмечен/)).toBeTruthy();
  });

  it('заготовка критика — группа критиков, копинга — все три группы копингов, здоровой клетки — здоровые', () => {
    render(<Harness initial={{}} />);
    fireEvent.click(placeholder(/критикующий голос не отмечен/));
    expect(chip(/Требовательный Критик/)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Одинокий Ребёнок/ }),
    ).toBeNull();

    fireEvent.click(placeholder(/Копинг обычно виден первым/));
    expect(chip(/Послушный Капитулянт/)).toBeTruthy();
    expect(chip(/Отстранённый Защитник/)).toBeTruthy();
    expect(chip(/Хищник/)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Требовательный Критик/ }),
    ).toBeNull();

    fireEvent.click(placeholder(/Здорового Взрослого стоит назвать/));
    expect(chip(/^Здоровый Взрослый$/)).toBeTruthy();
    expect(chip(/Счастливый Ребёнок/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Хищник/ })).toBeNull();
  });

  it('кнопка «+ режим» после заготовки показывает все группы заново', () => {
    render(<Harness initial={{}} />);
    fireEvent.click(placeholder(/Без детского режима непонятно/));
    fireEvent.click(screen.getByRole('button', { name: 'Свернуть' }));
    fireEvent.click(screen.getByRole('button', { name: '+ режим' }));
    expect(chip(/Карающий Критик/)).toBeTruthy();
  });

  it('управление не попадает в картинку: тулбар и выбор режимов помечены data-export-skip, фигуры — нет', () => {
    render(<Harness initial={{ modeIds: ['vulnerable_child'] }} />);
    fireEvent.click(screen.getByRole('button', { name: '+ режим' }));
    const skipped = (el: Element) => el.closest('[data-export-skip]') !== null;
    expect(skipped(screen.getByRole('button', { name: 'Свернуть' }))).toBe(
      true,
    );
    expect(skipped(chip(/Одинокий Ребёнок/))).toBe(true);
    expect(skipped(card('Уязвимый Ребёнок'))).toBe(false);
    expect(skipped(placeholder(/критикующий голос не отмечен/))).toBe(false);
  });
});

describe('ConceptGraph: аналитика', () => {
  it('открытие — один раз; «связан» — один раз на режим за монтирование', () => {
    const track = vi.fn();
    render(
      <Harness
        initial={{
          modeIds: ['vulnerable_child', 'punitive_critic'],
          schemaIds: ['failure'],
        }}
        spies={{ track }}
      />,
    );
    expect(track.mock.calls.map((c) => c[0])).toEqual(['concept_graph_open']);

    openEditor('Уязвимый Ребёнок');
    const alias = () => screen.getByLabelText('Как называет клиент');
    fireEvent.change(alias(), { target: { value: 'А' } });
    fireEvent.change(alias(), { target: { value: 'Ан' } });
    expect(track.mock.calls.map((c) => c[0])).toEqual([
      'concept_graph_open',
      'concept_mode_linked',
    ]);

    openEditor('Карающий Критик');
    fireEvent.change(alias(), { target: { value: 'Судья' } });
    fireEvent.change(alias(), { target: { value: 'Судья ' } });
    expect(track.mock.calls.map((c) => c[0])).toEqual([
      'concept_graph_open',
      'concept_mode_linked',
      'concept_mode_linked',
    ]);

    // просто открыть/закрыть карточку — не «связал»
    track.mockClear();
    openEditor('Уязвимый Ребёнок');
    expect(track).not.toHaveBeenCalled();
  });
});
