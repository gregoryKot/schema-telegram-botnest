// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useDialogA11y } from './dialogA11y';
import { useDialogLayer } from './dialogStack';

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

  it('кнопка-открыватель исчезла вместе с окном — фокус остаётся в слое-родителе, не на body', () => {
    // Как «Отключиться от терапевта»: подтверждение и его кнопка уходят одним коммитом.
    function Sheet({ done = false }: { done?: boolean }) {
      const sheetProps = useDialogA11y();
      const [asked, setAsked] = useState(false);
      return (
        <div {...sheetProps} data-testid="sheet">
          {done ? (
            <p>Отключено</p>
          ) : (
            <button data-testid="ask" onClick={() => setAsked(true)}>
              Отключиться
            </button>
          )}
          {asked && !done && <Dialog />}
        </div>
      );
    }
    const { getByTestId, rerender } = render(<Sheet />);
    getByTestId('ask').focus();
    fireEvent.click(getByTestId('ask'));
    expect(document.activeElement).toBe(getByTestId('first'));
    rerender(<Sheet done />);
    expect(document.activeElement).toBe(getByTestId('sheet'));
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

// Аудит 2026-10 («Escape закрывает все шиты разом», «два фокус-трапа
// дерутся»): у каждого диалога был свой слушатель, стека не было. Все тесты
// ниже монтируют НЕСКОЛЬКО диалогов одновременно — с одним баг не виден.
describe('useDialogA11y — стек диалогов', () => {
  function Layer({
    id,
    onEscape,
    holdEscape,
    children,
  }: {
    id: string;
    onEscape?: () => void;
    holdEscape?: boolean;
    children?: React.ReactNode;
  }) {
    const dialogProps = useDialogA11y({ onEscape, holdEscape });
    return (
      <div {...dialogProps} data-testid={id}>
        <button data-testid={`${id}-1`}>1</button>
        <button data-testid={`${id}-2`}>2</button>
        <button data-testid={`${id}-3`}>3</button>
        {children}
      </div>
    );
  }
  const escape = () => fireEvent.keyDown(document, { key: 'Escape' });

  it('Tab/Shift+Tab с серединного элемента верхнего диалога: нижний трап не вмешивается', () => {
    const { getByTestId } = render(
      <>
        <Layer id="low" />
        <Layer id="top" />
      </>,
    );
    // Раньше нижний трап тянул фокус к себе, а верхний возвращал на свой
    // первый элемент — фокус «прыгал» вместо шага по порядку.
    getByTestId('top-2').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(getByTestId('top-2'));
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(getByTestId('top-2'));
  });

  it('Escape при двух диалогах с onEscape вызывает только верхний', () => {
    const low = vi.fn();
    const top = vi.fn();
    render(
      <>
        <Layer id="low" onEscape={low} />
        <Layer id="top" onEscape={top} />
      </>,
    );
    escape();
    expect(top).toHaveBeenCalledTimes(1);
    expect(low).not.toHaveBeenCalled();
  });

  it('Escape отменяет действие по умолчанию, только когда слой закрылся сам', () => {
    render(<Layer id="a" onEscape={() => {}} />);
    expect(fireEvent.keyDown(document, { key: 'Escape' })).toBe(false);
    cleanup();
    render(<Layer id="b" />);
    expect(fireEvent.keyDown(document, { key: 'Escape' })).toBe(true);
  });

  it('верхний несворачиваемый (holdEscape): Escape не закрывает нижний и отменён', () => {
    const low = vi.fn();
    render(
      <>
        <Layer id="low" onEscape={low} />
        <Layer id="top" holdEscape />
      </>,
    );
    expect(fireEvent.keyDown(document, { key: 'Escape' })).toBe(false);
    expect(low).not.toHaveBeenCalled();
  });

  it('слой без onEscape и holdEscape прозрачен (фокус листа): Escape уходит нижнему', () => {
    const low = vi.fn();
    render(
      <>
        <Layer id="low" onEscape={low} />
        <Layer id="top" />
      </>,
    );
    escape();
    expect(low).toHaveBeenCalledTimes(1);
  });

  // Лист с записью истории (useHistorySheet) — тоже слой стека, kind 'sheet': Escape он
  // берёт сам во всплытии и только когда ownsEscape() — никакое окно над ним Escape не держит.
  describe('слой листа (kind: sheet)', () => {
    const owns = { current: () => false };
    function Sheet({ children }: { children?: React.ReactNode }) {
      const layer = useDialogLayer({ kind: 'sheet' });
      useEffect(() => layer.join(), [layer]);
      useEffect(() => {
        owns.current = layer.ownsEscape;
      });
      return <>{children}</>;
    }

    it('несворачиваемое окно над листом держит Escape: лист его не получает', () => {
      const { rerender } = render(
        <Sheet>
          <Layer id="picker" holdEscape />
        </Sheet>,
      );
      expect(fireEvent.keyDown(document, { key: 'Escape' })).toBe(false);
      expect(owns.current()).toBe(false);
      rerender(<Sheet />);
      expect(owns.current()).toBe(true);
    });

    it('собственный фокус-слой листа прозрачен: Escape — листу', () => {
      render(
        <Sheet>
          <Layer id="focus" />
        </Sheet>,
      );
      expect(fireEvent.keyDown(document, { key: 'Escape' })).toBe(true);
      expect(owns.current()).toBe(true);
    });

    it('лист над окном с onEscape: Escape листу, окно под ним не закрывается', () => {
      const dialog = vi.fn();
      render(
        <Layer id="dialog" onEscape={dialog}>
          <Sheet />
        </Layer>,
      );
      expect(fireEvent.keyDown(document, { key: 'Escape' })).toBe(true);
      expect(dialog).not.toHaveBeenCalled();
      expect(owns.current()).toBe(true);
    });
  });

  it('прочие клавиши onEscape не вызывают', () => {
    const fn = vi.fn();
    render(<Layer id="a" onEscape={fn} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('после размонтирования верхнего Escape и трап переходят к нижнему', () => {
    const low = vi.fn();
    const top = vi.fn();
    const App = ({ withTop }: { withTop: boolean }) => (
      <>
        <Layer id="low" onEscape={low} />
        {withTop && <Layer id="top" onEscape={top} />}
      </>
    );
    const { rerender, getByTestId } = render(<App withTop />);
    rerender(<App withTop={false} />);
    escape();
    expect(low).toHaveBeenCalledTimes(1);
    expect(top).not.toHaveBeenCalled();
    getByTestId('low-3').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(getByTestId('low-1'));
  });

  // Пассивная очистка эффекта отстаёт от коммита: между ними снятое окно держало Escape.
  it('окно снято с экрана — Escape в том же коммите уже не его (слой уходит вместе с DOM)', () => {
    const seen: boolean[] = [];
    function PressOnMount() {
      useLayoutEffect(() => {
        seen.push(!escape());
      }, []);
      return null;
    }
    const { rerender } = render(<Layer id="held" holdEscape />);
    rerender(<PressOnMount />);
    expect(seen).toEqual([false]);
  });

  it('вложенный диалог, смонтированный в одном коммите с родителем, считается верхним', () => {
    // Эффект ребёнка срабатывает раньше родительского: порядок слоёв нельзя
    // брать из порядка эффектов — только из render.
    const parent = vi.fn();
    const child = vi.fn();
    const { getByTestId } = render(
      <Layer id="parent" onEscape={parent}>
        <Layer id="child" onEscape={child} />
      </Layer>,
    );
    escape();
    expect(child).toHaveBeenCalledTimes(1);
    expect(parent).not.toHaveBeenCalled();
    getByTestId('child-3').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(getByTestId('child-1'));
  });

  it('свежий onEscape подхватывается без пересоздания слоя', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Layer id="a" onEscape={first} />);
    rerender(<Layer id="a" onEscape={second} />);
    escape();
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('когда диалогов не осталось, Escape никого не зовёт (слушатель снят)', () => {
    const fn = vi.fn();
    const { unmount } = render(<Layer id="a" onEscape={fn} />);
    unmount();
    escape();
    expect(fn).not.toHaveBeenCalled();
  });
});
