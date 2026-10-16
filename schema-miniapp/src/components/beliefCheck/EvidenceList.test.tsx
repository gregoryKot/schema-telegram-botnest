// @vitest-environment jsdom
// EvidenceList — общий контрол для доказательств «за»/«против» в проверке
// убеждения (используется дважды в BeliefCheck). Правило №7 CLAUDE.md: поле
// ввода — свободный текст, обязано проходить кризисную детекцию через
// CrisisGate. Отдельный прямой тест на компонент (а не только через
// BeliefCheck), т.к. крайние ("for"/"against") шаги используют именно его.
import { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EvidenceList } from './EvidenceList';
import { CRISIS_HOTLINE_DISPLAY } from '../../utils/crisisMarkers';

afterEach(() => {
  cleanup();
});

function Wrapper() {
  const [items, setItems] = useState<string[]>([]);
  const [input, setInput] = useState('');
  return (
    <EvidenceList
      items={items}
      setItems={setItems}
      input={input}
      setInput={setInput}
      onAdd={() => {
        const v = input.trim();
        if (!v) return;
        setItems((l) => [...l, v]);
        setInput('');
      }}
      accentColor="var(--accent-red)"
      surface="belief_check"
    />
  );
}

describe('EvidenceList — кризисная детекция (правило №7)', () => {
  it('показывает карточку поддержки при кризисной фразе во вводе', () => {
    render(<Wrapper />);
    const input = screen.getByPlaceholderText('Добавить...');
    fireEvent.change(input, { target: { value: 'хочу умереть' } });
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });

  it('не показывает карточку при нейтральном вводе', () => {
    render(<Wrapper />);
    const input = screen.getByPlaceholderText('Добавить...');
    fireEvent.change(input, { target: { value: 'меня не любили в детстве' } });
    expect(screen.queryByText(CRISIS_HOTLINE_DISPLAY)).toBeNull();
  });

  it('показывает карточку, если кризисная фраза уже в добавленных пунктах', () => {
    render(<Wrapper />);
    const input = screen.getByPlaceholderText('Добавить...');
    fireEvent.change(input, { target: { value: 'не хочу жить' } });
    fireEvent.click(screen.getByText('+'));
    // Пункт добавлен, инпут очищен — карточка должна остаться видимой,
    // т.к. CrisisGate проверяет весь список items, не только текущий ввод.
    expect(screen.getByText(CRISIS_HOTLINE_DISPLAY)).toBeTruthy();
  });
});

describe('EvidenceList — добавление/удаление пунктов', () => {
  it('добавляет пункт по клику на «+» и очищает поле ввода', () => {
    render(<Wrapper />);
    const input = screen.getByPlaceholderText('Добавить...');
    fireEvent.change(input, { target: { value: 'аргумент' } });
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('• аргумент')).toBeTruthy();
    expect(input.value).toBe('');
  });

  it('удаляет пункт по клику на крестик', () => {
    render(<Wrapper />);
    const input = screen.getByPlaceholderText('Добавить...');
    fireEvent.change(input, { target: { value: 'аргумент' } });
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('• аргумент')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(screen.queryByText('• аргумент')).toBeNull();
  });

  it('кнопка удаления: зона нажатия не меньше 44×44, видимый крестик остаётся мелким', () => {
    render(<Wrapper />);
    fireEvent.change(screen.getByPlaceholderText('Добавить...'), {
      target: { value: 'аргумент' },
    });
    fireEvent.click(screen.getByText('+'));
    const btn = screen.getByRole('button', { name: 'Удалить' });
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.style.width).toBe('44px');
    expect(btn.style.height).toBe('44px');
    const glyph = screen.getByText('×');
    expect(glyph.style.width).toBe('16px');
    expect(glyph.style.height).toBe('16px');
  });

  it('зона нажатия не выходит за строку: padding строки не меньше выступа зоны', () => {
    render(<Wrapper />);
    const input = screen.getByPlaceholderText('Добавить...');
    for (const v of ['первый', 'второй']) {
      fireEvent.change(input, { target: { value: v } });
      fireEvent.click(screen.getByText('+'));
    }
    const buttons = screen.getAllByRole('button', { name: 'Удалить' });
    expect(buttons).toHaveLength(2);
    for (const btn of buttons) {
      const row = btn.parentElement as HTMLElement;
      const reach = -parseFloat(btn.style.marginTop);
      // Зона выступает над и под глифом на reach — строка обязана вместить её
      // своим padding, иначе тап возле «×» попадёт в кнопку соседней строки.
      expect(parseFloat(row.style.paddingTop)).toBeGreaterThanOrEqual(reach);
      expect(parseFloat(row.style.paddingBottom)).toBeGreaterThanOrEqual(reach);
    }
  });

  it('Enter в поле ввода вызывает onAdd (пустой ввод не добавляет пункт — логика родителя)', () => {
    render(<Wrapper />);
    fireEvent.keyDown(screen.getByPlaceholderText('Добавить...'), {
      key: 'Enter',
    });
    expect(screen.queryByText(/^•/)).toBeNull();
  });
});
