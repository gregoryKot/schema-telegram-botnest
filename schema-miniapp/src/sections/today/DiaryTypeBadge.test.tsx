// @vitest-environment jsdom
// Значок типа записи дневника на экране трекера (CLAUDE.md — приоритет
// покрытия «экраны трекера»). Поведение: известные типы — короткая метка и
// свой цвет; неизвестный тип — фолбэк на первые буквы, не падает.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DiaryTypeBadge } from './DiaryTypeBadge';

afterEach(() => {
  cleanup();
});

describe('DiaryTypeBadge', () => {
  it('schema — метка «Сх»', () => {
    render(<DiaryTypeBadge type="schema" />);
    expect(screen.getByText('Сх')).toBeTruthy();
  });

  it('mode — метка «Рж»', () => {
    render(<DiaryTypeBadge type="mode" />);
    expect(screen.getByText('Рж')).toBeTruthy();
  });

  it('gratitude — метка «Бл»', () => {
    render(<DiaryTypeBadge type="gratitude" />);
    expect(screen.getByText('Бл')).toBeTruthy();
  });

  it('неизвестный тип — фолбэк на первые две буквы, не падает', () => {
    render(<DiaryTypeBadge type="custom" />);
    expect(screen.getByText('cu')).toBeTruthy();
  });
});
