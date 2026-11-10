// @vitest-environment jsdom
// Тихая ссылка «Важное о самопомощи» в шапке «Практики» (на компьютере; на телефоне она под
// вводной практик — HereAndNowBlock.compact.test.tsx). Главное для кризисного пути (правило №7):
// из листа телефон доверия достижим одним нажатием, и это настоящая tel:-ссылка.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PracticeHeader } from './PracticeHeader';
import { AddressFormContext } from '../../utils/addressForm';
import { CRISIS_HOTLINE_DISPLAY, CRISIS_HOTLINE_TEL } from '../../utils/crisisMarkers';
import { plain } from '../../test-support/plainText';

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
        <PracticeHeader phone={phone} banner={null} onCustomize={vi.fn()} />
      </AddressFormContext.Provider>
    </MemoryRouter>,
  );
}

describe('PracticeHeader — встреча', () => {
  const tail = (partnerName: string) => {
    render(
      <MemoryRouter>
        <PracticeHeader phone banner={{ label: 'завтра', isToday: false, partnerName }} onCustomize={vi.fn()} />
      </MemoryRouter>,
    );
    return screen.getByText(/Терапевт:/).textContent ?? '';
  };

  it('короткое имя: «·» строку не начинает, «Терапевт:» не отрывается от имени; слова те же', () => {
    expect(tail('Ольга Миронова')).toBe('\u00a0· Терапевт:\u00a0Ольга Миронова');
  });

  // Ревью g4 r5: подпись склеивалась целиком (все пробелы неразрывные) — имя из данных терапевта длиной 40+
  // знаков не переносилось и вылезало за край строки встречи на телефоне.
  it('длинное имя переносится: пробелы внутри имени обычные, дефис пользователя тот же', () => {
    const name = 'Александра Константиновна Покровская-Вишневецкая';
    expect(name.length).toBeGreaterThan(40);
    const text = tail(name);
    expect(text).toContain('Терапевт:\u00a0Александра Константиновна Покровская-Вишневецкая');
    expect(text).not.toMatch(/[\u2011\u2060]/);
    expect(plain(text)).toBe(` · Терапевт: ${name}`);
  });
});

describe('PracticeHeader — «Важное о самопомощи»', () => {
  it('компьютер: ссылка в шапке рядом с «Настроить инструменты», без ⚠ и без цвета предупреждения; лист закрыт', () => {
    renderHeader(false);
    const entry = screen.getByRole('button', { name: 'Важное о самопомощи' });
    expect(entry.classList.contains('ds-link')).toBe(true);
    expect(entry.classList.contains('ds-btn--icon')).toBe(false);
    expect(entry.querySelector('svg')?.getAttribute('aria-hidden')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Настроить инструменты' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('телефон: в шапке только «Настроить инструменты» — «Важное» стоит под вводной практик', () => {
    renderHeader(true);
    expect(screen.getByRole('button', { name: 'Настроить инструменты' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Важное о самопомощи' })).toBeNull();
  });

  it('тап открывает лист с текстом, «Понятно» закрывает', () => {
    renderHeader(false);
    fireEvent.click(screen.getByRole('button', { name: 'Важное о самопомощи' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Они как спасательный жилет в шторм/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Контакты помощи' })).toBeTruthy();
  });

  it('«Контакты помощи» ведёт к телефону доверия (настоящая tel:-ссылка), текст листа остаётся под ним', () => {
    renderHeader(false);
    fireEvent.click(screen.getByRole('button', { name: 'Важное о самопомощи' }));
    fireEvent.click(screen.getByRole('button', { name: 'Контакты помощи' }));
    const link = screen.getByText(CRISIS_HOTLINE_DISPLAY).closest('a');
    expect(link?.getAttribute('href')).toBe(CRISIS_HOTLINE_TEL);
    expect(screen.getByText('Помощь рядом')).toBeTruthy();
    // Лист самопомощи не потерян: после закрытия контактов человек вернётся к тексту.
    expect(screen.getByText(/Они как спасательный жилет в шторм/)).toBeTruthy();
  });

  it('форма обращения: «ты» и «вы» в абзаце про ориентир', () => {
    const { unmount } = renderHeader(false, 'ty');
    fireEvent.click(screen.getByRole('button', { name: 'Важное о самопомощи' }));
    expect(screen.getByText(/Если замечаешь, что тянешься/)).toBeTruthy();
    unmount();
    renderHeader(false, 'vy');
    fireEvent.click(screen.getByRole('button', { name: 'Важное о самопомощи' }));
    expect(screen.getByText(/Если замечаете, что тянетесь/)).toBeTruthy();
    expect(screen.queryByText(/замечаешь/)).toBeNull();
  });
});
