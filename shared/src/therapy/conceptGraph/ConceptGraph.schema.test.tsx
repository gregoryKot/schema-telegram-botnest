// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CONCEPT_SCHEMA_TEXT_MAX } from '../../limits/textLimits';
import {
  Harness,
  badges,
  edges,
  modeFigure,
  schemaFigure,
  sectionOf,
} from './ConceptGraph.test-helpers';
import { emptyModeLink } from './modeLinks';
import { emptySchemaLink } from './schemaLinks';

const ED = 'Эмоциональная депривация';
const BASE = { schemaIds: ['emotional_deprivation'] };
const openSchema = (name = ED) => fireEvent.click(schemaFigure(name));
const editor = (name = ED) =>
  screen.getByRole('region', { name: `Схема ${name}: редактор` });
const addButton = (section: string) =>
  within(sectionOf(section)).getByRole('button', { name: /^\+|Свернуть/ });

describe('ConceptGraph: редактор схемы', () => {
  it('тап по схеме открывает редактор (название и домен), повторный тап и «Готово» закрывают', () => {
    render(<Harness initial={BASE} />);
    expect(screen.queryByRole('region', { name: /редактор/ })).toBeNull();
    openSchema();
    const e = within(editor());
    expect(e.getByText(`Схема ${ED}`)).toBeTruthy();
    expect(e.getByText('Нарушение связи и отвержение')).toBeTruthy();
    expect(schemaFigure(ED).getAttribute('aria-expanded')).toBe('true');
    openSchema();
    expect(screen.queryByRole('region', { name: /редактор/ })).toBeNull();
    openSchema();
    fireEvent.click(within(editor()).getByRole('button', { name: 'Готово' }));
    expect(screen.queryByRole('region', { name: /редактор/ })).toBeNull();
  });

  it('поля по образцу владельца: во что верит, как нарушалась потребность, какие потребности блокирует', () => {
    render(<Harness initial={BASE} />);
    openSchema();
    const belief = screen.getByLabelText<HTMLTextAreaElement>(
      'Во что человек верит',
    );
    expect(belief.placeholder).toBe(
      'Своими словами клиента: «Я верю, что мои переживания не имеют смысла…»',
    );
    expect(belief.maxLength).toBe(CONCEPT_SCHEMA_TEXT_MAX);
    const origin = screen.getByLabelText<HTMLTextAreaElement>(
      'Как нарушалась потребность',
    );
    expect(origin.placeholder).toBe(
      'Детский опыт: что происходило, кто был рядом',
    );
    expect(origin.maxLength).toBe(CONCEPT_SCHEMA_TEXT_MAX);
    const needs = within(
      screen.getByRole('group', { name: 'Какие потребности блокирует' }),
    );
    expect(needs.getAllByRole('button')).toHaveLength(5);
    expect(
      screen.getAllByText('Этот текст виден на схеме').length,
    ).toBeGreaterThan(0);
  });

  it('открытый редактор подвозится к глазам', () => {
    const scrollIntoView = vi.fn();
    const orig = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      render(<Harness initial={BASE} />);
      openSchema();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(editor());
    } finally {
      HTMLElement.prototype.scrollIntoView = orig;
    }
  });

  it('убеждение: onChangeSchemaLink получает связь, текст сразу виден на фигуре и остаётся после закрытия (сохранил → нашёл)', () => {
    const onChangeSchemaLink = vi.fn();
    render(<Harness initial={BASE} spies={{ onChangeSchemaLink }} />);
    openSchema();
    fireEvent.change(screen.getByLabelText('Во что человек верит'), {
      target: { value: 'Я верю, что мои переживания не имеют смысла' },
    });
    expect(onChangeSchemaLink).toHaveBeenLastCalledWith({
      ...emptySchemaLink('emotional_deprivation'),
      belief: 'Я верю, что мои переживания не имеют смысла',
    });
    expect(
      within(schemaFigure(ED)).getByText(
        'Я верю, что мои переживания не имеют смысла',
      ),
    ).toBeTruthy();
    expect(
      within(schemaFigure(ED)).queryByText('связи не заполнены'),
    ).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
    openSchema();
    expect(
      screen.getByLabelText<HTMLTextAreaElement>('Во что человек верит').value,
    ).toBe('Я верю, что мои переживания не имеют смысла');
  });

  it('опыт: появляется овал над схемой с текстом и стрелка овал → схема; очистка убирает оба', () => {
    render(<Harness initial={BASE} />);
    expect(
      screen.queryByText('Как нарушалась потребность', { selector: 'span' }),
    ).toBeNull();
    openSchema();
    const field = screen.getByLabelText('Как нарушалась потребность');
    fireEvent.change(field, { target: { value: 'Некому было пожаловаться' } });
    const oval = screen.getByRole('button', {
      name: `Как нарушалась потребность: схема ${ED}`,
    });
    expect(oval.dataset.shape).toBe('ellipse');
    expect(within(oval).getByText('Некому было пожаловаться')).toBeTruthy();
    expect(edges().filter((e) => e.dataset.kind === 'origin')).toHaveLength(1);
    fireEvent.change(field, { target: { value: '' } });
    expect(
      screen.queryByRole('button', {
        name: `Как нарушалась потребность: схема ${ED}`,
      }),
    ).toBeNull();
    expect(edges().filter((e) => e.dataset.kind === 'origin')).toHaveLength(0);
  });

  it('тап по овалу опыта открывает редактор его схемы', () => {
    render(
      <Harness
        initial={{
          ...BASE,
          schemaLinks: [
            { ...emptySchemaLink('emotional_deprivation'), origin: 'опыт' },
          ],
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: `Как нарушалась потребность: схема ${ED}`,
      }),
    );
    expect(editor()).toBeTruthy();
  });

  it('потребности: чип ставит needIds и сразу рисует ✗ на схеме; снятие убирает', () => {
    const onChangeSchemaLink = vi.fn();
    render(<Harness initial={BASE} spies={{ onChangeSchemaLink }} />);
    expect(badges('block')).toHaveLength(0);
    openSchema();
    const needs = within(
      screen.getByRole('group', { name: 'Какие потребности блокирует' }),
    );
    fireEvent.click(needs.getByRole('button', { name: /Привязанность/ }));
    expect(onChangeSchemaLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ needIds: ['attachment'] }),
    );
    fireEvent.click(needs.getByRole('button', { name: /Выражение чувств/ }));
    expect(badges('block')).toHaveLength(2);
    expect(edges().filter((e) => e.dataset.kind === 'blocks')).toHaveLength(2);
    fireEvent.click(needs.getByRole('button', { name: /Привязанность/ }));
    expect(badges('block')).toHaveLength(1);
  });

  it('«Убрать схему» снимает её с карты, закрывает редактор и убирает её линии; тексты остаются и возвращаются вместе со схемой', () => {
    const onToggleSchema = vi.fn();
    render(
      <Harness
        initial={{
          modeIds: ['guilt_critic'],
          schemaIds: ['emotional_deprivation'],
          modeLinks: [
            {
              ...emptyModeLink('guilt_critic'),
              schemaIds: ['emotional_deprivation'],
            },
          ],
          schemaLinks: [
            {
              schemaId: 'emotional_deprivation',
              belief: 'мои чувства не важны',
              origin: '',
              needIds: ['attachment'],
            },
          ],
        }}
        spies={{ onToggleSchema }}
      />,
    );
    expect(edges().length).toBeGreaterThan(0);
    openSchema();
    fireEvent.click(
      screen.getByRole('button', { name: 'Убрать схему из концептуализации' }),
    );
    expect(onToggleSchema).toHaveBeenCalledWith('emotional_deprivation');
    expect(screen.queryByRole('region', { name: /редактор/ })).toBeNull();
    // схема ушла вместе со ссылкой режима: на экране её нет, линий нет
    expect(
      screen.queryByRole('button', { name: `Схема ${ED}: убеждение и опыт` }),
    ).toBeNull();
    expect(edges()).toHaveLength(0);
    // вернули через «+ схема» — тексты на месте, ссылка режима не вернулась
    fireEvent.click(addButton('Схемы'));
    fireEvent.click(screen.getByRole('button', { name: ED }));
    expect(
      within(schemaFigure(ED)).getByText('мои чувства не важны'),
    ).toBeTruthy();
    expect(badges('block')).toHaveLength(1);
    expect(edges().filter((e) => e.dataset.kind === 'link')).toHaveLength(0);
  });

  it('одновременно открыт один редактор: схема закрывает редактор режима и наоборот', () => {
    render(<Harness initial={{ ...BASE, modeIds: ['punitive_critic'] }} />);
    fireEvent.click(modeFigure('Карающий Критик'));
    expect(
      screen.getByRole('region', { name: 'Карающий Критик: связи' }),
    ).toBeTruthy();
    openSchema();
    expect(
      screen.queryByRole('region', { name: 'Карающий Критик: связи' }),
    ).toBeNull();
    expect(editor()).toBeTruthy();
    fireEvent.click(modeFigure('Карающий Критик'));
    expect(
      screen.queryByRole('region', { name: /Схема .*: редактор/ }),
    ).toBeNull();
  });
});

