// @vitest-environment jsdom
// Значок «Важное о самопомощи» в шапке «Практики» (паритет с ⚠️ в «Помощи»
// мини-аппа). Главное для кризисного пути (правило №7): из листа телефон
// доверия достижим одним нажатием, и это настоящая tel:-ссылка.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PracticeHeader } from './PracticeHeader';
import { AddressFormContext } from '../../utils/addressForm';
import { CRISIS_HOTLINE_DISPLAY, CRISIS_HOTLINE_TEL } from '../../utils/crisisMarkers';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));

afterEach(() => {
  cleanup();
});

function renderHeader(phone: boolean, form: 'ty' | 'vy' = 'ty') {
  return render(
    <MemoryRouter>
      <AddressFormContext.Provider value={{ form, setForm: vi.fn() }}>
        <PracticeHeader phone={phone} banner={null} />
      </AddressFormContext.Provider>
    </MemoryRouter>,
  );
}

describe('PracticeHeader — «Важное о самопомощи»', () => {
  it.each([true, false])('значок есть и в телефонной (%s) шапке, лист закрыт по умолчанию', (phone) => {
    renderHeader(phone);
    expect(screen.getByRole('button', { name: 'Важное о самопомощи' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('тап открывает лист с текстом, «Понятно» закрывает', () => {
    renderHeader(true);
    fireEvent.click(screen.getByRole('button', { name: 'Важное о самопомощи' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Они как спасательный жилет в шторм/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Контакты помощи' })).toBeTruthy();
  });

  it('«Контакты помощи» ведёт к телефону доверия (настоящая tel:-ссылка), текст листа остаётся под ним', () => {
    renderHeader(true);
    fireEvent.click(screen.getByRole('button', { name: 'Важное о самопомощи' }));
    fireEvent.click(screen.getByRole('button', { name: 'Контакты помощи' }));
    const link = screen.getByText(CRISIS_HOTLINE_DISPLAY).closest('a');
    expect(link?.getAttribute('href')).toBe(CRISIS_HOTLINE_TEL);
    expect(screen.getByText('Помощь рядом')).toBeTruthy();
    // Лист самопомощи не потерян: после закрытия контактов человек вернётся к тексту.
    expect(screen.getByText(/Они как спасательный жилет в шторм/)).toBeTruthy();
  });

  it('форма обращения: «ты» и «вы» в абзаце про ориентир', () => {
    const { unmount } = renderHeader(true, 'ty');
    fireEvent.click(screen.getByRole('button', { name: 'Важное о самопомощи' }));
    expect(screen.getByText(/Если замечаешь, что тянешься/)).toBeTruthy();
    unmount();
    renderHeader(true, 'vy');
    fireEvent.click(screen.getByRole('button', { name: 'Важное о самопомощи' }));
    expect(screen.getByText(/Если замечаете, что тянетесь/)).toBeTruthy();
    expect(screen.queryByText(/замечаешь/)).toBeNull();
  });
});
