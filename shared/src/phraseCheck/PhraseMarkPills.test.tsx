// @vitest-environment jsdom
// Пилюли с приметами критика (webapp ↔ miniapp, правило №3).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PhraseMarkPills } from './PhraseMarkPills';

afterEach(() => {
  cleanup();
});

describe('PhraseMarkPills', () => {
  it('пустой список — ничего не рендерит', () => {
    const { container } = render(<PhraseMarkPills labels={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('рендерит по пилюле на каждую подпись', () => {
    render(<PhraseMarkPills labels={['Цель', 'Ярлык']} />);
    expect(screen.getByText('Цель')).toBeTruthy();
    expect(screen.getByText('Ярлык')).toBeTruthy();
  });
});
