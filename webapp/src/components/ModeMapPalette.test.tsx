// @vitest-environment jsdom
// ModeMapPalette — левая панель добавления режимов на карту (3% покрытия).
// Чистый React-компонент без @xyflow/react — рендерится напрямую. Проверяем
// поиск, добавление режима по клику, «вынести все режимы клиента» и полный
// CRUD своих режимов терапевта (создание/удаление) — с реальными API-моками.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
  waitFor,
  act,
} from '@testing-library/react';
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

beforeEach(() => {
  vi.clearAllMocks();
  getConceptualization.mockResolvedValue(null);
  listCustomModes.mockResolvedValue([]);
});
afterEach(() => cleanup());

function renderPalette(onAdd = vi.fn(), onAddMany = vi.fn(), form: 'ty' | 'vy' = 'ty') {
  render(
    <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
      <ModeMapConceptProvider clientId={7}>
        <ModeMapPalette onAdd={onAdd} onAddMany={onAddMany} />
      </ModeMapConceptProvider>
    </AddressFormContext.Provider>,
  );
  return { onAdd, onAddMany };
}

describe('ModeMapPalette — секция «Схема случая»', () => {
  const ITEMS: [string, string][] = [
    ['Схема', 'schema'],
    ['Опыт детства', 'origin'],
    ['Потребность', 'need'],
    ['Круг потребностей', 'needs'],
  ];

  it.each(ITEMS)('клик по «%s» добавляет ноду типа %s', (name, type) => {
    const { onAdd } = renderPalette();
    fireEvent.click(screen.getByText(name));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ type, data: expect.objectContaining({ label: expect.any(String) }) }));
  });

  it('круг потребностей кладётся с диаметром, потребность — без чужих полей', () => {
    const { onAdd } = renderPalette();
    fireEvent.click(screen.getByText('Круг потребностей'));
    fireEvent.click(screen.getByText('Потребность'));
    expect(onAdd.mock.calls[0][0].data).toMatchObject({ label: 'Базовые эмоциональные потребности', diameter: 340 });
    expect(onAdd.mock.calls[1][0].data).toEqual({ label: 'Потребность' });
  });

  it('перетаскивание кладёт заготовку в dataTransfer под тем же ключом, что читает холст', () => {
    renderPalette();
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByText('Опыт детства'), { dataTransfer: { setData, effectAllowed: '' } });
    expect(setData).toHaveBeenCalledWith('application/modemap-node', expect.stringContaining('"type":"origin"'));
  });

  it('поиск режима прячет секцию, чтобы «Ничего не найдено» не спорил с ней', () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText('Режим или схема…'), { target: { value: 'Упрямый' } });
    expect(screen.queryByText('Схема случая')).toBeNull();
    expect(screen.queryByText('Круг потребностей')).toBeNull();
  });
});

describe('ModeMapPalette — поиск и добавление стандартных режимов', () => {
  it('клик по «Триггер / Ситуация» добавляет узел типа trigger', () => {
    const { onAdd } = renderPalette();
    fireEvent.click(screen.getByText('Триггер / Ситуация'));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'trigger',
        data: expect.objectContaining({ label: 'Триггер' }),
      }),
    );
  });

  it('клик по «Поведение / Последствие» добавляет узел типа behavior', () => {
    const { onAdd } = renderPalette();
    fireEvent.click(screen.getByText('Поведение / Последствие'));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'behavior' }),
    );
  });

  it('поиск фильтрует режимы группы по названию', () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText('Режим или схема…'), {
      target: { value: 'Упрямый' },
    });
    expect(screen.getByText('Упрямый Ребёнок')).toBeTruthy();
    expect(screen.queryByText('Одинокий Ребёнок')).toBeNull();
  });

  it('поиск без совпадений показывает «Ничего не найдено»', () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText('Режим или схема…'), {
      target: { value: 'зюзюзюкод' },
    });
    expect(screen.getByText('Ничего не найдено')).toBeTruthy();
  });

  it('раскрытие группы показывает её режимы, клик по режиму добавляет узел с копинг-подтипом', () => {
    const { onAdd } = renderPalette();
    fireEvent.click(screen.getByText('Детские режимы'));
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'child',
        data: expect.objectContaining({ modeId: 'vulnerable_child' }),
      }),
    );
  });
});

