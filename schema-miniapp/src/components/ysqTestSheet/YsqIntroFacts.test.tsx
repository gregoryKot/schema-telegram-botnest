// @vitest-environment jsdom
// Первый экран YSQ: подпись «Оцени каждое от 1 до 6» — обращение к
// пользователю и обязана следовать его форме (ты/вы). Раньше стояла
// захардкоженной «ты»-строкой (свип 2026-10).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { AddressFormContext } from '../../utils/addressForm';
import { YsqIntroFacts } from './YsqIntroFacts';

afterEach(() => {
  cleanup();
});

describe('YsqIntroFacts', () => {
  it('по умолчанию («ты») просит «Оцени каждое…»', () => {
    render(<YsqIntroFacts />);
    expect(screen.getByText('Оцени каждое от 1 до 6')).toBeTruthy();
    expect(screen.queryByText('Оцените каждое от 1 до 6')).toBeNull();
  });

  it('при форме «вы» просит «Оцените каждое…»', () => {
    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: () => {} }}>
        <YsqIntroFacts />
      </AddressFormContext.Provider>,
    );
    expect(screen.getByText('Оцените каждое от 1 до 6')).toBeTruthy();
    expect(screen.queryByText('Оцени каждое от 1 до 6')).toBeNull();
  });

  it('показывает все три факта о тесте', () => {
    render(<YsqIntroFacts />);
    expect(screen.getByText('116 утверждений')).toBeTruthy();
    expect(screen.getByText('~10 минут')).toBeTruthy();
    expect(screen.getByText('20 схем')).toBeTruthy();
  });
});
