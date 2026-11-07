// @vitest-environment jsdom
// Тексты подсказок — отдельный чанк (#995): грузятся один раз, компонент
// получает их после загрузки, а смонтированный позже — сразу, без «грузится».
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const evaluated = vi.hoisted(() => ({ n: 0 }));
vi.mock('../../schemaTherapy/guide', () => {
  evaluated.n += 1;
  return { modeGuide: () => null, marker: 'тексты' };
});

import { loadGuide, useGuide } from './guideLoader';

function Probe() {
  const g = useGuide() as unknown as { marker: string } | null | undefined;
  return <div>{g === undefined ? 'грузится' : (g?.marker ?? 'нет')}</div>;
}

describe('guideLoader', () => {
  it('сначала «грузится», затем модуль; второй вызов — тот же промис', async () => {
    render(<Probe />);
    expect(screen.getByText('грузится')).toBeTruthy();
    expect(await screen.findByText('тексты')).toBeTruthy();
    expect(loadGuide()).toBe(loadGuide());
    expect(evaluated.n).toBe(1);
  });

  it('уже загруженные тексты отдаются с первого рендера', async () => {
    await loadGuide();
    render(<Probe />);
    expect(screen.getByText('тексты')).toBeTruthy();
  });
});
