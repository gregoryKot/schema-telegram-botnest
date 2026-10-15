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
const cell = (title: string) => screen.getByRole('region', { name: title });
const openEditor = (name: string) => fireEvent.click(card(name));

describe('ConceptGraph: общий вид', () => {
  it('пустая концептуализация: вводный текст, четыре клетки с объяснением дефицита, пустые блоки', () => {
    render(<Harness initial={{}} />);
    expect(
      screen.getByText(
        /Схема случая по модели режимов \(шаблон Редигера, ISST\)/,
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Нажми на режим, чтобы связать его/)).toBeTruthy();
    expect(
      within(cell('Здоровые режимы')).getByText(
        /Здорового Взрослого стоит назвать/,
      ),
    ).toBeTruthy();
    expect(
      within(cell('Детские режимы')).getByText(/Без детского режима непонятно/),
    ).toBeTruthy();
    expect(
      within(cell('Критикующие режимы')).getByText(
        'Пусто: критикующий голос не отмечен.',
      ),
    ).toBeTruthy();
    expect(
      within(cell('Копинги')).getByText(/Копинг обычно виден первым/),
    ).toBeTruthy();
    expect(screen.getByText('Триггеры пока не описаны')).toBeTruthy();
    expect(screen.getByText('Проблемы пока не описаны')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByText('Как режимы сменяют друг друга')).toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
  });

  it('форма «вы» меняет вводный текст и подсказку про связи', () => {
    render(<Harness initial={{ modeIds: ['vulnerable_child'] }} form="vy" />);
    expect(screen.getByText(/Нажмите на режим, чтобы связать/)).toBeTruthy();
    expect(
      screen.getByText(/нажмите на карточку, чтобы добавить схемы/),
    ).toBeTruthy();
    expect(screen.queryByText(/Нажми на режим/)).toBeNull();
  });

  it('тексты концептуализации попадают в свои блоки, цели — под здоровыми режимами', () => {
    render(
      <Harness
        initial={{
          modeIds: ['healthy_adult'],
          triggers: 'критика на работе',
          goals: 'научиться отдыхать',
          currentProblems: 'выгорание',
          modeTransitions: 'Критик → Уязвимый',
          earlyExperience: 'строгий отец',
          unmetNeeds: 'нужна опора',
        }}
      />,
    );
    expect(screen.getByText('критика на работе')).toBeTruthy();
    expect(
      within(cell('Здоровые режимы')).getByText('Цели терапии'),
    ).toBeTruthy();
    expect(
      within(cell('Здоровые режимы')).getByText('научиться отдыхать'),
    ).toBeTruthy();
    expect(screen.getByText('выгорание')).toBeTruthy();
    expect(screen.getByText('Критик → Уязвимый')).toBeTruthy();
    expect(screen.getByText('строгий отец')).toBeTruthy();
    expect(screen.getByText('нужна опора')).toBeTruthy();
  });

  it('подсказки о пробелах показываются плашками', () => {
    render(<Harness initial={{ modeIds: ['detached_protector'] }} />);
    const notes = screen.getAllByRole('note').map((n) => n.textContent);
    expect(notes[0]).toMatch(/Копинги есть, а детского режима нет/);
  });
});

describe('ConceptGraph: карточка режима', () => {
  it('имя клиента — главная строка, название режима — мелко, копинг помечен видом', () => {
    render(
      <Harness
        initial={{
          modeIds: ['punitive_critic', 'detached_protector'],
          modeLinks: [{ ...emptyModeLink('punitive_critic'), alias: 'Судья' }],
        }}
      />,
    );
    const critic = card('Карающий Критик');
    expect(within(critic).getByText('Судья')).toBeTruthy();
    expect(within(critic).getByText('Карающий Критик')).toBeTruthy();
    expect(
      within(card('Отстранённый Защитник')).getByText('Избегание'),
    ).toBeTruthy();
    expect(
      within(card('Отстранённый Защитник')).getByText('связи не заполнены'),
    ).toBeTruthy();
  });

  it('до трёх схем, остальные — «+N»; потребности и первая строка истоков', () => {
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
    const c = card('Уязвимый Ребёнок');
    expect(within(c).getByText('+2')).toBeTruthy();
    expect(within(c).getByText('Привязанность')).toBeTruthy();
    expect(within(c).getByText('Откуда: первая строка')).toBeTruthy();
    expect(within(c).queryByText('связи не заполнены')).toBeNull();
  });
});

describe('ConceptGraph: редактор связей', () => {
  const base = { modeIds: ['vulnerable_child'], schemaIds: ['failure'] };

  it('тап по карточке открывает редактор, повторный тап и «Готово» закрывают', () => {
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

  it('ввод имени зовёт onChangeLink с обновлённой связью; сохранение → отображение на карточке', () => {
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
    fireEvent.click(
      within(cell('Детские режимы')).getByRole('button', { name: '+ режим' }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Уязвимый Ребёнок/ }));
    expect(within(card('Уязвимый Ребёнок')).getByText('Аня')).toBeTruthy();
    // и редактор после возврата сам не открывается
    expect(screen.queryByLabelText('Как называет клиент')).toBeNull();
  });
});

describe('ConceptGraph: «+ режим» в клетке', () => {
  it('показывает только группы этой клетки и зовёт onToggleMode', () => {
    const onToggleMode = vi.fn();
    render(
      <Harness
        initial={{ modeIds: ['vulnerable_child'] }}
        spies={{ onToggleMode }}
      />,
    );
    const child = within(cell('Детские режимы'));
    expect(
      child.queryByRole('button', { name: /Одинокий Ребёнок/ }),
    ).toBeNull();
    fireEvent.click(child.getByRole('button', { name: '+ режим' }));
    // уже выбранные видны и помечены
    expect(
      child.getByRole('button', { name: /^Уязвимый Ребёнок$/, pressed: true }),
    ).toBeTruthy();
    expect(child.queryByRole('button', { name: /Карающий Критик/ })).toBeNull();
    fireEvent.click(child.getByRole('button', { name: /Одинокий Ребёнок/ }));
    expect(onToggleMode).toHaveBeenCalledWith('lonely_child');
    expect(
      within(cell('Детские режимы')).getByRole('button', {
        name: 'Одинокий Ребёнок: связи',
      }),
    ).toBeTruthy();
  });

  it('клетка копингов предлагает все три группы копингов', () => {
    render(<Harness initial={{}} />);
    const coping = within(cell('Копинги'));
    fireEvent.click(coping.getByRole('button', { name: '+ режим' }));
    expect(
      coping.getByRole('button', { name: /Послушный Капитулянт/ }),
    ).toBeTruthy();
    expect(
      coping.getByRole('button', { name: /Отстранённый Защитник/ }),
    ).toBeTruthy();
    expect(coping.getByRole('button', { name: /Хищник/ })).toBeTruthy();
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