describe('ConceptGraph: «+ режим» и «+ схема»', () => {
  const chip = (name: RegExp | string, pressed?: boolean) =>
    screen.getByRole('button', { name, pressed });

  it('у каждой секции своя кнопка: режимы и здоровые режимы — «+ режим», схемы — «+ схема»', () => {
    render(<Harness initial={{}} />);
    expect(addButton('Режимы').textContent).toBe('+ режим');
    expect(addButton('Схемы').textContent).toBe('+ схема');
    expect(addButton('Здоровые режимы').textContent).toBe('+ режим');
  });

  it('«+ режим» в колонке режимов: критики, детские, копинги — без здоровых; повторный тап сворачивает', () => {
    render(<Harness initial={{}} />);
    const btn = addButton('Режимы');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(chip(/Одинокий Ребёнок/)).toBeTruthy();
    expect(chip(/Карающий Критик/)).toBeTruthy();
    expect(chip(/Хищник/)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Счастливый Ребёнок/ }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /^Здоровый Взрослый$/ }),
    ).toBeNull();
    const close = addButton('Режимы');
    expect(close.textContent).toBe('Свернуть');
    expect(close.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(close);
    expect(
      screen.queryByRole('button', { name: /Одинокий Ребёнок/ }),
    ).toBeNull();
  });

  it('«+ режим» у здоровых режимов предлагает только здоровые', () => {
    render(<Harness initial={{}} />);
    fireEvent.click(addButton('Здоровые режимы'));
    expect(chip(/^Здоровый Взрослый$/)).toBeTruthy();
    expect(chip(/Счастливый Ребёнок/)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: /Одинокий Ребёнок/ }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /Хищник/ })).toBeNull();
  });

  it('выбранные режимы помечены; тап ставит режим на схему и снимает', () => {
    const onToggleMode = vi.fn();
    render(
      <Harness
        initial={{ modeIds: ['vulnerable_child'] }}
        spies={{ onToggleMode }}
      />,
    );
    fireEvent.click(addButton('Режимы'));
    expect(chip(/^Уязвимый Ребёнок$/, true)).toBeTruthy();
    fireEvent.click(chip(/Одинокий Ребёнок/));
    expect(onToggleMode).toHaveBeenCalledWith('lonely_child');
    expect(modeFigure('Одинокий Ребёнок').dataset.shape).toBe('ellipse');
    fireEvent.click(chip(/^Одинокий Ребёнок$/, true));
    expect(
      screen.queryByRole('button', { name: 'Одинокий Ребёнок: связи' }),
    ).toBeNull();
  });

  it('здоровый режим из «+ режим» встаёт в правую колонку, а не к остальным', () => {
    render(<Harness initial={{}} />);
    fireEvent.click(addButton('Здоровые режимы'));
    fireEvent.click(chip(/^Здоровый Взрослый$/));
    expect(modeFigure('Здоровый Взрослый').dataset.node).toBe(
      'mode:healthy_adult',
    );
    expect(
      screen.queryByRole('button', { name: 'Здоровый Взрослый не отмечен' }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Режим не отмечен' }),
    ).toBeTruthy();
  });

  it('«+ схема»: 20 схем по доменам с подписями; тап ставит схему на схему случая, повторный — снимает', () => {
    const onToggleSchema = vi.fn();
    render(<Harness initial={{}} spies={{ onToggleSchema }} />);
    fireEvent.click(addButton('Схемы'));
    const panel = within(
      screen.getByRole('dialog', { name: 'Схемы на схеме' }),
    );
    expect(panel.getAllByRole('button')).toHaveLength(21); // 20 схем + «Готово»
    expect(panel.getByText('Нарушение связи и отвержение')).toBeTruthy();
    expect(panel.getByText('Направленность на других')).toBeTruthy();
    fireEvent.click(chip(/^Неуспешность$/));
    expect(onToggleSchema).toHaveBeenCalledWith('failure');
    expect(schemaFigure('Неуспешность')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Схема не отмечена' }),
    ).toBeNull();
    fireEvent.click(chip(/^Неуспешность$/, true));
    expect(
      screen.queryByRole('button', { name: /Схема Неуспешность/ }),
    ).toBeNull();
  });

  it('заготовки пустых секций открывают тот же выбор, что и «+» в заголовке', () => {
    render(<Harness initial={{}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Схема не отмечена' }));
    expect(screen.getByRole('dialog', { name: 'Схемы на схеме' })).toBeTruthy();
    expect(addButton('Схемы').textContent).toBe('Свернуть');
    fireEvent.click(
      screen.getByRole('button', { name: 'Здоровый Взрослый не отмечен' }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Здоровые режимы на схеме' }),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Схемы на схеме' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Режим не отмечен' }));
    expect(
      screen.getByRole('dialog', { name: 'Режимы на схеме' }),
    ).toBeTruthy();
  });

  it('«Готово» в выборе закрывает его; управление не попадает в картинку, фигуры — попадают', () => {
    render(
      <Harness
        initial={{ modeIds: ['vulnerable_child'], schemaIds: ['failure'] }}
      />,
    );
    const skipped = (el: Element) => el.closest('[data-export-skip]') !== null;
    expect(skipped(addButton('Режимы'))).toBe(true);
    expect(skipped(addButton('Схемы'))).toBe(true);
    expect(skipped(modeFigure('Уязвимый Ребёнок'))).toBe(false);
    expect(skipped(schemaFigure('Неуспешность'))).toBe(false);
    expect(skipped(screen.getByText('Режимы'))).toBe(false);
    fireEvent.click(addButton('Режимы'));
    const panel = screen.getByRole('dialog', { name: 'Режимы на схеме' });
    expect(skipped(panel)).toBe(true);
    fireEvent.click(within(panel).getByRole('button', { name: 'Готово' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('текст выбора зависит от формы обращения', () => {
    const { unmount } = render(<Harness initial={{}} />);
    fireEvent.click(addButton('Схемы'));
    expect(
      screen.getByText('Нажми, чтобы поставить на схему или убрать.'),
    ).toBeTruthy();
    unmount();
    render(<Harness initial={{}} form="vy" />);
    fireEvent.click(addButton('Схемы'));
    expect(
      screen.getByText('Нажмите, чтобы поставить на схему или убрать.'),
    ).toBeTruthy();
  });
});

describe('ConceptGraph: аналитика', () => {
  it('открытие — один раз; «связан» — один раз на режим; «схема связана» — один раз на схему, без меты', () => {
    const track = vi.fn();
    render(
      <Harness
        initial={{
          modeIds: ['vulnerable_child'],
          schemaIds: ['failure', 'mistrust'],
        }}
        spies={{ track }}
      />,
    );
    const names = () => track.mock.calls.map((c) => c[0]);
    expect(names()).toEqual(['concept_graph_open']);

    fireEvent.click(modeFigure('Уязвимый Ребёнок'));
    const alias = () => screen.getByLabelText('Как называет клиент');
    fireEvent.change(alias(), { target: { value: 'А' } });
    fireEvent.change(alias(), { target: { value: 'Ан' } });
    expect(names()).toEqual(['concept_graph_open', 'concept_mode_linked']);

    fireEvent.click(schemaFigure('Неуспешность'));
    const belief = () => screen.getByLabelText('Во что человек верит');
    fireEvent.change(belief(), { target: { value: 'я' } });
    fireEvent.change(belief(), { target: { value: 'я не' } });
    expect(names()).toEqual([
      'concept_graph_open',
      'concept_mode_linked',
      'concept_schema_linked',
    ]);

    fireEvent.click(schemaFigure('Недоверие / Ожидание жестокого обращения'));
    fireEvent.change(belief(), { target: { value: 'мне нельзя верить' } });
    expect(names().filter((n) => n === 'concept_schema_linked')).toHaveLength(
      2,
    );

    // вернулись к первой схеме и правим снова — события нет
    track.mockClear();
    fireEvent.click(schemaFigure('Неуспешность'));
    fireEvent.change(belief(), { target: { value: 'я не справлюсь' } });
    expect(track).not.toHaveBeenCalled();
    for (const call of track.mock.calls) expect(call).toHaveLength(1);
  });

  it('просто открыть и закрыть схему или режим — не «связал»', () => {
    const track = vi.fn();
    render(
      <Harness
        initial={{ modeIds: ['vulnerable_child'], schemaIds: ['failure'] }}
        spies={{ track }}
      />,
    );
    track.mockClear();
    fireEvent.click(schemaFigure('Неуспешность'));
    fireEvent.click(modeFigure('Уязвимый Ребёнок'));
    expect(track).not.toHaveBeenCalled();
  });
});
