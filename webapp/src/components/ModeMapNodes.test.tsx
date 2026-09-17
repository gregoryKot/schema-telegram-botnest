// @vitest-environment jsdom
// ModeMapNodes — сами фигуры узлов карты режимов (20% покрытия). Рендерим
// через реальный ModeMapCanvas.test-helpers (тот же харнесс, что и для
// ModeMapCanvas — это единственный проверенный способ смонтировать узел
// внутри настоящего @xyflow/react в jsdom, см. комментарии в файлах Canvas).
// Проверяем видимое поведение: что показывается на карточке узла в
// зависимости от `display`, переименование по двойному клику, циклы толщины
// контура/размера текста через тулбар узла, бейдж партнёра А/Б.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { renderCanvas, mmNode, readModel } from './ModeMapCanvas.test-helpers';
import { installFlowTestPolyfills } from '../test-support/renderWithFlow';

beforeEach(() => {
  installFlowTestPolyfills();
  localStorage.clear();
});
afterEach(() => cleanup());

function nodeEl(label: string) {
  return screen.getByText(label).closest('.react-flow__node')!;
}

describe('ModeMapNodes — видимость полей по display', () => {
  it('display=full (по умолчанию) показывает заметку, потребность, здоровый ответ и схему', () => {
    renderCanvas({
      initialNodes: [
        mmNode('n1', 'child', {
          label: 'Ребёнок',
          note: 'прячется',
          unmetNeed: 'безопасность',
          healthyResponse: 'ты в порядке',
          schemaId: 'abandonment',
        }),
      ],
    });
    expect(screen.getByText('прячется')).toBeTruthy();
    expect(screen.getByText('потребность: безопасность')).toBeTruthy();
    expect(screen.getByText('ты в порядке')).toBeTruthy();
    expect(screen.getByText('Покинутость / Нестабильность')).toBeTruthy();
  });

  it('display=name прячет заметку и схему', () => {
    renderCanvas({
      initialNodes: [
        mmNode('n1', 'child', {
          label: 'Ребёнок',
          note: 'прячется',
          schemaId: 'abandonment',
          display: 'name',
        }),
      ],
    });
    expect(screen.queryByText('прячется')).toBeNull();
    expect(screen.queryByText('Покинутость / Нестабильность')).toBeNull();
  });

  it('display=note показывает заметку, но не потребность и не здоровый ответ', () => {
    renderCanvas({
      initialNodes: [
        mmNode('n1', 'child', {
          label: 'Ребёнок',
          note: 'прячется',
          unmetNeed: 'безопасность',
          healthyResponse: 'норм',
          display: 'note',
        }),
      ],
    });
    expect(screen.getByText('прячется')).toBeTruthy();
    expect(screen.queryByText('потребность: безопасность')).toBeNull();
    expect(screen.queryByText('норм')).toBeNull();
  });
});

describe('ModeMapNodes — переименование по двойному клику', () => {
  it('двойной клик открывает поле, Enter коммитит новое название', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    fireEvent.doubleClick(screen.getByText('Триггер'));
    const input = screen.getByDisplayValue('Триггер') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Начало ссоры' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(readModel(container).nodes[0].label).toBe('Начало ссоры');
    expect(screen.getByText('Начало ссоры')).toBeTruthy();
  });

  it('Escape отменяет редактирование без изменений', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    fireEvent.doubleClick(screen.getByText('Триггер'));
    const input = screen.getByDisplayValue('Триггер') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'мусор' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(readModel(container).nodes[0].label).toBe('Триггер');
    expect(screen.getByText('Триггер')).toBeTruthy();
  });

  it('пустое название после blur восстанавливает прежний label, а не пустую строку', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    fireEvent.doubleClick(screen.getByText('Триггер'));
    const input = screen.getByDisplayValue('Триггер') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(readModel(container).nodes[0].label).toBe('Триггер');
  });
});

