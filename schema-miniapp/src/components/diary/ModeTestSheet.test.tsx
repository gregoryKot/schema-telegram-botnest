// @vitest-environment jsdom
// ModeTestSheet — тест «какой режим включился», 2 уровня (0% покрытия).
// Проверяет: уровень 1 → выбор группы → уровень 2 (детализация группы),
// «← назад» возвращает на уровень 1 (сброс groupId, не памяти выбора),
// выбор конкретного режима шлёт аналитику И зовёт onResolve с modeId —
// пропуск любого из двух — либо тихий провал метрики, либо сломанный флоу.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeTestSheet } from './ModeTestSheet';
import { MODE_PICKER_GROUPS } from '../../../../shared/src/mode/modeBodyCues';
import { MODE_TEST_COMPLETED_EVENT } from '../../../../shared/src/share/analytics';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
import { api } from '../../api';
const mockApi = api as unknown as { trackEvent: ReturnType<typeof vi.fn> };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const firstGroup = MODE_PICKER_GROUPS[0];
const firstLeaf = firstGroup.leaves[0];

describe('ModeTestSheet — уровень 1 (группы)', () => {
  it('показывает все группы теста', () => {
    render(<ModeTestSheet onResolve={vi.fn()} onClose={vi.fn()} />);
    for (const g of MODE_PICKER_GROUPS) {
      expect(screen.getByText(g.title)).toBeTruthy();
    }
  });

  it('клик по группе переходит на уровень 2 (заголовок группы + «Что ближе всего?»)', () => {
    render(<ModeTestSheet onResolve={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText(firstGroup.title));
    expect(screen.getByText('Что ближе всего?')).toBeTruthy();
    expect(screen.getByText(firstLeaf.label)).toBeTruthy();
  });

  it('клик по фону (закрыть) зовёт onClose', () => {
    const onClose = vi.fn();
    render(<ModeTestSheet onResolve={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ModeTestSheet — уровень 2 (детализация группы)', () => {
  it('«← назад» возвращает на уровень 1', () => {
    render(<ModeTestSheet onResolve={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText(firstGroup.title));
    fireEvent.click(screen.getByText(/назад/));
    // Снова видим список всех групп.
    for (const g of MODE_PICKER_GROUPS) {
      expect(screen.getByText(g.title)).toBeTruthy();
    }
  });

  it('выбор конкретного режима шлёт аналитику modeId', () => {
    render(<ModeTestSheet onResolve={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText(firstGroup.title));
    fireEvent.click(screen.getByText(firstLeaf.label));
    expect(mockApi.trackEvent).toHaveBeenCalledWith(MODE_TEST_COMPLETED_EVENT, {
      modeId: firstLeaf.modeId,
    });
  });

  it('выбор конкретного режима зовёт onResolve с правильным modeId', () => {
    const onResolve = vi.fn();
    render(<ModeTestSheet onResolve={onResolve} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText(firstGroup.title));
    fireEvent.click(screen.getByText(firstLeaf.label));
    expect(onResolve).toHaveBeenCalledWith(firstLeaf.modeId);
  });

  it('клик по фону на уровне 2 тоже закрывает лист целиком (onClose)', () => {
    const onClose = vi.fn();
    render(<ModeTestSheet onResolve={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText(firstGroup.title));
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalled();
  });

  it('клик внутри карточки (stopPropagation) не закрывает лист', () => {
    const onClose = vi.fn();
    render(<ModeTestSheet onResolve={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText(firstGroup.title));
    fireEvent.click(screen.getByText('Что ближе всего?'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
