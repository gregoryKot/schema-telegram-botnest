// @vitest-environment jsdom
// Пустой архив дневника — объяснение «что это и зачем» для новичка (правило
// онбординга CLAUDE.md). Проверяем ветвление по фильтру и отсутствие
// «ты»-форм в «вы»-режиме (парный тест мини-аппа — DiaryEmptyExplainer там).
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { AddressFormContext, type AddressForm } from '../../utils/addressForm';
import { hasTyForms } from '../../../../shared/src/utils/tyFormsSweep';
import { DiaryEmptyExplainer } from './DiaryEmptyExplainer';
import type { DiaryFilter } from '../../sections/diary/diaryModel';

function renderWithForm(ui: ReactElement, form: AddressForm) {
  return render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      {ui}
    </AddressFormContext.Provider>,
  );
}

afterEach(cleanup);

// Абзацы склеены при отрисовке (glue: неразрывные пробел и дефис, ревью g3 r2) — текст сверяем без них.
const plain = (el: Element) => (el.textContent ?? '').replace(/\u2011/g, '-').replace(/\s+/g, ' ');

describe('DiaryEmptyExplainer (webapp) — пустой архив объясняет «зачем»', () => {
  it('сегмент «Все»: общий зачин и карточки схем и режимов', () => {
    const { container } = renderWithForm(
      <DiaryEmptyExplainer filter="all" />,
      'ty',
    );
    const text = plain(container);
    expect(text).toContain('Пока ни одной записи');
    expect(text).toContain('главный инструмент схема-терапии');
    expect(text).toContain('Схема —'); // что такое схема
    expect(text).toContain('Режим —'); // что такое режим
    expect(text).toContain('3–5 записей'); // результат и срок
  });

  it('сегмент «Дневник»: карточки схем и режимов, честное «записей пока нет», кнопка «Записать»', () => {
    const { container } = renderWithForm(<DiaryEmptyExplainer filter="diary" />, 'ty');
    const text = plain(container);
    expect(text).toContain('Записей дневника пока нет');
    expect(text).toContain('Схема —');
    expect(text).toContain('Режим —');
    expect(text).toContain('кнопка «Записать» выше');
  });

  it('сегмент «Трекер»: про трекер, без карточек дневников, первая отметка — на главной', () => {
    const { container } = renderWithForm(<DiaryEmptyExplainer filter="tracker" />, 'ty');
    const text = plain(container);
    expect(text).toContain('Отметок трекера пока нет');
    expect(text).toContain('Трекер — пять коротких вопросов');
    expect(text).toContain('плитка «Трекер» на главной');
    expect(text).not.toContain('Схема —');
    expect(text).not.toContain('Режим —');
  });

  it('форма «вы»: без «ты»-форм во всех фильтрах', () => {
    for (const filter of ['all', 'diary', 'tracker'] as const) {
      const { container, unmount } = renderWithForm(
        <DiaryEmptyExplainer filter={filter} />,
        'vy',
      );
      expect(hasTyForms(container.textContent ?? '')).toBe(false);
      unmount();
    }
  });
});

// Вид (b11): сцена «первая страница» — у всей ленты и у пустого «Дневника», лист своей сущности со знаком —
// у пустых «Трекера» и «Случаев»; «Схема» и «Режим» — только там, где речь о дневнике.
const view = (filter: DiaryFilter) => render(<DiaryEmptyExplainer filter={filter} />).container;
/** Камешки по месту (тень-вырезка Lift повторяет лёгший камешек — считаем места, а не фигуры). */
const spots = (el: Element, laid: 'yes' | 'no') => new Set([...el.querySelectorAll(`.cd-empty-scene [data-laid="${laid}"]`)].map((p) => p.getAttribute('cx'))).size;

describe('DiaryEmptyExplainer — вид (b11)', () => {
  // Ревью g3: «ничего нет» ≠ «Записано» — на листе пусто, все три камешка ждут рядом (на «Записано» один ляжет).
  it.each(['all', 'diary'] as const)('%s — сцена «первая страница»: чистый лист, три камешка ждут; плитки «Схема» и «Режим»', (f) => {
    const el = view(f);
    expect(spots(el, 'yes')).toBe(0);
    expect(spots(el, 'no')).toBe(3);
    expect([...el.querySelectorAll('.cd-explainer-name')].map((n) => n.textContent)).toEqual(['Схема', 'Режим']);
    expect(el.querySelector('.cd-empty-scene')?.getAttribute('aria-hidden')).toBe('true');
  });

  it.each([['tracker', 'strokes', 'Отметок трекера пока нет'], ['case', 'ribbon', 'Разборов пока нет']] as const)(
    '%s — лист своей сущности со знаком %s, без сцены и без плиток дневника', (f, sign, title) => {
      const el = view(f);
      expect(el.querySelector('.pa-sheet')?.getAttribute('data-sign')).toBe(sign);
      expect(el.querySelector('.pa-sheet-title')?.textContent).toBe(title);
      expect(el.querySelector('.cd-empty-scene')).toBeNull();
      expect(el.querySelector('.cd-explainers')).toBeNull();
    });

  it('подпись новичку — только у всей ленты, у пустого «Дневника» её нет (как раньше)', () => {
    expect(view('all').querySelector('.cd-empty-sub')).not.toBeNull();
    expect(view('diary').querySelector('.cd-empty-sub')).toBeNull();
  });
});
