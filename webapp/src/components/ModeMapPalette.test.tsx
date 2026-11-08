// @vitest-environment jsdom
// ModeMapPalette — левая панель холста. По умолчанию — только «Этот клиент» и фигуры;
// весь каталог — одной строкой внизу; поиск идёт по всему и показывает плоский список.
// Знаки — язык бумажной аппликации (docs/design/PAPER_2026-11.md). API — моки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import { ModeMapPalette } from './ModeMapPalette';
import type { TherapistCustomMode } from '../api';
import { AddressFormContext } from '../utils/addressForm';
import { TYPE_COLORS } from './modeMapData';
import { ModeMapConceptProvider } from './modeMap/ModeMapConceptProvider';
import { paperSignName } from '../test-support/paperSign';

const getConceptualization = vi.fn();
const listCustomModes = vi.fn();
const createCustomMode = vi.fn();
const deleteCustomMode = vi.fn();
vi.mock('../api', () => ({
  api: {
    getConceptualization: (...a: unknown[]) => getConceptualization(...a),
    listCustomModes: (...a: unknown[]) => listCustomModes(...a),
    createCustomMode: (...a: unknown[]) => createCustomMode(...a),
    deleteCustomMode: (...a: unknown[]) => deleteCustomMode(...a),
  },
}));

const CLIENT = { modeIds: ['vulnerable_child', 'demanding_critic'], schemaIds: ['abandonment', 'no_such_schema'] };
const MINE: TherapistCustomMode = { id: 5, therapistId: 1, name: 'Особый', emoji: '⭐', nodeType: 'healthy', createdAt: '2026-01-01' };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  getConceptualization.mockResolvedValue(CLIENT);
  listCustomModes.mockResolvedValue([]);
});
afterEach(() => cleanup());

/** Рендер с загруженной концептуализацией и своими режимами (оба приезжают из эффектов). */
async function renderPalette(onAdd = vi.fn(), onAddMany = vi.fn(), form: 'ty' | 'vy' = 'ty') {
  await act(async () => {
    render(
      <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
        <ModeMapConceptProvider clientId={7}>
          <ModeMapPalette onAdd={onAdd} onAddMany={onAddMany} />
        </ModeMapConceptProvider>
      </AddressFormContext.Provider>,
    );
  });
  return { onAdd, onAddMany };
}
const catalogRow = () => screen.getByRole('button', { name: /Все режимы и схемы/ });
const openCatalog = () => fireEvent.click(catalogRow());
const search = (v: string) => fireEvent.change(screen.getByPlaceholderText('Режим или схема…'), { target: { value: v } });
const headSign = (group: string) => paperSignName(document.querySelector(`[data-group="${group}"] .mm2-pal-head .mm2-pal-mark svg`));
const rowMark = (name: string) => screen.getByText(name).closest('button')!.querySelector('svg')!.getAttribute('data-mark');

describe('ModeMapPalette — по умолчанию только клиент и фигуры', () => {
  it('видны «Этот клиент» и «Фигуры», каталог закрыт одной строкой с тихим счётчиком', async () => {
    await renderPalette();
    expect(screen.getAllByRole('heading').map(h => h.textContent)).toEqual(['Этот клиент', 'Фигуры']);
    expect(screen.getByText('Уязвимый Ребёнок')).toBeTruthy();
    expect(screen.getByText('Покинутость / Нестабильность')).toBeTruthy();
    expect(catalogRow().getAttribute('aria-expanded')).toBe('false');
    expect(catalogRow().textContent).toContain('55');
    expect(screen.queryByText('Детские')).toBeNull();
    expect(document.querySelector('[data-group]')).toBeNull();
  });

  it('каталог раскрывается: группы свёрнуты, клик по группе показывает режимы; выбор запоминается', async () => {
    const { onAdd } = await renderPalette();
    openCatalog();
    expect(localStorage.getItem('modemap_catalog')).toBe('1');
    expect(document.querySelectorAll('[data-group]')).toHaveLength(11);
    expect(screen.queryByText('Одинокий Ребёнок')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Детские/ }));
    fireEvent.click(screen.getByText('Одинокий Ребёнок'));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ type: 'child', data: expect.objectContaining({ modeId: 'lonely_child' }) }));
    cleanup();
    await renderPalette();
    expect(catalogRow().getAttribute('aria-expanded')).toBe('true');
  });

  it('новый клиент без концептуализации: тихая строка, каталог открыт', async () => {
    getConceptualization.mockResolvedValue(null);
    await renderPalette();
    expect(screen.getByText('Режимы и схемы из концептуализации появятся здесь')).toBeTruthy();
    expect(catalogRow().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Детские/ })).toBeTruthy();
  });

  // Сбой ≠ пусто: раньше секция клиента молча не рендерилась (три молчания карты режимов).
  it('сбой загрузки концептуализации — строка отказа, каталог открыт', async () => {
    getConceptualization.mockRejectedValue(new Error('offline'));
    await renderPalette();
    expect(screen.getByText('Не удалось загрузить режимы и схемы клиента')).toBeTruthy();
    expect(screen.queryByText('Режимы и схемы из концептуализации появятся здесь')).toBeNull();
    expect(catalogRow().getAttribute('aria-expanded')).toBe('true');
  });
});

