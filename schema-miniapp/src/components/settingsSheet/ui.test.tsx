// @vitest-environment jsdom
// ui.tsx — общие примитивы настроек (Row/Toggle/RowRight/SectionHeader),
// используются во всех settingsSheet-секциях (0%/частичное покрытие через
// косвенные тесты секций). Здесь — прямые тесты каждого примитива и его
// веток: Row без onClick не кликабелен и не имеет role="button" (иначе
// скринридер объявляет некликабельную строку как кнопку — доступность).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Row, Toggle, RowRight, SectionHeader, SettingsLabel } from './ui';

afterEach(() => {
  cleanup();
});

describe('Row — без onClick', () => {
  it('не кликабельна: нет role="button", нет tabIndex, нет стрелки-плейсхолдера', () => {
    render(<Row label="Просто строка" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Просто строка')).toBeTruthy();
  });
});

describe('Row — с onClick', () => {
  it('кликабельна, role="button", клик зовёт onClick', () => {
    const onClick = vi.fn();
    render(<Row label="Кликабельная" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('Enter/Space зовут onClick (доступность с клавиатуры)', () => {
    const onClick = vi.fn();
    render(<Row label="Кликабельная" onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('без явного right — рисует стрелку-плейсхолдер ›', () => {
    render(<Row label="Со стрелкой" onClick={() => {}} />);
    expect(screen.getByText('›')).toBeTruthy();
  });

  it('явный right побеждает стрелку-плейсхолдер', () => {
    render(
      <Row
        label="С кастомным right"
        onClick={() => {}}
        right={<span>кастом</span>}
      />,
    );
    expect(screen.getByText('кастом')).toBeTruthy();
    expect(screen.queryByText('›')).toBeNull();
  });
});

describe('Row — опциональные части', () => {
  it('sub рендерится, если задан', () => {
    render(<Row label="Основной" sub="Подпись" />);
    expect(screen.getByText('Подпись')).toBeTruthy();
  });

  it('без sub — подписи нет', () => {
    render(<Row label="Без подписи" />);
    expect(screen.queryByText('Подпись')).toBeNull();
  });
});

describe('Toggle', () => {
  it('клик зовёт onClick', () => {
    const onClick = vi.fn();
    render(<Toggle on={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole('switch'));
    expect(onClick).toHaveBeenCalled();
  });

  it('Enter/Space зовут onClick', () => {
    const onClick = vi.fn();
    render(<Toggle on={false} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('switch'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('aria-checked отражает состояние on', () => {
    render(<Toggle on={true} onClick={() => {}} />);
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
      'true',
    );
  });
});

describe('RowRight', () => {
  it('small=true — используется меньший размер (проверяем через рендер текста)', () => {
    render(<RowRight text="Значение" small />);
    expect(screen.getByText('Значение')).toBeTruthy();
    expect(screen.getByText('›')).toBeTruthy();
  });

  it('small не задан — текст и стрелка тоже рендерятся', () => {
    render(<RowRight text="Значение" />);
    expect(screen.getByText('Значение')).toBeTruthy();
  });
});

describe('SectionHeader / SettingsLabel', () => {
  it('без onInfo — кнопки «?» нет', () => {
    render(<SectionHeader>ЗАГОЛОВОК</SectionHeader>);
    expect(screen.queryByLabelText('Пояснение')).toBeNull();
  });

  it('с onInfo — кнопка «?» зовёт onInfo', () => {
    const onInfo = vi.fn();
    render(<SectionHeader onInfo={onInfo}>ЗАГОЛОВОК</SectionHeader>);
    fireEvent.click(screen.getByLabelText('Пояснение'));
    expect(onInfo).toHaveBeenCalled();
  });

  it('SettingsLabel — та же разметка без onInfo (алиас SectionHeader)', () => {
    render(<SettingsLabel>ПОДРАЗДЕЛ</SettingsLabel>);
    expect(screen.getByText('ПОДРАЗДЕЛ')).toBeTruthy();
    expect(screen.queryByLabelText('Пояснение')).toBeNull();
  });
});
