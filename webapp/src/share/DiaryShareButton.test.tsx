// @vitest-environment jsdom
// DiaryShareButton (webapp) — шеринг сводки дневника (DiarySection.tsx),
// паритет с schema-miniapp/src/share/DiaryShareButton.tsx (правило №16).
// Ключевой инвариант: на пустом дневнике (0 записей) кнопки нет вовсе.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DiaryShareButton } from './DiaryShareButton';

afterEach(cleanup);

function renderButton(entries: Array<{ createdAt: string }>) {
  return render(
    <MemoryRouter>
      <DiaryShareButton emoji="📓" title="Дневник схем" color="var(--c-rose)" entries={entries} />
    </MemoryRouter>,
  );
}

describe('DiaryShareButton (webapp) — пустой дневник', () => {
  it('0 записей — кнопки нет вовсе', () => {
    const { container } = renderButton([]);
    expect(container.firstChild).toBeNull();
  });
});

describe('DiaryShareButton (webapp) — есть записи', () => {
  it('кнопка видна, клик открывает ShareCardSheet с правильным заголовком', () => {
    renderButton([{ createdAt: '2026-08-01T00:00:00.000Z' }]);
    fireEvent.click(screen.getByLabelText('Поделиться дневником'));
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
    expect(screen.getAllByText('Поделиться дневником').length).toBeGreaterThan(0);
  });

  it('клик по фону шита закрывает его, не оставляя карточку открытой', () => {
    renderButton([{ createdAt: '2026-08-01T00:00:00.000Z' }]);
    fireEvent.click(screen.getByLabelText('Поделиться дневником'));
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('presentation')[0]);
    expect(screen.queryByText('Картинка уйдёт вместе со ссылкой')).toBeNull();
  });
});
