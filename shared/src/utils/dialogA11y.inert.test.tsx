// @vitest-environment jsdom
// Ленивый лист: пока грузился чанк, фон стал inert и браузер снял фокус с открывателя — лист запоминал body,
// и после закрытия (Escape на первом открытии настроек) фокус падал на body.
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useDialogA11y } from './dialogA11y';

afterEach(cleanup);

function Sheet() {
  return <div {...useDialogA11y()}><button>Закрыть</button></div>;
}

function blurInsideInert(page: HTMLElement, opener: HTMLElement) {
  opener.focus();
  page.setAttribute('inert', '');
  opener.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
  opener.blur(); // jsdom сам фокус из inert не снимает
}

describe('useDialogA11y — открыватель, потерявший фокус в inert', () => {
  it('закрытие возвращает фокус на открыватель, а не на body', () => {
    const page = document.body.appendChild(document.createElement('div'));
    const opener = page.appendChild(document.createElement('button'));
    blurInsideInert(page, opener);
    expect(document.activeElement).toBe(document.body);
    const { unmount } = render(<Sheet />);
    page.removeAttribute('inert');
    unmount();
    expect(document.activeElement).toBe(opener);
    page.remove();
  });

  it('после потери фокуса фокус побывал в другом месте — старый открыватель забыт', () => {
    const page = document.body.appendChild(document.createElement('div'));
    const opener = page.appendChild(document.createElement('button'));
    const other = document.body.appendChild(document.createElement('input'));
    blurInsideInert(page, opener);
    page.removeAttribute('inert');
    other.focus(); other.blur();
    const { unmount } = render(<Sheet />);
    unmount();
    expect(document.activeElement).not.toBe(opener);
    page.remove(); other.remove();
  });
});