describe('ModeMapPalette — цвет группы = цвет узла на холсте', () => {
  // QA 2026-10-26: детские режимы были красными в палитре (тон кабинета) и
  // сине-зелёными на холсте (TYPE_COLORS), критикующие — фиолетовыми и красными.
  it.each([
    ['child', 'child'],
    ['critic', 'critic'],
    ['coping_avoidance', 'coping'],
    ['healthy', 'healthy'],
  ])('группа %s красится цветом узла типа %s', (groupId, type) => {
    renderPalette();
    const group = document.querySelector(`[data-group="${groupId}"]`) as HTMLElement;
    expect(group.style.getPropertyValue('--gc')).toBe(TYPE_COLORS[type]);
  });
});

describe('ModeMapPalette — знаки бумажной аппликации (docs/design/PAPER_2026-11.md)', () => {
  // Владелец 2026-11-07 по скриншоту палитры: «нет ничего из картинок стиля».
  const headSign = (group: string) => paperSignName(document.querySelector(`[data-group="${group}"] .mm2-pal-head svg`));

  it.each([
    ['child', 'ChildCare'], ['critic', 'Looming'], ['coping_overcompensation', 'Shield'],
    ['coping_avoidance', 'Shelter'], ['coping_surrender', 'Yield'], ['healthy', 'Together'],
  ])('заголовок группы %s — знак группы %s', (groupId, sign) => {
    renderPalette();
    expect(headSign(groupId)).toBe(sign);
  });

  it.each([
    ['rejection', 'Domain1'], ['autonomy', 'Domain2'], ['limits', 'Domain3'], ['other_directed', 'Domain4'], ['vigilance', 'Domain5'],
  ])('заголовок домена %s — его знак %s', (domainId, sign) => {
    renderPalette();
    expect(headSign(`domain:${domainId}`)).toBe(sign);
  });

  it('раскрытая группа: строки режимов держат точку цвета фигуры, знака у строк нет', () => {
    renderPalette();
    fireEvent.click(screen.getByText('Детские режимы'));
    const row = screen.getByText('Уязвимый Ребёнок').closest('button')!;
    expect(row.querySelector('.mm2-gdot')).not.toBeNull();
    expect(row.querySelector('svg')).toBeNull();
  });

  it('«Мои режимы» — Cluster, «Схемы клиента» — Layers; подписи блоков без знака (знаки групп сразу под ними)', async () => {
    await act(async () => { renderPalette(); });
    const head = (name: string) => screen.getByText(name).closest('.mm2-mine-head')!.querySelector('svg');
    expect(paperSignName(head('Мои режимы'))).toBe('Cluster');
    expect(paperSignName(head('Схемы клиента'))).toBe('Layers');
    for (const h of screen.getAllByRole('heading')) expect(h.querySelector('svg'), h.textContent ?? '').toBeNull();
  });

  it('при поиске знак группы остаётся в заголовке', () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText('Режим или схема…'), { target: { value: 'Упрямый' } });
    expect(headSign('child')).toBe('ChildCare');
  });
});

