// @vitest-environment jsdom
// SchemaDetailSheet — карточка описания одной схемы (0% покрытия): читает
// «мои схемы» из localStorage, кнопка добавления реально переключает (не
// только добавляет) и синхронизирует localStorage + сервер, неизвестный
// schemaId не рендерит ничего (не крашится). ShareCardSheet рисует canvas —
// мокаем (jsdom не поддерживает getContext).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SchemaDetailSheet } from './SchemaDetailSheet';
import { SCHEMA_DOMAINS } from '../schemaTherapyData';

vi.mock('../api', () => ({
  api: { updateSettings: vi.fn().mockResolvedValue(undefined) },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

vi.mock('../share/ShareCardSheet', () => ({
  ShareCardSheet: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="share-card-sheet">
      <button onClick={onClose}>share-card-close</button>
    </div>
  ),
}));

const SCHEMA_ID = SCHEMA_DOMAINS[0].schemas[0].id;
const SCHEMA_NAME = SCHEMA_DOMAINS[0].schemas[0].name;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(cleanup);

describe('SchemaDetailSheet — неизвестный id', () => {
  it('для несуществующего schemaId не рендерит ничего (не падает)', () => {
    const { container } = render(
      <SchemaDetailSheet
        schemaId="nonexistent"
        onClose={() => {}}
        onOpenDiary={() => {}}
      />,
    );
    expect(container.textContent).toBe('');
  });
});

describe('SchemaDetailSheet — состояние «в моих схемах» из реального localStorage', () => {
  it('без сохранённого выбора — кнопка предлагает добавить', () => {
    render(
      <SchemaDetailSheet
        schemaId={SCHEMA_ID}
        onClose={() => {}}
        onOpenDiary={() => {}}
      />,
    );
    expect(screen.getByText('+ В мои схемы')).toBeTruthy();
  });

  it('схема уже в localStorage — кнопка показывает реальное состояние, а не всегда «добавить»', () => {
    localStorage.setItem('my_schema_ids', JSON.stringify([SCHEMA_ID]));
    render(
      <SchemaDetailSheet
        schemaId={SCHEMA_ID}
        onClose={() => {}}
        onOpenDiary={() => {}}
      />,
    );
    expect(screen.getByText('✓ В моих схемах')).toBeTruthy();
  });
});

describe('SchemaDetailSheet — переключение (toggle, не только добавление)', () => {
  it('клик добавляет схему и синхронизирует localStorage + сервер', () => {
    render(
      <SchemaDetailSheet
        schemaId={SCHEMA_ID}
        onClose={() => {}}
        onOpenDiary={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('+ В мои схемы'));

    expect(screen.getByText('✓ В моих схемах')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('my_schema_ids') ?? '[]')).toEqual([
      SCHEMA_ID,
    ]);
    expect(mockApi.updateSettings).toHaveBeenCalledWith({
      mySchemaIds: [SCHEMA_ID],
    });
  });

  it('повторный клик убирает схему обратно (реальный toggle)', () => {
    localStorage.setItem(
      'my_schema_ids',
      JSON.stringify([SCHEMA_ID, 'other_id']),
    );
    render(
      <SchemaDetailSheet
        schemaId={SCHEMA_ID}
        onClose={() => {}}
        onOpenDiary={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('✓ В моих схемах'));

    expect(screen.getByText('+ В мои схемы')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('my_schema_ids') ?? '[]')).toEqual([
      'other_id',
    ]);
  });
});

describe('SchemaDetailSheet — «Познакомиться» закрывает лист и открывает дневник', () => {
  it('вызывает onClose и onOpenDiary', () => {
    const onClose = vi.fn();
    const onOpenDiary = vi.fn();
    render(
      <SchemaDetailSheet
        schemaId={SCHEMA_ID}
        onClose={onClose}
        onOpenDiary={onOpenDiary}
      />,
    );
    fireEvent.click(screen.getByText('Познакомиться →'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenDiary).toHaveBeenCalledTimes(1);
  });
});

describe('SchemaDetailSheet — закрытие по фону, не по клику внутри карточки', () => {
  it('клик по названию схемы (внутри) не закрывает лист', () => {
    const onClose = vi.fn();
    render(
      <SchemaDetailSheet
        schemaId={SCHEMA_ID}
        onClose={onClose}
        onOpenDiary={() => {}}
      />,
    );
    fireEvent.click(screen.getByText(SCHEMA_NAME));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('SchemaDetailSheet — карточка-шеринг', () => {
  it('клик «Поделиться карточкой» открывает ShareCardSheet', () => {
    render(
      <SchemaDetailSheet
        schemaId={SCHEMA_ID}
        onClose={() => {}}
        onOpenDiary={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Поделиться карточкой'));
    expect(screen.getByTestId('share-card-sheet')).toBeTruthy();
  });
});
