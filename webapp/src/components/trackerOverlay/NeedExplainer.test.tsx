// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NeedExplainer } from './NeedExplainer';
import type { NeedExtra } from '../../../../shared/src/needs/types';

const data = {
  desc: 'Рядом есть надёжные люди.',
  examples: ['Кто-то обнял', 'Был разговор, где услышали', 'Третий пример, который не показываем'],
} as unknown as NeedExtra;

afterEach(cleanup);

describe('NeedExplainer', () => {
  it('описание потребности всегда на экране, примеров не больше двух', () => {
    render(<NeedExplainer data={data} expanded />);
    expect(screen.getByText('Рядом есть надёжные люди.')).toBeTruthy();
    expect(screen.getByText('Кто-то обнял')).toBeTruthy();
    expect(screen.getByText('Был разговор, где услышали')).toBeTruthy();
    expect(screen.queryByText('Третий пример, который не показываем')).toBeNull();
  });

  it('пока потребность не оценивали — примеры раскрыты, после — свёрнуты в «Например»', () => {
    const { container, rerender } = render(<NeedExplainer data={data} expanded />);
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(true);
    rerender(<NeedExplainer data={data} expanded={false} />);
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(false);
    expect(screen.getByText('Например')).toBeTruthy();
  });

  it('без контента ничего не рисует', () => {
    const { container } = render(<NeedExplainer data={undefined} expanded />);
    expect(container.innerHTML).toBe('');
  });
});