describe('ModeMapPalette — режимы клиента (из концептуализации)', () => {
  // Список режимов клиента приезжает из api.getConceptualization в mount-
  // эффекте — обновление прилетает из-под await, вне act, и опрос findByText
  // (timeout 8000) с ним иногда расходится. Оборачиваем рендер в act(async):
  // он дожидается промиса, дальше ассерт синхронный. Раньше ждали текст
  // «▼ 2» — то же число показывает статичный счётчик группы «Копинг:
  // Капитуляция» (2 стандартных режима), совпадение делает ассерт
  // неоднозначным (getByText падает на нескольких найденных). Само число при
  // этом проверять надо — оно в заголовке названия раздела и есть «сколько
  // режимов у клиента», — поэтому ищем его не по всему документу, а внутри
  // кнопки раздела: там счётчик один.
  it('показывает раздел с количеством режимов клиента и разворачивает список по клику', async () => {
    getConceptualization.mockResolvedValue({
      modeIds: ['vulnerable_child', 'demanding_critic'],
    });
    await act(async () => {
      renderPalette();
    });
    const header = screen.getByText('Режимы клиента').closest('button')!;
    expect(within(header).getByText('▼ 2')).toBeTruthy();
    fireEvent.click(screen.getByText('Режимы клиента'));
    expect(screen.getByText('Уязвимый Ребёнок')).toBeTruthy();
    expect(screen.getByText('Требовательный Критик')).toBeTruthy();
  });

  it('«вынести все» зовёт onAddMany со всеми режимами клиента одним пакетом', async () => {
    getConceptualization.mockResolvedValue({
      modeIds: ['vulnerable_child', 'demanding_critic'],
    });
    const onAddMany = vi.fn();
    await act(async () => {
      renderPalette(vi.fn(), onAddMany);
    });
    fireEvent.click(
      screen.getByLabelText('Вынести все режимы клиента на карту'),
    );
    expect(onAddMany).toHaveBeenCalledTimes(1);
    expect(onAddMany.mock.calls[0][0]).toHaveLength(2);
  });

  it('пустой список режимов клиента — раздел не рендерится', async () => {
    getConceptualization.mockResolvedValue({ modeIds: [] });
    renderPalette();
    await Promise.resolve();
    expect(screen.queryByText('Режимы клиента')).toBeNull();
  });

  // Регресс: сбой getConceptualization раньше подставлял [] в catch — секция
  // «Режимы клиента» рендерится только при length > 0, поэтому терапевт видел
  // ровно то же самое, что при настоящем «режимов нет» (карта режимов, три
  // молчания). Теперь сбой ≠ пусто: секция видна с текстом отказа.
  it('сбой загрузки режимов клиента — секция видна с текстом отказа, не «раздела нет»', async () => {
    getConceptualization.mockRejectedValue(new Error('offline'));
    await act(async () => {
      renderPalette();
    });
    expect(screen.getByText('Режимы клиента')).toBeTruthy();
    expect(screen.getByText('Не удалось загрузить режимы клиента')).toBeTruthy();
  });
});

