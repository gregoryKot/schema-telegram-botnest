// @vitest-environment jsdom
// ModeMapNodeEditor — панель редактирования ноды карты режимов. Компонент не
// использует @xyflow/react (чистая форма над `node.data`), поэтому провайдер
// не нужен — 0% покрытия было чистой недосмотренностью, не сложностью xyflow.
// Проверяем: каждое поле формы реально пробрасывает изменение через onChange
// (а не тихо теряется), условная видимость полей по типу ноды (unmetNeed —
// только у child/custom, healthyResponse — только у child/critic/coping),
// ты/вы-вилку в подсказке критику, и оба window-события фокуса полей
// (двойной клик по ноде на холсте → modemap-focus-name, шаг гайда «Потребность»
// → modemap-focus-need).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../utils/addressForm';
import { ModeMapNodeEditor } from './ModeMapNodeEditor';
import type { ModeMapNode } from '../api';

function baseNode(overrides: Partial<ModeMapNode> = {}): ModeMapNode {
  return {
    id: 'n1', type: 'child', position: { x: 0, y: 0 },
    data: { label: 'Уязвимый ребёнок' },
    ...overrides,
  };
}

function renderEditor(node: ModeMapNode, extra: Partial<Parameters<typeof ModeMapNodeEditor>[0]> = {}, form: 'ty' | 'vy' = 'ty') {
  const onChange = vi.fn();
  const onDelete = vi.fn();
  const onClose = vi.fn();
  render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <ModeMapNodeEditor node={node} onChange={onChange} onDelete={onDelete} onClose={onClose} {...extra} />
    </AddressFormContext.Provider>,
  );
  return { onChange, onDelete, onClose };
}

// jsdom не реализует scrollIntoView (используется modemap-focus-need при
// прокрутке к полю потребности) — без мока обработчик события падает.
HTMLElement.prototype.scrollIntoView = vi.fn();

beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); });

describe('ModeMapNodeEditor — название и базовые действия', () => {
  it('меняет название → onChange с обновлённым label', () => {
    const { onChange } = renderEditor(baseNode());
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Покинутый ребёнок' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ label: 'Покинутый ребёнок' }) }));
  });

  it('кнопка «Удалить ноду» вызывает onDelete', () => {
    const { onDelete } = renderEditor(baseNode());
    fireEvent.click(screen.getByText('Удалить ноду'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('кнопка «Закрыть» вызывает onClose', () => {
    const { onClose } = renderEditor(baseNode());
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ModeMapNodeEditor — форма и тип фигуры', () => {
  it('выбор фигуры «Здоров» меняет type на healthy', () => {
    const { onChange } = renderEditor(baseNode());
    fireEvent.click(screen.getByTitle('Здоров'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'healthy' }));
  });

  it('выбор «Избег» ставит type=coping и copingSubtype=avoid', () => {
    const { onChange } = renderEditor(baseNode());
    fireEvent.click(screen.getByTitle('Избег'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      type: 'coping', data: expect.objectContaining({ copingSubtype: 'avoid' }),
    }));
  });
});

describe('ModeMapNodeEditor — цвет, заливка, толщина, размер текста', () => {
  it('клик по цветовому пресету ставит customColor', () => {
    const { onChange } = renderEditor(baseNode());
    fireEvent.click(screen.getByLabelText('Розовый'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ customColor: 'var(--c-rose)' }) }));
  });

  it('кнопка «Сбросить» убирает customColor', () => {
    const { onChange } = renderEditor(baseNode({ data: { label: 'x', customColor: 'var(--c-rose)' } }));
    fireEvent.click(screen.getByLabelText('Сбросить'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ customColor: undefined }) }));
  });

  it('«Средняя» заливка → filled=true, fillFull=false', () => {
    const { onChange } = renderEditor(baseNode());
    fireEvent.click(screen.getByText('Средняя'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ filled: true, fillFull: false }) }));
  });

  it('толщина контура «Жирный» пишет strokeWidth=bold', () => {
    const { onChange } = renderEditor(baseNode());
    fireEvent.click(screen.getByLabelText('Жирный'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ strokeWidth: 'bold' }) }));
  });

  it('размер текста «A» (lg) пишет fontSize=lg', () => {
    const { onChange } = renderEditor(baseNode());
    const buttons = screen.getAllByText('A');
    fireEvent.click(buttons[2]); // sm, md, lg — третья кнопка
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ fontSize: 'lg' }) }));
  });

  it('«Что показывать» — «+ Заметка» пишет display=note', () => {
    const { onChange } = renderEditor(baseNode());
    fireEvent.click(screen.getByText('+ Заметка'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ display: 'note' }) }));
  });
});

