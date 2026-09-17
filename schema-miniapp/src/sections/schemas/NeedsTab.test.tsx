// @vitest-environment jsdom
// NeedsTab — вкладка «Потребности» каталога (0% покрытия): список пяти
// базовых потребностей + подсказка «Колесо детства» / «Изменить ответы».
// Своя логика — переключение баннера по hasChildhood и клики открывают
// правильный обработчик (needId/childhoodWheel), это и проверяем.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NeedsTab } from './NeedsTab';

afterEach(cleanup);

describe('NeedsTab — баннер «Колесо детства»', () => {
  it('без childhoodRatings показывает приглашение пройти колесо детства', () => {
    render(
      <NeedsTab
        childhoodRatings={{}}
        onOpenChildhoodWheel={() => {}}
        onOpenNeedDetail={() => {}}
      />,
    );
    expect(screen.getByText('Колесо детства')).toBeTruthy();
    expect(screen.queryByText('Изменить ответы →')).toBeNull();
  });

  it('с реальными ответами баннер меняется на «Изменить ответы»', () => {
    render(
      <NeedsTab
        childhoodRatings={{ attachment: 6 }}
        onOpenChildhoodWheel={() => {}}
        onOpenNeedDetail={() => {}}
      />,
    );
    expect(screen.queryByText('Колесо детства')).toBeNull();
    expect(screen.getByText('Изменить ответы →')).toBeTruthy();
  });

  it('клик по приглашающему баннеру вызывает onOpenChildhoodWheel', () => {
    const onOpen = vi.fn();
    render(
      <NeedsTab
        childhoodRatings={{}}
        onOpenChildhoodWheel={onOpen}
        onOpenNeedDetail={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Колесо детства'));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

describe('NeedsTab — список пяти базовых потребностей', () => {
  it('рендерит все пять потребностей по названиям из needData', () => {
    render(<NeedsTab childhoodRatings={{}} onOpenNeedDetail={() => {}} />);
    for (const name of [
      'Привязанность',
      'Автономия',
      'Выражение чувств',
      'Спонтанность',
      'Границы',
    ]) {
      expect(screen.getByText(name)).toBeTruthy();
    }
  });

  it('клик по строке потребности открывает её детальную карточку по id', () => {
    const onOpenNeedDetail = vi.fn();
    render(
      <NeedsTab childhoodRatings={{}} onOpenNeedDetail={onOpenNeedDetail} />,
    );
    fireEvent.click(screen.getByText('Привязанность'));
    expect(onOpenNeedDetail).toHaveBeenCalledWith('attachment');
  });

  it('без детской оценки конкретной потребности показывает шеврон, а не выдуманное число', () => {
    render(<NeedsTab childhoodRatings={{}} onOpenNeedDetail={() => {}} />);
    // Правило «никаких хардкод-заглушек»: нет числа — нет строки «детство».
    expect(screen.queryByText('детство')).toBeNull();
  });

  it('с детской оценкой показывает именно сохранённое число, а не подставное', () => {
    render(
      <NeedsTab
        childhoodRatings={{ attachment: 8 }}
        onOpenNeedDetail={() => {}}
      />,
    );
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText('детство')).toBeTruthy();
  });
});
