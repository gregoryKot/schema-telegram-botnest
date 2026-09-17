// @vitest-environment jsdom
// MobileLayout — мобильная раскладка трекера потребности (0% покрытия, 147
// непокрытых строк). Чистое представление (top-bar/footer/детали приходят
// снаружи как ReactNode) — проверяем, что нужный контент из needName/extra
// действительно доезжает до экрана, включая пустые/отсутствующие поля.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MobileLayout } from './MobileLayout';
import type { Need } from '../../types';

afterEach(() => {
  cleanup();
});

const NEED: Need = { id: 'attachment', emoji: '🤝', title: 'Привязанность', chartLabel: 'Привяз.' };

function renderLayout(overrides: Partial<Parameters<typeof MobileLayout>[0]> = {}) {
  const setDetailNeed = vi.fn();
  const handleChange = vi.fn();
  const props = {
    need: NEED,
    color: '#f472b6',
    value: 5,
    needName: 'Привязанность',
    extra: { subtitle: 'Связь и доверие', desc: 'Описание потребности', question: 'Чувствовал ли ты сегодня близость?', examples: ['Позвонил другу', 'Обнял близкого'] } as never,
    idx: 0,
    needsLength: 5,
    handleChange,
    setDetailNeed,
    onTS: vi.fn(),
    onTE: vi.fn(),
    topbar: <div>Топбар</div>,
    footer: <div>Футер</div>,
    steps: <div>Шаги</div>,
    detailSheet: null,
    ...overrides,
  };
  const utils = render(<MobileLayout {...props} />);
  return { ...utils, setDetailNeed, handleChange };
}

describe('MobileLayout — контент из needData', () => {
  it('рендерит название потребности, подзаголовок, описание и вопрос дня', () => {
    renderLayout();
    expect(screen.getByText('Привязанность')).toBeTruthy();
    expect(screen.getByText('Связь и доверие')).toBeTruthy();
    expect(screen.getByText('Описание потребности')).toBeTruthy();
    expect(screen.getByText('Чувствовал ли ты сегодня близость?')).toBeTruthy();
  });

  it('рендерит примеры «что считается» пронумерованным списком', () => {
    renderLayout();
    expect(screen.getByText('Позвонил другу')).toBeTruthy();
    expect(screen.getByText('Обнял близкого')).toBeTruthy();
    expect(screen.getByText('1.')).toBeTruthy();
    expect(screen.getByText('2.')).toBeTruthy();
  });

  it('без extra (undefined) не падает — пустые subtitle/question, пустой список примеров', () => {
    expect(() => renderLayout({ extra: undefined })).not.toThrow();
    expect(screen.queryByText('Описание потребности')).toBeNull();
  });

  it('передаёт слоты topbar/footer/steps как есть', () => {
    renderLayout();
    expect(screen.getByText('Топбар')).toBeTruthy();
    expect(screen.getByText('Футер')).toBeTruthy();
    expect(screen.getByText('Шаги')).toBeTruthy();
  });
});

describe('MobileLayout — взаимодействие', () => {
  it('клик по заголовку открывает детали потребности (setDetailNeed)', () => {
    const { setDetailNeed } = renderLayout();
    fireEvent.click(screen.getByText('Привязанность'));
    expect(setDetailNeed).toHaveBeenCalledWith(NEED);
  });

  it('свайп-хендлеры touchstart/touchend прокидываются на корневой контейнер', () => {
    const onTS = vi.fn();
    const onTE = vi.fn();
    const { container } = renderLayout({ onTS, onTE });
    const root = container.firstChild as HTMLElement;
    fireEvent.touchStart(root);
    fireEvent.touchEnd(root);
    expect(onTS).toHaveBeenCalled();
    expect(onTE).toHaveBeenCalled();
  });
});
