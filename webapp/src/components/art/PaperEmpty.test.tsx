// @vitest-environment jsdom
// Пустое состояние единого стиля: три места (планы, карта режимов, «Записи»)
// писали .pp-empty + <Cup /> руками ради заголовка над текстом — теперь слот title.
// Слот art — знак сущности вместо чашки (пустые вкладки карточки клиента, PAPER_2026-11).
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { PaperEmpty } from './PaperEmpty';
import { Cluster } from './PaperArtSigns';
import { paperSignName } from '../../test-support/paperSign';

afterEach(cleanup);

const texts = (root: HTMLElement) => [...root.querySelectorAll('p')].map((p) => `${p.className}: ${p.textContent}`);

describe('PaperEmpty', () => {
  it('без заголовка — чашка и один абзац ds-empty', () => {
    const { container } = render(<PaperEmpty>Пока пусто</PaperEmpty>);
    expect(container.querySelector('.pp-empty svg[aria-hidden="true"]')).toBeTruthy();
    expect(paperSignName(container.querySelector('.pp-empty svg'))).toBe('Cup');
    expect(container.querySelector('.pp-empty--sign')).toBeNull();
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

  it('art — знак сущности вместо чашки, размер пустого состояния, текст на месте', () => {
    const { container } = render(<PaperEmpty art={Cluster} title="Карта пуста">Перетащи режим на холст</PaperEmpty>);
    const svg = container.querySelector('.pp-empty.pp-empty--sign > svg');
    expect(paperSignName(svg)).toBe('Cluster');
    expect(svg?.getAttribute('class')).toBe('pp-art pp-art--empty');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(texts(container)).toEqual(['ds-list-title: Карта пуста', 'ds-empty: Перетащи режим на холст']);
  });
});
