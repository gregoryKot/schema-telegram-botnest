// @vitest-environment jsdom
// ui.tsx — презентационные примитивы SettingsSheet (SRow/Toggle/SmallToggle/
// ChevronVal/InfoModal), вынесены из SettingsSheet.tsx (правило №10). Прямые
// тесты каждого примитива и его веток — сам SettingsSheet использует их
// только косвенно.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SRow, Toggle, SmallToggle, ChevronVal, InfoModal } from './ui';

afterEach(() => {
  cleanup();
});

describe('SRow — без onClick', () => {
  it('не кликабельна: нет role="button", нет стрелки-плейсхолдера', () => {
    render(<SRow title="Просто строка" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Просто строка')).toBeTruthy();
    expect(screen.queryByText('›')).toBeNull();
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
    render(<SRow title="Со стрелкой" onClick={() => {}} />);
    expect(screen.getByText('›')).toBeTruthy();
  });
});

describe('SRow — right', () => {
  it('явный right побеждает стрелку-плейсхолдер', () => {
    render(
      <SRow title="С кастомным right" onClick={() => {}} right={<span>кастом</span>} />,
    );
    expect(screen.getByText('кастом')).toBeTruthy();
    expect(screen.queryByText('›')).toBeNull();
  });
});

describe('SRow — danger', () => {
  it('danger рендерит title тем же текстом (визуальный цвет проверяем через сам факт рендера)', () => {
    render(<SRow title="Удалить всё" danger onClick={() => {}} />);
    expect(screen.getByText('Удалить всё')).toBeTruthy();
  });
});

describe('Toggle', () => {
  it('on=false — aria-checked false', () => {
    render(<Toggle on={false} onClick={() => {}} />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });

  it('on=true — aria-checked true', () => {
    render(<Toggle on={true} onClick={() => {}} />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('клик зовёт onClick', () => {
    const onClick = vi.fn();
    render(<Toggle on={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Enter/Space зовут onClick', () => {
    const onClick = vi.fn();
    render(<Toggle on={false} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('switch'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('switch'), { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

describe('SmallToggle', () => {
  it('on=false — aria-checked false', () => {
    render(<SmallToggle on={false} onClick={() => {}} />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  });

  it('on=true — aria-checked true', () => {
    render(<SmallToggle on={true} onClick={() => {}} />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('клик зовёт onClick', () => {
    const onClick = vi.fn();
    render(<SmallToggle on={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Enter/Space зовут onClick', () => {
    const onClick = vi.fn();
    render(<SmallToggle on={true} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('switch'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('switch'), { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

describe('ChevronVal', () => {
  it('small не задан — текст и стрелка рендерятся', () => {
    render(<ChevronVal text="Значение" />);
    expect(screen.getByText('Значение')).toBeTruthy();
    expect(screen.getByText('›')).toBeTruthy();
  });

  it('small=true — текст и стрелка тоже рендерятся (проверяем контент, не размер шрифта)', () => {
    render(<ChevronVal text="Малое значение" small />);
    expect(screen.getByText('Малое значение')).toBeTruthy();
    expect(screen.getByText('›')).toBeTruthy();
  });
});

describe('InfoModal', () => {
  it('рендерит children', () => {
    render(
      <InfoModal onClose={() => {}}>
        <div>Содержимое модалки</div>
      </InfoModal>,
    );
    expect(screen.getByText('Содержимое модалки')).toBeTruthy();
  });

  it('клик по фону зовёт onClose', () => {
    const onClose = vi.fn();
    render(
      <InfoModal onClose={onClose}>
        <div>Тело</div>
      </InfoModal>,
    );
    fireEvent.click(screen.getByLabelText('Закрыть'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('клик внутри модалки не зовёт onClose (stopPropagation)', () => {
    const onClose = vi.fn();
    render(
      <InfoModal onClose={onClose}>
        <div>Клик внутри</div>
      </InfoModal>,
    );
    fireEvent.click(screen.getByText('Клик внутри'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Enter/Space на фоне зовут onClose', () => {
    const onClose = vi.fn();
    render(
      <InfoModal onClose={onClose}>
        <div>Тело</div>
      </InfoModal>,
    );
    fireEvent.keyDown(screen.getByLabelText('Закрыть'), { key: 'Enter' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