describe('ModeMapPalette — свои режимы терапевта', () => {
  it('без своих режимов показывает подсказку-заглушку', async () => {
    // listCustomModes резолвится в mount-эффекте, обновление вне act —
    // ждём его через act(async), а не опросом.
    await act(async () => {
      renderPalette();
    });
    expect(screen.getByText(/Добавь режимы, с которыми/)).toBeTruthy();
  });

  it('в форме «вы» подсказка-заглушка не показывает «ты»', async () => {
    await act(async () => {
      renderPalette(vi.fn(), vi.fn(), 'vy');
    });
    expect(screen.getByText(/Добавьте режимы, с которыми/)).toBeTruthy();
    expect(screen.getByText(/работаете чаще всего/)).toBeTruthy();
  });

  it('создание нового режима: форма → «Сохранить» → появляется в списке', async () => {
    const created: TherapistCustomMode = {
      id: 1,
      therapistId: 1,
      name: 'Мой режим',
      emoji: '🔶',
      nodeType: 'custom',
      createdAt: '2026-01-01',
    };
    createCustomMode.mockResolvedValue(created);
    renderPalette();
    fireEvent.click(screen.getByLabelText('Добавить свой режим'));
    fireEvent.change(screen.getByPlaceholderText('Название…'), {
      target: { value: 'Мой режим' },
    });
    // saveCustomMode ждёт api.createCustomMode — оборачиваем клик в act(async),
    // чтобы дождаться промиса вместо опроса findByText.
    await act(async () => {
      fireEvent.click(screen.getByText('Сохранить'));
    });
    expect(screen.getByText('Мой режим')).toBeTruthy();
    expect(createCustomMode).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Мой режим' }),
    );
  });

  // Аудит 2026-10, «Доступность»: у кнопки отмены внутри была только иконка
  // крестика с aria-hidden — скринридер называл её просто «кнопка».
  it('кнопка отмены формы названа «Отменить» и закрывает форму', () => {
    renderPalette();
    fireEvent.click(screen.getByLabelText('Добавить свой режим'));
    fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(screen.queryByPlaceholderText('Название…')).toBeNull();
  });

  it('пустое имя не сохраняет режим (createCustomMode не вызывается)', () => {
    renderPalette();
    fireEvent.click(screen.getByLabelText('Добавить свой режим'));
    fireEvent.click(screen.getByText('Сохранить'));
    expect(createCustomMode).not.toHaveBeenCalled();
  });

  it('клик по своему режиму в списке добавляет его на карту', async () => {
    listCustomModes.mockResolvedValue([
      {
        id: 5,
        therapistId: 1,
        name: 'Особый',
        emoji: '⭐',
        nodeType: 'healthy',
        createdAt: '2026-01-01',
      },
    ]);
    const onAdd = vi.fn();
    await act(async () => {
      renderPalette(onAdd);
    });
    fireEvent.click(screen.getByText('Особый'));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'healthy',
        data: expect.objectContaining({ label: 'Особый' }),
      }),
    );
  });

  it('удаление своего режима вызывает API и убирает его из списка', async () => {
    listCustomModes.mockResolvedValue([
      {
        id: 5,
        therapistId: 1,
        name: 'Особый',
        emoji: '⭐',
        nodeType: 'custom',
        createdAt: '2026-01-01',
      },
    ]);
    deleteCustomMode.mockResolvedValue(undefined);
    await act(async () => {
      renderPalette();
    });
    const row = screen.getByText('Особый').closest('div')!;
    fireEvent.click(
      within(row.parentElement as HTMLElement).getByLabelText('Удалить'),
    );
    expect(deleteCustomMode).toHaveBeenCalledWith(5);
    await waitFor(() => expect(screen.queryByText('Особый')).toBeNull());
  });

  // Регресс: listCustomModes раньше глушился `.catch(() => {})` — свои режимы
  // терапевта молча не загружались, и панель показывала ту же заглушку-подсказку
  // «Добавь режимы…», что и на честно пустом списке (карта режимов, три молчания).
  it('сбой загрузки своих режимов — видна строка отказа, заглушки «Добавь режимы…» нет', async () => {
    listCustomModes.mockRejectedValue(new Error('offline'));
    await act(async () => {
      renderPalette();
    });
    expect(
      screen.getByText('Не удалось загрузить твои режимы'),
    ).toBeTruthy();
    expect(screen.queryByText(/Добавь режимы, с которыми/)).toBeNull();
  });
});

