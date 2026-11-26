// @vitest-environment jsdom
// Одна раскрывашка на все места: ds-fold сайта (лист потребности, «Зачем это?», подсказка
// упражнения, «Все N схем»), аккордеон карты схем и инлайн-вид схемы случая без классов.
import type { CSSProperties } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Disclosure, DS_FOLD, type DisclosureClasses } from './Disclosure';

const CLASSES: DisclosureClasses = {
  root: 'f-root',
  btn: 'f-btn',
  label: 'f-label',
  chev: 'f-chev',
  body: 'f-body',
};

const kids = (el: Element) => [...el.children].map((c) => c.className);

afterEach(() => cleanup());

describe('Disclosure', () => {
  it('по умолчанию закрыта: содержимого нет, aria-expanded=false, клик открывает и закрывает', () => {
    render(
      <Disclosure title="Как читать">
        <p>Текст</p>
      </Disclosure>,
    );
    const btn = screen.getByRole('button', { name: /Как читать/ });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Текст')).toBeNull();
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Текст')).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.queryByText('Текст')).toBeNull();
  });

  it('defaultOpen — открыта сразу, но закрывается кликом', () => {
    render(
      <Disclosure title="Как читать" defaultOpen>
        <p>Текст</p>
      </Disclosure>,
    );
    expect(screen.getByText('Текст')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Как читать/ }));
    expect(screen.queryByText('Текст')).toBeNull();
  });

  it('инлайн-вид без классов: зона нажатия 44, шеврон ▾/▴ скрыт от чтения', () => {
    const { container } = render(
      <Disclosure title="Подсказки">
        <p>Текст</p>
      </Disclosure>,
    );
    expect(container.firstElementChild?.hasAttribute('class')).toBe(false);
    const btn = screen.getByRole('button', { name: 'Подсказки' });
    expect(btn.style.minHeight).toBe('44px');
    const chev = btn.lastElementChild;
    expect(chev?.getAttribute('aria-hidden')).toBe('true');
    expect(chev?.textContent).toBe('▾');
    fireEvent.click(btn);
    expect(chev?.textContent).toBe('▴');
  });

  it('с classes: разметка ds-fold, шеврон пустой и скрыт, тело монтируется только открытым', () => {
    const { container } = render(
      <Disclosure title="Как читать" classes={CLASSES}>
        <p>Текст</p>
      </Disclosure>,
    );
    expect(container.firstElementChild?.className).toBe('f-root');
    const btn = screen.getByRole('button', { name: 'Как читать' });
    expect(btn.className).toBe('f-btn');
    expect(btn.getAttribute('style')).toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    const chev = btn.querySelector('.f-chev');
    expect(chev?.textContent).toBe('');
    expect(chev?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.f-body')).toBeNull();
    expect(screen.queryByText('Текст')).toBeNull();
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('.f-body')?.textContent).toBe('Текст');
  });

  it('вид сайта DS_FOLD: свой класс поверх ds-fold, вторая строка между подписью и шевроном', () => {
    const { container } = render(
      <Disclosure
        title="Зачем это?"
        classes={DS_FOLD}
        className="sd-why"
        sub={<span className="sd-why-title">Рефлексия помогает</span>}
      >
        <p>Текст</p>
      </Disclosure>,
    );
    expect(container.firstElementChild?.className).toBe('ds-fold sd-why');
    const btn = screen.getByRole('button', { name: /^Зачем это\?/ });
    expect(btn.className).toBe('ds-fold-btn');
    expect(kids(btn)).toEqual(['ds-label', 'sd-why-title', 'ds-fold-chev']);
    fireEvent.click(btn);
    expect(container.querySelector('.ds-fold-body')?.textContent).toBe('Текст');
  });

  it('аккордеон карты: знак до подписи, подпись — разметка, style на корне', () => {
    const { container } = render(
      <Disclosure
        classes={CLASSES}
        style={{ '--h': 28 } as CSSProperties}
        lead={<span className="f-lead" aria-hidden="true" />}
        title={
          <>
            <span>Домен</span>
            <span>2 схемы</span>
          </>
        }
      >
        <p>Плитки</p>
      </Disclosure>,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--h')).toBe('28');
    const btn = screen.getByRole('button', { name: /^Домен/ });
    expect(kids(btn)).toEqual(['f-lead', 'f-label', 'f-chev']);
  });

  it('управляемое раскрытие: open снаружи, тап зовёт onToggle, сама не раскрывается', () => {
    const toggle = vi.fn();
    const fold = (open: boolean) => (
      <Disclosure title="Домен" open={open} onToggle={toggle}>
        <p>Плитки</p>
      </Disclosure>
    );
    const { rerender } = render(fold(false));
    const btn = screen.getByRole('button', { name: 'Домен' });
    fireEvent.click(btn);
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Плитки')).toBeNull();
    rerender(fold(true));
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Плитки')).toBeTruthy();
  });

  it('keepMounted: закрытое тело в DOM под hidden, раскрытие снимает hidden', () => {
    const { container } = render(
      <Disclosure title="Выполнено" classes={CLASSES} keepMounted>
        <p>Строка истории</p>
      </Disclosure>,
    );
    const body = container.querySelector('.f-body') as HTMLElement;
    expect(body.hidden).toBe(true);
    expect(body.textContent).toBe('Строка истории');
    fireEvent.click(screen.getByRole('button', { name: 'Выполнено' }));
    expect(body.hidden).toBe(false);
  });

  it('keepMounted: кнопка ссылается на тело через aria-controls', () => {
    render(
      <Disclosure title="Подробнее" classes={CLASSES} keepMounted>
        <p>Абзац</p>
      </Disclosure>,
    );
    const btn = screen.getByRole('button', { name: 'Подробнее' });
    const id = btn.getAttribute('aria-controls')!;
    expect(document.getElementById(id)?.textContent).toBe('Абзац');
  });

  it('chev: свой глиф места в шевроне, скрыт от чтения', () => {
    render(
      <Disclosure
        title="Домен"
        classes={CLASSES}
        chev={<svg data-testid="glyph" />}
      >
        <p>Плитки</p>
      </Disclosure>,
    );
    const chev = screen
      .getByRole('button', { name: 'Домен' })
      .querySelector('.f-chev');
    expect(chev?.getAttribute('aria-hidden')).toBe('true');
    expect(chev?.querySelector('[data-testid="glyph"]')).toBeTruthy();
  });

  it('с клавиатуры: родная кнопка в порядке Tab, Enter и Space не перехвачены', () => {
    render(
      <Disclosure title="Как читать" classes={DS_FOLD}>
        <p>Текст</p>
      </Disclosure>,
    );
    const btn = screen.getByRole('button', { name: 'Как читать' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.tabIndex).toBe(0);
    btn.focus();
    expect(document.activeElement).toBe(btn);
    expect(fireEvent.keyDown(btn, { key: 'Enter' })).toBe(true);
    expect(fireEvent.keyDown(btn, { key: ' ' })).toBe(true);
    // Enter и Space на родной кнопке браузер превращает в click; jsdom — нет, поэтому click в фокус.
    fireEvent.click(document.activeElement as HTMLElement);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Текст')).toBeTruthy();
  });
});
