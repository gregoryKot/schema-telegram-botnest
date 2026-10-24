// @vitest-environment jsdom
// JourneyDetailPane: ветка «открыта запись» экрана «Мой путь» — раньше была
// дословным дублем в обоих JourneySheet (jscpd, правило №11). Тест фиксирует
// поведение общего компонента: пусто без записи, детальный вид + кнопка
// удаления для удаляемого типа, onShare получает текущий item.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { JourneyDetailPane } from './JourneyDetailPane';
import type { JourneyDetailState } from './JourneyItemDetail';
import type { JourneyDeleteState } from './journeyDelete';
import type { JourneyItem } from './journeyMeta';

afterEach(cleanup);

const tr = (ty: string) => ty;
const subtitle = () => null;

function makeDetail(item: JourneyItem | null): JourneyDetailState {
  return {
    item,
    parts: [],
    loading: false,
    open: vi.fn(),
    close: vi.fn(),
  };
}

function makeDel(
  overrides: Partial<JourneyDeleteState> = {},
): JourneyDeleteState {
  return { busy: false, failed: false, remove: vi.fn(), ...overrides };
}

describe('JourneyDetailPane', () => {
  it('без открытой записи не рендерит ничего', () => {
    const { container } = render(
      <JourneyDetailPane
        detail={makeDetail(null)}
        subtitle={subtitle}
        tr={tr}
        onShare={vi.fn()}
        del={makeDel()}
      />,
    );
    expect(container.textContent).toBe('');
  });

  it('рендерит детальный просмотр и кнопку удаления для удаляемого типа', () => {
    const item: JourneyItem = { type: 'letter', at: '2026-07-20', id: 5 };
    render(
      <JourneyDetailPane
        detail={makeDetail(item)}
        subtitle={subtitle}
        tr={tr}
        onShare={vi.fn()}
        del={makeDel()}
      />,
    );
    expect(screen.getByText('Поделиться карточкой')).not.toBeNull();
    expect(screen.getByText('Удалить запись')).not.toBeNull();
  });

  it('не рендерит кнопку удаления для неудаляемого типа', () => {
    const item: JourneyItem = { type: 'gratitude', at: '2026-07-20', id: 1 };
    render(
      <JourneyDetailPane
        detail={makeDetail(item)}
        subtitle={subtitle}
        tr={tr}
        onShare={vi.fn()}
        del={makeDel()}
      />,
    );
    expect(screen.queryByText('Удалить запись')).toBeNull();
  });

  it('клик по «Поделиться карточкой» зовёт onShare с текущим item', () => {
    const item: JourneyItem = { type: 'letter', at: '2026-07-20', id: 5 };
    const onShare = vi.fn();
    render(
      <JourneyDetailPane
        detail={makeDetail(item)}
        subtitle={subtitle}
        tr={tr}
        onShare={onShare}
        del={makeDel()}
      />,
    );
    fireEvent.click(screen.getByText('Поделиться карточкой'));
    expect(onShare).toHaveBeenCalledWith(item);
  });
});
