// @vitest-environment jsdom
// Чек-ин «Режим прямо сейчас» во вкладке режимов справочника схем — вложенный
// fullscreen-оверлей. Находка аудита 2026-10: «Назад» у него был голым
// setShowCheckin(false), а системная «Назад» и Escape закрывали весь справочник
// вместе с чек-ином. Тест ставит оба листа в реальную связку: настоящий
// SchemaInfoSheet под хостом, который размонтирует его по onClose.
import { describe, it, expect, afterEach } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { SchemaInfoSheet } from '../SchemaInfoSheet';
import { AddressFormContext } from '../../utils/addressForm';

const nav: { back: () => void } = { back: () => {} };
function BackSpy() {
  const navigate = useNavigate();
  useEffect(() => { nav.back = () => navigate(-1); });
  return null;
}

function Host() {
  const [open, setOpen] = useState(true);
  return open ? <SchemaInfoSheet onClose={() => setOpen(false)} /> : <div>HOST-CLOSED</div>;
}

function openCheckin(form: 'ty' | 'vy' = 'ty') {
  render(
    <AddressFormContext.Provider value={{ form, setForm: () => {} }}>
      <MemoryRouter initialEntries={['/schemas']}>
        <BackSpy />
        <Host />
      </MemoryRouter>
    </AddressFormContext.Provider>,
  );
  fireEvent.click(screen.getByText('Режимы'));
  fireEvent.click(screen.getByText('Режим прямо сейчас'));
}

const popBack = () => act(() => nav.back());
const pressEscape = () =>
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

afterEach(() => cleanup());

describe('ModesTab — чек-ин живёт в истории браузера', () => {
  it('открытие чек-ина не закрывает справочник под ним', () => {
    openCheckin();
    expect(screen.getByText('Выбери самое близкое ощущение')).toBeTruthy();
    expect(screen.queryByText('HOST-CLOSED')).toBeNull();
    // Справочник на месте: его заголовок виден.
    expect(screen.getByText('Схема-терапия')).toBeTruthy();
  });

  it('системная «Назад» на выборе закрывает только чек-ин; второе «Назад» — справочник', () => {
    openCheckin();

    popBack();
    expect(screen.queryByText('Выбери самое близкое ощущение')).toBeNull();
    expect(screen.queryByText('HOST-CLOSED')).toBeNull();
    expect(screen.getByText('Режимы')).toBeTruthy();

    popBack();
    expect(screen.getByText('HOST-CLOSED')).toBeTruthy();
  });

  it('Escape закрывает только чек-ин', () => {
    openCheckin();

    pressEscape();

    expect(screen.queryByText('Выбери самое близкое ощущение')).toBeNull();
    expect(screen.queryByText('HOST-CLOSED')).toBeNull();
  });

  // Два «Назад» на экране: справочника (внизу) и чек-ина (поверх) — нужен последний.
  const clickTopBack = () => {
    const buttons = screen.getAllByText('Назад');
    fireEvent.click(buttons[buttons.length - 1]);
  };

  it('кнопка «Назад» чек-ина закрывает чек-ин через историю; справочник остаётся и закрывается следующим «Назад»', () => {
    openCheckin();

    clickTopBack();
    expect(screen.queryByText('Выбери самое близкое ощущение')).toBeNull();
    expect(screen.queryByText('HOST-CLOSED')).toBeNull();

    popBack();
    expect(screen.getByText('HOST-CLOSED')).toBeTruthy();
  });
});

describe('ModesTab — результат чек-ина', () => {
  it('выбор ощущения показывает режим и «Что помогает»', () => {
    openCheckin();

    fireEvent.click(screen.getByText('Легко и радостно'));

    // «Счастливый Ребёнок» есть и в списке режимов под оверлеем, поэтому
    // результат опознаём по блоку «Что помогает» (он только в чек-ине).
    expect(screen.getByText('Что помогает')).toBeTruthy();
    expect(screen.getAllByText('Счастливый Ребёнок').length).toBeGreaterThan(1);
  });

  it('«Понятно» закрывает чек-ин и снимает его запись истории: следующее «Назад» закрывает справочник', () => {
    openCheckin();
    fireEvent.click(screen.getByText('Легко и радостно'));

    fireEvent.click(screen.getByText('Понятно'));
    expect(screen.queryByText('Что помогает')).toBeNull();
    expect(screen.queryByText('HOST-CLOSED')).toBeNull();

    // Запись чек-ина снята: один POP — справочник, а не лишнее «Назад» вхолостую.
    popBack();
    expect(screen.getByText('HOST-CLOSED')).toBeTruthy();
  });

  it('системная «Назад» на экране результата закрывает весь чек-ин, справочник остаётся', () => {
    openCheckin();
    fireEvent.click(screen.getByText('Легко и радостно'));

    popBack();

    expect(screen.queryByText('Что помогает')).toBeNull();
    expect(screen.queryByText('Выбери самое близкое ощущение')).toBeNull();
    expect(screen.queryByText('HOST-CLOSED')).toBeNull();
  });

  it('форма «вы»: подсказка выбора и совет обращены на «вы»', () => {
    openCheckin('vy');
    expect(screen.getByText('Выберите самое близкое ощущение')).toBeTruthy();

    fireEvent.click(screen.getByText('Давление / «надо больше»'));
    expect(screen.getByText(/Это не ваш голос/)).toBeTruthy();
  });
});
