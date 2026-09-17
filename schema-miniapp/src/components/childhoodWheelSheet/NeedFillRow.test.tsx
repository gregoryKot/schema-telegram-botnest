// @vitest-environment jsdom
// NeedFillRow — строка оценки одной потребности в колесе детства (0%
// покрытия). Проверяем: подсветку якорей на краях шкалы (низкое/высокое
// значение), клик по «?» открывает/закрывает примеры, клик по конкретному
// примеру раскрывает его текст.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NeedFillRow } from './NeedFillRow';
import type { NeedMetaEntry } from './types';

afterEach(cleanup);

const META: NeedMetaEntry = {
  label: 'Привязанность',
  question: 'Насколько тебя принимали таким, какой ты есть?',
  anchorLow: 'Часто чувствовал себя лишним',
  anchorHigh: 'Всегда знал, что меня любят',
  examples: [
    { score: 2, text: 'Пример низкого балла — текст раскрывается по клику' },
    { score: 9, text: 'Пример высокого балла — тоже раскрывается' },
  ],
};

function setup(
  value: number,
  overrides: Partial<Parameters<typeof NeedFillRow>[0]> = {},
) {
  const onChange = vi.fn();
  const setOpenExampleId = vi.fn();
  const setOpenExampleIdx = vi.fn();
  const utils = render(
    <NeedFillRow
      id="attachment"
      meta={META}
      value={value}
      onChange={onChange}
      openExampleId={null}
      setOpenExampleId={setOpenExampleId}
      openExampleIdx={null}
      setOpenExampleIdx={setOpenExampleIdx}
      {...overrides}
    />,
  );
  return { onChange, setOpenExampleId, setOpenExampleIdx, ...utils };
}

describe('NeedFillRow — якоря шкалы', () => {
  it('низкий балл (≤4) подсвечивает якорь дефицита текстом самого якоря', () => {
    setup(2);
    expect(screen.getByText(META.anchorLow)).toBeTruthy();
    expect(screen.getByText('0 — дефицит')).toBeTruthy();
  });

  it('высокий балл (≥8) показывает якорь насыщения тем же текстом', () => {
    setup(9);
    expect(screen.getByText(META.anchorHigh)).toBeTruthy();
    expect(screen.getByText('10 — насыщение')).toBeTruthy();
  });

  it('текущее значение отображается рядом со шкалой /10', () => {
    setup(7);
    expect(screen.getByText('7')).toBeTruthy();
  });
});

describe('NeedFillRow — примеры по клику на «?»', () => {
  it('клик по «?» вызывает переключение открытого примера для своей потребности', () => {
    const { setOpenExampleId, setOpenExampleIdx } = setup(5);
    fireEvent.click(screen.getByRole('button', { name: '?' }));
    expect(setOpenExampleId).toHaveBeenCalledWith('attachment');
    expect(setOpenExampleIdx).toHaveBeenCalledWith(null);
  });

  it('когда примеры открыты — виден заголовок блока и оба примера по баллу', () => {
    setup(5, { openExampleId: 'attachment' });
    expect(screen.getByText('Примеры — как это выглядит в жизни')).toBeTruthy();
    expect(screen.getByText('≈2/10')).toBeTruthy();
    expect(screen.getByText('≈9/10')).toBeTruthy();
  });

  it('клик по примеру раскрывает его текст, повторный клик по открытому — сворачивает индекс', () => {
    const { setOpenExampleIdx } = setup(5, { openExampleId: 'attachment' });
    fireEvent.click(screen.getByText('≈2/10'));
    expect(setOpenExampleIdx).toHaveBeenCalledWith(0);
  });

  it('открытый по индексу пример показывает свой текст, второй клик по нему сворачивает (idx→null)', () => {
    const { setOpenExampleIdx } = setup(5, {
      openExampleId: 'attachment',
      openExampleIdx: 0,
    });
    expect(
      screen.getByText('Пример низкого балла — текст раскрывается по клику'),
    ).toBeTruthy();
    fireEvent.click(screen.getByText('≈2/10'));
    expect(setOpenExampleIdx).toHaveBeenCalledWith(null);
  });
});