describe('ModeMapPalette — блок «Этот клиент»', () => {
  it('режимы — круги со счётчиком, схемы — слои; неизвестная схема пропускается', async () => {
    await renderPalette();
    expect(screen.getByText('Режимы').closest('.mm2-pal-head')!.querySelector('.mm2-pal-head-n')!.textContent).toBe('2');
    expect(screen.getByText('Схемы').closest('.mm2-pal-head')!.querySelector('.mm2-pal-head-n')!.textContent).toBe('1');
    expect(rowMark('Требовательный Критик')).toBe('mode');
    expect(rowMark('Покинутость / Нестабильность')).toBe('schema');
    expect(paperSignName(screen.getByText('Режимы').closest('.mm2-pal-head')!.querySelector('svg'))).toBe('Cluster');
    expect(paperSignName(screen.getByText('Схемы').closest('.mm2-pal-head')!.querySelector('svg'))).toBe('Layers');
  });

  it('круг режима — цвет его фигуры на холсте', async () => {
    await renderPalette();
    const circle = screen.getByText('Требовательный Критик').closest('button')!.querySelector('circle')!;
    expect(circle.getAttribute('fill')).toBe(TYPE_COLORS.critic);
  });

  it('тихое «+ все» зовёт onAddMany со всеми режимами клиента одним пакетом', async () => {
    const { onAddMany } = await renderPalette();
    const all = screen.getByLabelText('Вынести все режимы клиента на карту');
    expect(all.className).not.toContain('ds-btn');
    fireEvent.click(all);
    expect(onAddMany).toHaveBeenCalledTimes(1);
    expect(onAddMany.mock.calls[0][0]).toHaveLength(2);
  });

  it('клик по схеме клиента кладёт узел schema с schemaId и названием; имя целиком в подсказке', async () => {
    const { onAdd } = await renderPalette();
    const row = screen.getByText('Покинутость / Нестабильность').closest('button')!;
    expect(row.getAttribute('title')).toContain('Покинутость / Нестабильность');
    fireEvent.click(row);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      type: 'schema', data: expect.objectContaining({ schemaId: 'abandonment', label: 'Покинутость / Нестабильность' }),
    }));
  });
});

describe('ModeMapPalette — фигуры сеткой', () => {
  it.each([
    ['Триггер', 'trigger'], ['Поведение', 'behavior'], ['Схема', 'schema'],
    ['Опыт детства', 'origin'], ['Потребность', 'need'], ['Круг потребностей', 'needs'],
  ])('«%s» — бумажный знак и подпись; клик кладёт узел %s', async (name, type) => {
    const { onAdd } = await renderPalette();
    const tile = screen.getByText(name).closest('button')!;
    expect(tile.className).toContain('mm2-fig');
    expect(tile.querySelector(`svg[data-mark="${type}"]`)).not.toBeNull();
    fireEvent.click(tile);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ type }));
  });

  it('перетаскивание кладёт заготовку в dataTransfer под тем же ключом, что читает холст', async () => {
    await renderPalette();
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByText('Опыт детства'), { dataTransfer: { setData, effectAllowed: '' } });
    expect(setData).toHaveBeenCalledWith('application/modemap-node', expect.stringContaining('"type":"origin"'));
  });
});

describe('ModeMapPalette — поиск по всему, плоским списком', () => {
  it('«крит» находит критиков из закрытого каталога: строки со знаками, без групп и подписей блоков', async () => {
    const { onAdd } = await renderPalette();
    search('крит');
    expect(screen.getByText('Карающий Критик')).toBeTruthy();
    expect(rowMark('Карающий Критик')).toBe('mode');
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
    expect(document.querySelector('[data-group]')).toBeNull();
    expect(screen.queryByText('Все режимы и схемы')).toBeNull();
    fireEvent.click(screen.getByText('Карающий Критик'));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ type: 'critic', data: expect.objectContaining({ modeId: 'punitive_critic' }) }));
  });

  it('«покину» находит и режим, и схему; режим клиента не дублируется', async () => {
    await renderPalette();
    search('покину');
    expect(screen.getAllByText('Покинутость / Нестабильность')).toHaveLength(1);
    expect(screen.getByText('Покинутый Ребёнок')).toBeTruthy();
  });

  it('находит свой режим и фигуру по ключевому слову', async () => {
    listCustomModes.mockResolvedValue([MINE]);
    await renderPalette();
    search('особ');
    expect(screen.getByText('Особый')).toBeTruthy();
    expect(screen.queryByLabelText('Добавить свой режим')).toBeNull();
    search('последств');
    expect(rowMark('Поведение')).toBe('behavior');
  });

  it('без совпадений — «Ничего не найдено» и ни одного заголовка', async () => {
    await renderPalette();
    search('зюзюзюкод');
    expect(screen.getByText('Ничего не найдено')).toBeTruthy();
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
  });
});

