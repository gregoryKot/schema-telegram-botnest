// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useDialogA11y } from './dialogA11y';

afterEach(cleanup);

function Dialog({ withFocusables = true }: { withFocusables?: boolean }) {
  const dialogProps = useDialogA11y();
  return (
    <div {...dialogProps} data-testid="dialog">
      {withFocusables ? (
        <>
          <button data-testid="first">Первая</button>
          <button data-testid="last">Последняя</button>
        </>
      ) : (
        <p>Без фокусируемых элементов</p>
      )}
    </div>
  );
}

describe('useDialogA11y', () => {
  it('ставит role="dialog" и aria-modal на контейнер', () => {
    const { getByTestId } = render(<Dialog />);
    const dialog = getByTestId('dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('при монтировании переносит фокус на первый фокусируемый элемент', () => {
    const { getByTestId } = render(<Dialog />);
    expect(document.activeElement).toBe(getByTestId('first'));
  });

  it('без фокусируемых потомков фокус уходит на сам контейнер', () => {
    const { getByTestId } = render(<Dialog withFocusables={false} />);
    expect(document.activeElement).toBe(getByTestId('dialog'));
  });

  it('Tab с последнего элемента циклится на первый', () => {
    const { getByTestId } = render(<Dialog />);
    getByTestId('last').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(getByTestId('first'));
  });

  it('Shift+Tab с первого элемента циклится на последний', () => {
    const { getByTestId } = render(<Dialog />);
    getByTestId('first').focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByTestId('last'));
  });

  it('если ref не подключён к DOM-узлу — эффект не бросает исключений (нет фокус-трапа)', () => {
    function NotAttached() {
      useDialogA11y();
      return <div data-testid="plain">без ref</div>;
    }
    expect(() => render(<NotAttached />)).not.toThrow();
  });

  it('прочие клавиши трап не трогают', () => {
    const { getByTestId } = render(<Dialog />);
    getByTestId('last').focus();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(document.activeElement).toBe(getByTestId('last'));
  });

  it('Tab без фокусируемых потомков остаётся на контейнере (не бросает исключений)', () => {
    const { getByTestId } = render(<Dialog withFocusables={false} />);
    expect(() => fireEvent.keyDown(document, { key: 'Tab' })).not.toThrow();
    expect(document.activeElement).toBe(getByTestId('dialog'));
  });

  it('Tab, когда фокус ушёл за пределы диалога, возвращает его на первый элемент', () => {
    const { getByTestId } = render(<Dialog />);
    // Симулируем утечку фокуса на фон (не должно случаться при активном
    // трапе, но защита обязана справляться и с этим).
    document.body.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(getByTestId('first'));
  });

  it('Shift+Tab, когда фокус ушёл за пределы диалога, возвращает его на последний элемент', () => {
    const { getByTestId } = render(<Dialog />);
    document.body.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByTestId('last'));
  });

  it('Tab внутри диалога, не на последнем элементе — трап не вмешивается', () => {
    const { getByTestId } = render(<Dialog />);
    getByTestId('first').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    // Фокус не перехвачен трапом — остаётся там, где был (браузер сам
    // передвинул бы его на следующий элемент, чего jsdom не делает).
    expect(document.activeElement).toBe(getByTestId('first'));
  });

  it('Shift+Tab внутри диалога, не на первом элементе — трап не вмешивается', () => {
    const { getByTestId } = render(<Dialog />);
    getByTestId('last').focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByTestId('last'));
  });

  it('если элемент, с которого открыли диалог, исчез из DOM — фокус на него не возвращается', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = render(<Dialog />);
    opener.remove();

    expect(() => unmount()).not.toThrow();
    expect(document.activeElement).not.toBe(opener);
  });

  it('при размонтировании возвращает фокус на элемент, с которого открыли диалог', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Открыть';
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { unmount } = render(<Dialog />);
    expect(document.activeElement).not.toBe(opener);

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
