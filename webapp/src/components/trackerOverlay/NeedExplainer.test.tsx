// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { NeedExplainer } from './NeedExplainer';
import type { NeedExtra } from '../../../../shared/src/needs/types';

const data = {
  desc: 'Рядом есть надёжные люди.',
  examples: ['Кто-то обнял', 'Был разговор, где услышали', 'Третий пример, который не показываем'],
} as unknown as NeedExtra;

afterEach(cleanup);

describe('NeedExplainer', () => {
  it('описание потребности всегда на экране, примеров не больше двух', () => {
    render(<NeedExplainer data={data} />);
    expect(screen.getByText('Рядом есть надёжные люди.')).toBeTruthy();
    expect(screen.getByText('Кто-то обнял')).toBeTruthy();
    expect(screen.getByText('Был разговор, где услышали')).toBeTruthy();
    expect(screen.queryByText('Третий пример, который не показываем')).toBeNull();
  });

  // QA мобильной версии 2026-11, З5: раскрытые сразу примеры на 390×664 и 360×640
  // сталкивали все пять ответов за край экрана — даже у новичка они свёрнуты.
  it('примеры свёрнуты в «Например» и раскрываются по тапу', () => {
    const { container } = render(<NeedExplainer data={data} />);
    const details = container.querySelector('details');
    expect(details?.open).toBe(false);
    fireEvent.click(screen.getByText('Например'));
    expect(details?.open).toBe(true);
  });

  it('без контента ничего не рисует', () => {
    const { container } = render(<NeedExplainer data={undefined} />);
    expect(container.innerHTML).toBe('');
  });
});