describe('ModeMapNodeEditor — условные поля по типу ноды', () => {
  it('child: показывает поле «Неудовлетворённая потребность»', () => {
    renderEditor(baseNode({ type: 'child' }));
    expect(screen.getByLabelText('Неудовлетворённая потребность')).toBeTruthy();
  });

  it('поле потребности: плейсхолдер звучит в форме «ты»', () => {
    renderEditor(baseNode({ type: 'child' }), {}, 'ty');
    expect(
      screen.getByPlaceholderText('Выбери или впиши свою…'),
    ).toBeTruthy();
  });

  it('поле потребности: плейсхолдер звучит в форме «вы»', () => {
    renderEditor(baseNode({ type: 'child' }), {}, 'vy');
    expect(
      screen.getByPlaceholderText('Выберите или впишите свою…'),
    ).toBeTruthy();
  });

  it('trigger: НЕ показывает поле потребности (только у child/custom)', () => {
    renderEditor(baseNode({ type: 'trigger' }));
    expect(screen.queryByLabelText('Неудовлетворённая потребность')).toBeNull();
  });

  it('coping: показывает «Что сказал бы Здоровый Взрослый», trigger — нет', () => {
    renderEditor(baseNode({ type: 'coping', data: { label: 'Гипер' } }));
    expect(screen.getByLabelText(/Что сказал бы Здоровый Взрослый/)).toBeTruthy();
    cleanup();
    renderEditor(baseNode({ type: 'trigger' }));
    expect(screen.queryByLabelText(/Что сказал бы Здоровый Взрослый/)).toBeNull();
  });

  it('заметка: непустой ввод пишет текст в note', () => {
    const { onChange } = renderEditor(baseNode());
    fireEvent.change(screen.getByLabelText('Заметка'), { target: { value: 'Прячется под столом' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ note: 'Прячется под столом' }) }));
  });

  it('заметка: очистка поля у ноды с текстом пишет note=undefined, а не пустую строку', () => {
    const { onChange } = renderEditor(baseNode({ data: { label: 'x', note: 'старый текст' } }));
    fireEvent.change(screen.getByLabelText('Заметка'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ note: undefined }) }));
  });

  it('выбор связанной схемы пишет schemaId', () => {
    const { onChange } = renderEditor(baseNode());
    fireEvent.change(screen.getByLabelText('Связанная схема'), { target: { value: 'abandonment' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ schemaId: 'abandonment' }) }));
  });
});

describe('ModeMapNodeEditor — карта пары: выбор партнёра', () => {
  it('coupleMode=true показывает переключатель «Партнёр А / Б», клик пишет side', () => {
    const { onChange } = renderEditor(baseNode(), { coupleMode: true });
    fireEvent.click(screen.getByText('Партнёр А'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ side: 'A' }) }));
  });

  it('повторный клик по уже выбранному партнёру снимает выбор (undefined)', () => {
    const { onChange } = renderEditor(baseNode({ data: { label: 'x', side: 'A' } }), { coupleMode: true });
    fireEvent.click(screen.getByText('Партнёр А'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ side: undefined }) }));
  });

  it('coupleMode не задан — переключатель партнёра не рендерится', () => {
    renderEditor(baseNode());
    expect(screen.queryByText('Партнёр А')).toBeNull();
  });
});

describe('ModeMapNodeEditor — подсказка критику: ты/вы-вилка (правило CLAUDE.md)', () => {
  it('форма «вы» — плейсхолдер ответа критику обращается на «вы»', () => {
    renderEditor(baseNode({ type: 'critic', data: { label: 'Критик' } }), {}, 'vy');
    const field = screen.getByLabelText(/Что сказал бы Здоровый Взрослый/) as HTMLTextAreaElement;
    expect(field.placeholder).toContain('От вас не требуется');
    expect(field.placeholder).not.toMatch(/[Тт]ы(?:\s|$)|[Тт]еб[еяё]/);
  });

  it('форма «ты» — плейсхолдер в форме «ты»', () => {
    renderEditor(baseNode({ type: 'critic', data: { label: 'Критик' } }), {}, 'ty');
    const field = screen.getByLabelText(/Что сказал бы Здоровый Взрослый/) as HTMLTextAreaElement;
    expect(field.placeholder).toContain('От тебя не требуется');
    expect(field.placeholder).not.toMatch(/[Вв]ас(?:\s|$)/);
  });
});

describe('ModeMapNodeEditor — клиническая подсказка ведёт к нужному полю', () => {
  it('клик по вопросу с target=need фокусирует поле потребности', () => {
    renderEditor(baseNode({ type: 'child' }));
    const q = screen.getByText('Какая детская потребность не удовлетворена?');
    fireEvent.click(q);
    expect(document.activeElement).toBe(screen.getByLabelText('Неудовлетворённая потребность'));
  });
});

describe('ModeMapNodeEditor — глобальные события фокуса (двойной клик по ноде / шаг гайда)', () => {
  it('modemap-focus-name фокусирует и выделяет поле названия', () => {
    renderEditor(baseNode());
    const nameField = screen.getByLabelText('Название') as HTMLInputElement;
    nameField.blur();
    window.dispatchEvent(new CustomEvent('modemap-focus-name'));
    expect(document.activeElement).toBe(nameField);
  });

  it('modemap-focus-need фокусирует поле неудовлетворённой потребности', () => {
    renderEditor(baseNode({ type: 'child' }));
    window.dispatchEvent(new CustomEvent('modemap-focus-need'));
    expect(document.activeElement).toBe(screen.getByLabelText('Неудовлетворённая потребность'));
  });
});
