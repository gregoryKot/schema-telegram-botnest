// @vitest-environment jsdom
// ModeMapCoupleLanes — дорожки партнёров А/Б на карте пары (14% покрытия).
// Использует useViewport() — нужен ReactFlowProvider, полноценный <ReactFlow>
// не требуется. Проверяем: дефолтные имена, переименование партнёра
// (сохраняется в localStorage конкретной карты), Enter/Escape, пустой ввод
// восстанавливает дефолт, независимость localStorage разных карт.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { ModeMapCoupleLanes } from './ModeMapCoupleLanes';
import { installFlowTestPolyfills } from '../test-support/renderWithFlow';

beforeEach(() => {
  installFlowTestPolyfills();
  localStorage.clear();
});
afterEach(() => cleanup());

function renderLanes(mapId = 1) {
  return render(
    <ReactFlowProvider>
      <ModeMapCoupleLanes mapId={mapId} />
    </ReactFlowProvider>,
  );
}

describe('ModeMapCoupleLanes — имена по умолчанию', () => {
  it('без сохранённых имён показывает «Партнёр А» и «Партнёр Б»', () => {
    renderLanes();
    expect(screen.getByText('Партнёр А')).toBeTruthy();
    expect(screen.getByText('Партнёр Б')).toBeTruthy();
  });

  it('битый JSON в localStorage не роняет рендер — используются дефолты', () => {
    localStorage.setItem('modemap_couple_1', '{не json');
    expect(() => renderLanes(1)).not.toThrow();
    expect(screen.getByText('Партнёр А')).toBeTruthy();
  });
});

describe('ModeMapCoupleLanes — переименование партнёра', () => {
  it('клик по имени открывает поле, Enter коммитит и сохраняет в localStorage', () => {
    renderLanes(1);
    fireEvent.click(screen.getByText('Партнёр А'));
    const input = screen.getByDisplayValue('Партнёр А') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Аня' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('Аня')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('modemap_couple_1')!)).toMatchObject(
      { a: 'Аня' },
    );
  });

  it('пустое имя после blur восстанавливает дефолт «Партнёр Б»', () => {
    renderLanes(1);
    fireEvent.click(screen.getByText('Партнёр Б'));
    const input = screen.getByDisplayValue('Партнёр Б') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(screen.getByText('Партнёр Б')).toBeTruthy();
  });

  it('Escape закрывает поле ввода без сохранения', () => {
    renderLanes(1);
    fireEvent.click(screen.getByText('Партнёр А'));
    const input = screen.getByDisplayValue('Партнёр А') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'мусор' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByDisplayValue('мусор')).toBeNull();
    expect(screen.getByText('Партнёр А')).toBeTruthy();
  });
});

describe('ModeMapCoupleLanes — имена привязаны к конкретной карте', () => {
  it('сохранённое имя на карте 1 не подсвечивается на карте 2', () => {
    renderLanes(1);
    fireEvent.click(screen.getByText('Партнёр А'));
    fireEvent.change(screen.getByDisplayValue('Партнёр А'), {
      target: { value: 'Аня' },
    });
    fireEvent.keyDown(screen.getByDisplayValue('Аня'), { key: 'Enter' });
    cleanup();
    renderLanes(2);
    expect(screen.getByText('Партнёр А')).toBeTruthy();
    expect(screen.queryByText('Аня')).toBeNull();
  });

  it('сохранённое имя на своей карте восстанавливается при повторном монтировании', () => {
    renderLanes(3);
    fireEvent.click(screen.getByText('Партнёр Б'));
    fireEvent.change(screen.getByDisplayValue('Партнёр Б'), {
      target: { value: 'Боря' },
    });
    fireEvent.keyDown(screen.getByDisplayValue('Боря'), { key: 'Enter' });
    cleanup();
    renderLanes(3);
    expect(screen.getByText('Боря')).toBeTruthy();
  });
});
