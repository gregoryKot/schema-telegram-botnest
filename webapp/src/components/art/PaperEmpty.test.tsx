// @vitest-environment jsdom
// Пустое состояние единого стиля: три места (планы, карта режимов, «Записи»)
// писали .pp-empty + <Cup /> руками ради заголовка над текстом — теперь слот title.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PaperEmpty } from './PaperEmpty';

afterEach(cleanup);

const texts = (root: HTMLElement) => [...root.querySelectorAll('p')].map((p) => `${p.className}: ${p.textContent}`);

describe('PaperEmpty', () => {
  it('без заголовка — чашка и один абзац ds-empty', () => {
    const { container } = render(<PaperEmpty>Пока пусто</PaperEmpty>);
    expect(container.querySelector('.pp-empty svg[aria-hidden="true"]')).toBeTruthy();
    expect(texts(container)).toEqual(['ds-empty: Пока пусто']);
  });

  it('заголовок и абзац: ds-list-title над ds-empty', () => {
    const { container } = render(<PaperEmpty title="Планов пока нет">Запланируй действие ниже.</PaperEmpty>);
    expect(texts(container)).toEqual(['ds-list-title: Планов пока нет', 'ds-empty: Запланируй действие ниже.']);
  });

  it('только заголовок — пустого абзаца нет', () => {
    const { container } = render(<PaperEmpty title="Пока ни одной записи" />);
    expect(texts(container)).toEqual(['ds-list-title: Пока ни одной записи']);
  });
});
