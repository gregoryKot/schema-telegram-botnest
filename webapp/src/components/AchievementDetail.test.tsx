// @vitest-environment jsdom
// AchievementDetail — оверлей достижения (0% покрытия). draw() рисует на
// canvas внутри useShareCard, обёрнут там в try/catch — canvas можно не
// мокать. Проверяем контент, закрытие по фону/не-закрытие по карточке
// (stopPropagation) и открытие шита «Поделиться».
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AchievementDetail } from './AchievementDetail';
import type { AchievementMeta } from '../../../shared/src/share/cards/achievementCard';

afterEach(() => {
  cleanup();
});

const META: AchievementMeta = { emoji: '🏅', title: 'Неделя подряд', desc: 'Семь дней без пропусков' };

function renderDetail(onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <AchievementDetail meta={META} onClose={onClose} />
    </MemoryRouter>,
  );
}

describe('AchievementDetail — контент', () => {
  it('рендерит эмодзи, заголовок и описание достижения', () => {
    renderDetail();
    expect(screen.getByText('🏅')).toBeTruthy();
    expect(screen.getByText('Неделя подряд')).toBeTruthy();
    expect(screen.getByText('Семь дней без пропусков')).toBeTruthy();
  });
});

describe('AchievementDetail — закрытие', () => {
  it('клик по затемнённому фону зовёт onClose (goBack — родитель размонтирует оверлей)', () => {
    const onClose = vi.fn();
    renderDetail(onClose);
    fireEvent.click(screen.getAllByRole('presentation')[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('клик по самой карточке НЕ вызывает onClose (stopPropagation)', () => {
    const onClose = vi.fn();
    renderDetail(onClose);
    fireEvent.click(screen.getByText('Неделя подряд'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('AchievementDetail — «Поделиться»', () => {
  it('клик открывает ShareCardSheet с заголовком «Достижение»', () => {
    renderDetail();
    fireEvent.click(screen.getByText('Поделиться'));
    expect(screen.getByText('Достижение')).toBeTruthy();
  });
});
