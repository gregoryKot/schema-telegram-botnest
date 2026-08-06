// @vitest-environment jsdom
// MyCardsList — строки заполненных карточек: тап открывает, «Поделиться» не
// открывает (клик по кнопке не должен всплыть до строки).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MyCardsList, MyCardItem } from './MyCardsList';

afterEach(cleanup);

const ITEMS: MyCardItem[] = [
  {
    id: 'abandonment',
    name: 'Покинутость',
    subtitle: 'Отчуждение и отвержение',
    color: '#5aa8f7',
    excerpt: 'Когда не отвечают на сообщения',
    cardFields: [{ label: 'Что включает', text: 'Когда не отвечают' }],
  },
  {
    id: 'defectiveness',
    name: 'Дефективность / Стыд',
    color: '#f75a5a',
    excerpt: 'Чувство что я плохой человек',
    cardFields: [
      { label: 'Какие мысли', text: 'Чувство что я недостаточно хорош' },
    ],
  },
];

describe('MyCardsList', () => {
  it('рендерит название и выжимку каждой карточки', () => {
    render(<MyCardsList items={ITEMS} onOpen={() => {}} onShare={() => {}} />);
    expect(screen.getByText('Покинутость')).toBeTruthy();
    expect(screen.getByText('Когда не отвечают на сообщения')).toBeTruthy();
    expect(screen.getByText('Дефективность / Стыд')).toBeTruthy();
  });

  it('тап по строке открывает карточку с её id', () => {
    const onOpen = vi.fn();
    render(<MyCardsList items={ITEMS} onOpen={onOpen} onShare={() => {}} />);
    fireEvent.click(screen.getByText('Покинутость'));
    expect(onOpen).toHaveBeenCalledWith('abandonment');
  });

  it('«Поделиться» зовёт onShare с этой карточкой и НЕ открывает редактор', () => {
    const onOpen = vi.fn();
    const onShare = vi.fn();
    render(<MyCardsList items={ITEMS} onOpen={onOpen} onShare={onShare} />);
    const shareButtons = screen.getAllByRole('button', { name: 'Поделиться' });
    fireEvent.click(shareButtons[0]);
    expect(onShare).toHaveBeenCalledWith(ITEMS[0]);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
