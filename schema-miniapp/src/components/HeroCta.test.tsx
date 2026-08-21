// @vitest-environment jsdom
// HeroCta — общая крупная CTA-карточка («Сегодня», «Паттерны», «Режимы»).
// Регрессия nested-interactive (axe, 2026-08): карточка была div[role="button"]
// с настоящей <button> внутри — два интерактивных элемента вложенно, второй
// таб-стоп не имел собственного смысла. Тест фиксирует структуру (ровно
// один role="button" во всём дереве) и то, что клик по-прежнему работает
// из любой точки карточки — и по кнопке, и мимо неё.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HeroCta } from './HeroCta';

afterEach(cleanup);

function renderCta(onClick = vi.fn()) {
  const utils = render(
    <HeroCta
      label="Одно дело на сегодня"
      chip="≈1 мин"
      title="Заполнить трекер потребностей"
      sub="Пять оценок — и виден индекс дня"
      buttonLabel="Начать"
      onClick={onClick}
    />,
  );
  return { ...utils, onClick };
}

describe('HeroCta', () => {
  it('во всём дереве ровно один role="button" (nested-interactive)', () => {
    renderCta();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('accessible-имя кнопки включает заголовок карточки, не только глагол', () => {
    renderCta();
    // aria-command-name/WCAG 2.5.3: видимый текст кнопки — короткое
    // «Начать», но вне контекста карточки это неотличимо от такой же
    // кнопки на другом экране. aria-label добавляет заголовок.
    expect(
      screen.getByRole('button', {
        name: /Заполнить трекер потребностей.*Начать/,
      }),
    ).toBeTruthy();
  });

  it('клик по кнопке зовёт onClick ровно один раз (не дублируется всплытием)', () => {
    const { onClick } = renderCta();
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('клик мимо кнопки (по заголовку карточки) тоже зовёт onClick', () => {
    const { onClick } = renderCta();
    fireEvent.click(screen.getByText('Заполнить трекер потребностей'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
