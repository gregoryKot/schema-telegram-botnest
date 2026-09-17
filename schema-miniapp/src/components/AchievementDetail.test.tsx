// @vitest-environment jsdom
// AchievementDetail — оверлей достижения (0% покрытия). Клик по карточке не
// закрывает (stopPropagation), клик по фону закрывает, «Поделиться» открывает
// ShareCardSheet. drawAchievementCard мокаем (canvas 2D недоступен в jsdom).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AchievementDetail } from './AchievementDetail';

vi.mock('../../../shared/src/share/cards/achievementCard', async () => {
  const actual = await vi.importActual<
    typeof import('../../../shared/src/share/cards/achievementCard')
  >('../../../shared/src/share/cards/achievementCard');
  return { ...actual, drawAchievementCard: vi.fn() };
});
vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));

const meta = { title: 'Первая неделя', desc: 'Семь дней подряд' };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AchievementDetail — контент и закрытие', () => {
  it('показывает заголовок/описание достижения', () => {
    render(<AchievementDetail meta={meta} onClose={() => {}} />);
    expect(screen.getByText('Первая неделя')).toBeTruthy();
    expect(screen.getByText('Семь дней подряд')).toBeTruthy();
  });

  it('клик по фону зовёт onClose', () => {
    const onClose = vi.fn();
    const { container } = render(
      <AchievementDetail meta={meta} onClose={onClose} />,
    );
    // Внешний контейнер (фон) — первый узел; у карточки внутри тот же
    // role="presentation", поэтому берём его напрямую, а не через closest().
    fireEvent.click(container.firstElementChild!);
    expect(onClose).toHaveBeenCalled();
  });

  it('клик по карточке НЕ закрывает (stopPropagation)', () => {
    const onClose = vi.fn();
    render(<AchievementDetail meta={meta} onClose={onClose} />);
    fireEvent.click(screen.getByText('Первая неделя'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('AchievementDetail — «Поделиться»', () => {
  it('открывает ShareCardSheet с заголовком «Достижение»', () => {
    render(<AchievementDetail meta={meta} onClose={() => {}} />);
    expect(screen.queryByText('Достижение')).toBeNull();
    fireEvent.click(screen.getByText('Поделиться'));
    expect(screen.getByText('Достижение')).toBeTruthy();
  });
});
