// @vitest-environment jsdom
// ui.tsx — презентационные примитивы SettingsSheet (SRow/Toggle/
// ChevronVal/InfoModal), вынесены из SettingsSheet.tsx (правило №10). Прямые
// тесты каждого примитива и его веток — сам SettingsSheet использует их
// только косвенно.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { SRow, Toggle, ChevronVal, InfoModal } from './ui';

afterEach(() => {
  cleanup();
});

describe('SRow — без onClick', () => {
  it('не кликабельна: нет role="button", нет стрелки-плейсхолдера', () => {
    const { container } = render(<SRow title="Просто строка" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Просто строка')).toBeTruthy();
    expect(container.querySelector('.ds-chev')).toBeNull();
  });

  it('без sub — подписи нет', () => {
    render(<SRow title="Без подписи" />);
    expect(screen.queryByText('Подпись')).toBeNull();
  });
});

describe('SRow — с sub', () => {
  it('sub рендерится, если задан', () => {
    render(<SRow title="Основной" sub="Подпись" />);
    expect(screen.getByText('Подпись')).toBeTruthy();
  });
});

describe('SRow — с onClick', () => {
  it('кликабельна, role="button", клик зовёт onClick', () => {
    const onClick = vi.fn();
    render(<SRow title="Кликабельная" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Enter/Space зовут onClick (доступность с клавиатуры)', () => {
    const onClick = vi.fn();
    render(<SRow title="Кликабельная" onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('без явного right — рисует стрелку-плейсхолдер ›', () => {
    const { container } = render(<SRow title="Со стрелкой" onClick={() => {}} />);
    expect(container.querySelector('.ds-chev[aria-hidden="true"]')).toBeTruthy();
  });
});

describe('SRow — right', () => {
  it('явный right побеждает стрелку-плейсхолдер', () => {
    const { container } = render(
      <SRow title="С кастомным right" onClick={() => {}} right={<span>кастом</span>} />,
    );
    expect(screen.getByText('кастом')).toBeTruthy();
    expect(container.querySelector('.ds-chev')).toBeNull();
  });
});

describe('SRow — danger', () => {
  it('danger рендерит title тем же текстом (визуальный цвет проверяем через сам факт рендера)', () => {
    render(<SRow title="Удалить всё" danger onClick={() => {}} />);
    expect(screen.getByText('Удалить всё')).toBeTruthy();
  });
});

describe('Toggle', () => {
  // Аудит 2026-10, «Доступность»: switch без имени — скринридер читал
  // «переключатель, выключено», не называя, что переключается.
  it('label становится именем switch для скринридера', () => {
    render(<Toggle label="Итоги дня" on={false} onClick={() => {}} />);
    expect(screen.getByRole('switch', { name: 'Итоги дня' }).getAttribute('aria-checked')).toBe('false');
  });

  it('on=false — aria-checked false', () => {
    render(<Toggle label="Итоги дня" on={false} onClick={() => {}} />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });

  it('on=true — aria-checked true', () => {
    render(<Toggle label="Итоги дня" on={true} onClick={() => {}} />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('клик зовёт onClick', () => {
    const onClick = vi.fn();
    render(<Toggle label="Итоги дня" on={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Enter/Space зовут onClick', () => {
    const onClick = vi.fn();
    render(<Toggle label="Итоги дня" on={false} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('switch'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('switch'), { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

describe('ChevronVal', () => {
  it('текст и стрелка рендерятся', () => {
    const { container } = render(<ChevronVal text="Значение" />);
    expect(screen.getByText('Значение')).toBeTruthy();
    expect(container.querySelector('.ds-chev')).toBeTruthy();
  });
});

describe('InfoModal', () => {
  it('рендерит children', () => {
    render(
      <MemoryRouter><InfoModal title="Заголовок окна" onClose={() => {}}>
        <div>Содержимое модалки</div>
      </InfoModal></MemoryRouter>,
    );
    expect(screen.getByText('Содержимое модалки')).toBeTruthy();
  });

  it('клик по фону зовёт onClose', async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter><InfoModal title="Заголовок окна" onClose={onClose}>
        <div>Тело</div>
      </InfoModal></MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText('Закрыть'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('клик внутри модалки не зовёт onClose (stopPropagation)', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter><InfoModal title="Заголовок окна" onClose={onClose}>
        <div>Клик внутри</div>
      </InfoModal></MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Клик внутри'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Enter/Space на фоне зовут onClose', async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter><InfoModal title="Заголовок окна" onClose={onClose}>
        <div>Тело</div>
      </InfoModal></MemoryRouter>,
    );
    fireEvent.keyDown(screen.getByLabelText('Закрыть'), { key: 'Enter' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  // QA 2026-11, М11: «Сводку для терапевта» и пояснения закрывали только
  // клик мимо окна или Escape — кнопки не было.
  it('внутри окна есть кнопка «Закрыть», она зовёт onClose один раз', async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter><InfoModal title="Заголовок окна" onClose={onClose}>
        <div>Тело</div>
      </InfoModal></MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Закрыть', { selector: 'button' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

// Ревью b25: окно — диалог, а не «presentation»: фокус внутрь, имя по заголовку, возврат фокуса на вызвавшую кнопку.
describe('InfoModal — диалог', () => {
  function Opener() {
    const [open, setOpen] = useState(false);
    return (
      <MemoryRouter>
        <button onClick={() => setOpen(true)}>Пояснение</button>
        {open && <InfoModal title="Данные и конфиденциальность" onClose={() => setOpen(false)}><p>Тело</p></InfoModal>}
      </MemoryRouter>
    );
  }
  it('role="dialog", aria-modal, имя — заголовок (предлог приклеен неразрывным пробелом), фокус внутри', () => {
    render(<Opener />);
    screen.getByText('Пояснение').focus();
    fireEvent.click(screen.getByText('Пояснение'));
    const dialog = screen.getByRole('dialog', { name: /Данные и\sконфиденциальность/ });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.querySelector('h2')!.textContent).toBe('Данные и\u00a0конфиденциальность');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
  it('Tab с последней кнопки остаётся в окне; после закрытия фокус возвращается на вызвавшую кнопку', async () => {
    render(<Opener />);
    const opener = screen.getByText('Пояснение');
    opener.focus();
    fireEvent.click(opener);
    const close = screen.getByText('Закрыть', { selector: 'button' });
    close.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });
});