describe('ModeMapPalette — порядок блоков и каталог схем', () => {
  const PH = 'Режим или схема…';
  const search = (v: string) => fireEvent.change(screen.getByPlaceholderText(PH), { target: { value: v } });
  const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('блоки идут: Режимы → Схемы → Фигуры, внутри «клиента» раньше каталога', async () => {
    getConceptualization.mockResolvedValue({ modeIds: ['vulnerable_child'], schemaIds: ['abandonment'] });
    await act(async () => { renderPalette(); });
    const order = [
      screen.getByRole('heading', { name: 'Режимы' }),
      screen.getByText('Режимы клиента'),
      screen.getByText('Детские режимы'),
      screen.getByText('Мои режимы'),
      screen.getByRole('heading', { name: 'Схемы' }),
      screen.getByText('Схемы клиента'),
      screen.getByText('Нарушение связи и отвержение'),
      screen.getByRole('heading', { name: 'Фигуры' }),
      screen.getByText('Триггер / Ситуация'),
      screen.getByText('Поведение / Последствие'),
      screen.getByText('Схема случая'),
    ];
    order.slice(1).forEach((el, i) => expect(before(order[i], el), `${order[i].textContent} → ${el.textContent}`).toBe(true));
  });

  it('пять доменов свёрнуты; клик раскрывает схемы; клик по схеме добавляет узел с цветом домена', () => {
    const { onAdd } = renderPalette();
    const domains = document.querySelectorAll('[data-group^="domain:"]');
    expect(domains).toHaveLength(5);
    expect(screen.queryByText('Покинутость / Нестабильность')).toBeNull();
    fireEvent.click(screen.getByText('Нарушение связи и отвержение'));
    fireEvent.click(screen.getByText('Покинутость / Нестабильность'));
    const color = (domains[0] as HTMLElement).style.getPropertyValue('--gc');
    expect(color).not.toBe('');
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({
      type: 'schema',
      data: expect.objectContaining({ schemaId: 'abandonment', label: 'Покинутость / Нестабильность', customColor: color }),
    }));
  });

  it('перетаскивание схемы кладёт JSON под ключ холста', () => {
    renderPalette();
    fireEvent.click(screen.getByText('Нарушение связи и отвержение'));
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByText('Покинутость / Нестабильность'), { dataTransfer: { setData, effectAllowed: '' } });
    expect(setData).toHaveBeenCalledWith('application/modemap-node', expect.stringContaining('"schemaId":"abandonment"'));
  });

  it('поиск схемы: схема и заголовок «Схемы» видны, «Режимов» нет', () => {
    renderPalette();
    // «покину» совпадает ещё и с режимом «Покинутый Ребёнок», поэтому берём «покинутость».
    search('покинутость');
    expect(screen.getByText('Покинутость / Нестабильность')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Схемы' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Режимы' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Фигуры' })).toBeNull();
  });

  it('«покину» находит и схему, и режим: оба блока видны', () => {
    renderPalette();
    search('покину');
    expect(screen.getByText('Покинутость / Нестабильность')).toBeTruthy();
    expect(screen.getByText('Покинутый Ребёнок')).toBeTruthy();
  });

  it('поиск режима: заголовка «Схемы» нет', () => {
    renderPalette();
    search('Упрямый');
    expect(screen.getByText('Упрямый Ребёнок')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Режимы' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Схемы' })).toBeNull();
  });

  it('совпадение в «Моих режимах» видно, без «+» и без «не найдено»', async () => {
    listCustomModes.mockResolvedValue([{ id: 5, therapistId: 1, name: 'Особый', emoji: '⭐', nodeType: 'custom', createdAt: '2026-01-01' }]);
    await act(async () => { renderPalette(); });
    search('особ');
    expect(screen.getByText('Особый')).toBeTruthy();
    expect(screen.queryByLabelText('Добавить свой режим')).toBeNull();
    expect(screen.queryByText('Ничего не найдено')).toBeNull();
  });

  it('«Мои режимы» без совпадений при поиске — секции нет', async () => {
    listCustomModes.mockResolvedValue([{ id: 5, therapistId: 1, name: 'Особый', emoji: '⭐', nodeType: 'custom', createdAt: '2026-01-01' }]);
    await act(async () => { renderPalette(); });
    search('Упрямый');
    expect(screen.queryByText('Мои режимы')).toBeNull();
  });

  it('поиск без совпадений — «Ничего не найдено» и ни одного заголовка блока', () => {
    renderPalette();
    search('зюзюзюкод');
    expect(screen.getByText('Ничего не найдено')).toBeTruthy();
    expect(screen.queryAllByRole('heading')).toHaveLength(0);
  });
});