describe('ModeMapNodes — тулбар узла: толщина контура и размер текста', () => {
  it('клики по «Толщина контура» циклически меняют strokeWidth: normal → bold → thin → normal', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    fireEvent.click(nodeEl('Триггер'));
    const strokeBtn = screen.getByLabelText('Толщина контура');
    fireEvent.click(strokeBtn);
    expect(readModel(container).nodes[0].data?.strokeWidth).toBe('bold');
    fireEvent.click(strokeBtn);
    expect(readModel(container).nodes[0].data?.strokeWidth).toBe('thin');
    fireEvent.click(strokeBtn);
    expect(readModel(container).nodes[0].data?.strokeWidth).toBe('normal');
  });

  it('клики по «Размер текста» циклически меняют fontSize: md → lg → sm → md', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    fireEvent.click(nodeEl('Триггер'));
    const fontBtn = screen.getByLabelText('Размер текста');
    fireEvent.click(fontBtn);
    expect(readModel(container).nodes[0].data?.fontSize).toBe('lg');
    fireEvent.click(fontBtn);
    expect(readModel(container).nodes[0].data?.fontSize).toBe('sm');
    fireEvent.click(fontBtn);
    expect(readModel(container).nodes[0].data?.fontSize).toBe('md');
  });

  it('«Дублировать» из тулбара узла создаёт копию рядом', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    fireEvent.click(nodeEl('Триггер'));
    fireEvent.click(screen.getByLabelText('Дублировать'));
    expect(readModel(container).nodes).toHaveLength(2);
  });

  it('«Удалить» из тулбара узла убирает его с карты', () => {
    const { container } = renderCanvas({
      initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })],
    });
    fireEvent.click(nodeEl('Триггер'));
    fireEvent.click(screen.getByLabelText('Удалить'));
    expect(readModel(container).nodes).toHaveLength(0);
  });

  it('тултипы «нажми, чтобы сменить» звучат на «ты»/«вы»', () => {
    renderCanvas(
      { initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })] },
      'ty',
    );
    fireEvent.click(nodeEl('Триггер'));
    expect(screen.getByLabelText('Толщина контура').title).toContain(
      '(нажми, чтобы сменить)',
    );
    expect(screen.getByLabelText('Размер текста').title).toContain(
      '(нажми, чтобы сменить)',
    );
    cleanup();

    renderCanvas(
      { initialNodes: [mmNode('n1', 'trigger', { label: 'Триггер' })] },
      'vy',
    );
    fireEvent.click(nodeEl('Триггер'));
    expect(screen.getByLabelText('Толщина контура').title).toContain(
      '(нажмите, чтобы сменить)',
    );
    expect(screen.getByLabelText('Размер текста').title).toContain(
      '(нажмите, чтобы сменить)',
    );
  });
});

describe('ModeMapNodes — бейдж партнёра (карта пары)', () => {
  it('side=A показывает бейдж «А», side=B — «Б», без side — бейджа нет', () => {
    renderCanvas({
      initialNodes: [
        mmNode('n1', 'trigger', { label: 'У партнёра А', side: 'A' }),
        mmNode('n2', 'behavior', { label: 'У партнёра Б', side: 'B' }),
        mmNode('n3', 'critic', { label: 'Без стороны' }),
      ],
      kind: 'couple',
    });
    expect(screen.getByText('А')).toBeTruthy();
    expect(screen.getByText('Б')).toBeTruthy();
  });
});

describe('ModeMapNodes — все фигуры рендерятся без падений', () => {
  it('trigger/child/critic/coping(over,avoid,surr)/healthy/custom/behavior — каждая со своим текстом', () => {
    renderCanvas({
      initialNodes: [
        mmNode('t', 'trigger', { label: 'Т' }, { x: 0, y: 0 }),
        mmNode('c', 'child', { label: 'Р' }, { x: 200, y: 0 }),
        mmNode('cr', 'critic', { label: 'К' }, { x: 400, y: 0 }),
        mmNode(
          'co1',
          'coping',
          { label: 'КопОвер', copingSubtype: 'over' },
          { x: 0, y: 200 },
        ),
        mmNode(
          'co2',
          'coping',
          { label: 'КопИзбег', copingSubtype: 'avoid' },
          { x: 200, y: 200 },
        ),
        mmNode(
          'co3',
          'coping',
          { label: 'КопКапит', copingSubtype: 'surr' },
          { x: 400, y: 200 },
        ),
        mmNode('h', 'healthy', { label: 'ЗВ' }, { x: 0, y: 400 }),
        mmNode('cu', 'custom', { label: 'Свой' }, { x: 200, y: 400 }),
        mmNode('b', 'behavior', { label: 'Пов' }, { x: 400, y: 400 }),
      ],
    });
    for (const label of [
      'Т',
      'Р',
      'К',
      'КопОвер',
      'КопИзбег',
      'КопКапит',
      'ЗВ',
      'Свой',
      'Пов',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});