describe('ModeMapPalette — свои режимы терапевта', () => {
  it('пока своих нет — строка «Мои режимы» с «+» в каталоге и подсказка в форме «ты» и «вы»', async () => {
    await renderPalette();
    expect(screen.queryByText('Мои режимы')).toBeNull();
    openCatalog();
    expect(screen.getByText('Мои режимы')).toBeTruthy();
    expect(screen.getByText(/Добавь режимы, с которыми работаешь/)).toBeTruthy();
    cleanup();
    localStorage.clear();
    await renderPalette(vi.fn(), vi.fn(), 'vy');
    openCatalog();
    expect(screen.getByText(/Добавьте режимы, с которыми работаете/)).toBeTruthy();
  });

  it('есть свои — секция в блоке клиента до фигур: круг цвета фигуры, клик кладёт режим', async () => {
    listCustomModes.mockResolvedValue([MINE]);
    const { onAdd } = await renderPalette();
    const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(before(screen.getByText('Мои режимы'), screen.getByRole('heading', { name: 'Фигуры' }))).toBe(true);
    expect(paperSignName(screen.getByText('Мои режимы').closest('.mm2-pal-head')!.querySelector('svg'))).toBe('Cluster');
    const circle = screen.getByText('Особый').closest('button')!.querySelector('circle')!;
    expect(circle.getAttribute('fill')).toBe(TYPE_COLORS.healthy);
    fireEvent.click(screen.getByText('Особый'));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ type: 'healthy', data: expect.objectContaining({ label: 'Особый' }) }));
  });

  it('создание: форма → «Сохранить» → режим в блоке клиента', async () => {
    createCustomMode.mockResolvedValue({ ...MINE, id: 1, name: 'Мой режим', nodeType: 'custom' });
    await renderPalette();
    openCatalog();
    fireEvent.click(screen.getByLabelText('Добавить свой режим'));
    fireEvent.change(screen.getByPlaceholderText('Название…'), { target: { value: 'Мой режим' } });
    await act(async () => { fireEvent.click(screen.getByText('Сохранить')); });
    expect(createCustomMode).toHaveBeenCalledWith(expect.objectContaining({ name: 'Мой режим' }));
    expect(screen.getByText('Мой режим')).toBeTruthy();
  });

  // Аудит 2026-10, «Доступность»: у кнопки отмены была только иконка с aria-hidden.
  it('отмена формы названа «Отменить» и закрывает форму; пустое имя не сохраняется', async () => {
    await renderPalette();
    openCatalog();
    fireEvent.click(screen.getByLabelText('Добавить свой режим'));
    fireEvent.click(screen.getByText('Сохранить'));
    expect(createCustomMode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(screen.queryByPlaceholderText('Название…')).toBeNull();
  });

  it('удаление зовёт API и убирает режим', async () => {
    listCustomModes.mockResolvedValue([MINE]);
    deleteCustomMode.mockResolvedValue(undefined);
    await renderPalette();
    fireEvent.click(screen.getByText('Особый').closest('.mm2-mine-row')!.querySelector('[aria-label="Удалить"]')!);
    expect(deleteCustomMode).toHaveBeenCalledWith(5);
    await waitFor(() => expect(screen.queryByText('Особый')).toBeNull());
  });

  // Регресс: сбой загрузки глушился и выглядел как честно пустой список.
  it('сбой загрузки своих режимов — строка отказа, подсказки «Добавь режимы…» нет', async () => {
    listCustomModes.mockRejectedValue(new Error('offline'));
    await renderPalette();
    openCatalog();
    expect(screen.getByText('Не удалось загрузить твои режимы')).toBeTruthy();
    expect(screen.queryByText(/Добавь режимы, с которыми/)).toBeNull();
  });
});

describe('ModeMapPalette — знаки групп каталога', () => {
  it.each([
    ['child', 'ChildCare'], ['critic', 'Looming'], ['coping_overcompensation', 'Shield'],
    ['coping_avoidance', 'Shelter'], ['coping_surrender', 'Yield'], ['healthy', 'Together'],
    ['domain:rejection', 'Domain1'], ['domain:autonomy', 'Domain2'], ['domain:limits', 'Domain3'],
    ['domain:other_directed', 'Domain4'], ['domain:vigilance', 'Domain5'],
  ])('заголовок %s — знак %s', async (group, sign) => {
    await renderPalette();
    openCatalog();
    expect(headSign(group)).toBe(sign);
  });

  it('раскрытый домен: схемы — слои цвета домена, клик кладёт узел с этим цветом', async () => {
    const { onAdd } = await renderPalette();
    openCatalog();
    fireEvent.click(screen.getByRole('button', { name: /Нарушение связи и отвержение/ }));
    const row = screen.getAllByText('Недоверие / Ожидание жестокого обращения')[0].closest('button')!;
    const color = row.querySelector('rect')!.getAttribute('fill');
    fireEvent.click(row);
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      type: 'schema', data: expect.objectContaining({ schemaId: 'mistrust', customColor: color }),
    }));
  });
});
