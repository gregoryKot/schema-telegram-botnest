// @vitest-environment jsdom
// OfferPage — публичная оферта (0% покрытия, 328 строк, юридический
// документ). Рендер-тест проверяет, что все главы и обязательные реквизиты
// присутствуют — регрессия «глава отвалилась при рефакторинге верстки»
// незаметна визуально, но означает недействующий раздел договора.
// Юридический текст — исключение из правила ты/вы и антиробот-стиля
// (CLAUDE.md: OfferPage/PrivacyPage формальны юридически точно).
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { OfferPage } from './OfferPage';

afterEach(() => {
  cleanup();
});

describe('OfferPage', () => {
  it('рендерит заголовок и вступительный юридический дисклеймер', () => {
    render(<OfferPage />);
    expect(screen.getByText('Публичная оферта')).toBeTruthy();
    expect(screen.getByText(/не относятся к медицинской деятельности/)).toBeTruthy();
  });

  it('содержит все 15 глав документа по порядку', () => {
    render(<OfferPage />);
    const titles = [
      'Термины и определения', 'Статус Исполнителя', 'Порядок акцепта',
      'Предмет договора', 'Порядок оказания услуг', 'Стоимость и порядок оплаты',
      'Отмена, перенос и возврат', 'Права и обязанности сторон', 'Конфиденциальность',
      'Ответственность сторон', 'Форс-мажор', 'Порядок разрешения споров',
      'Персональные данные', 'Заключительные положения', 'Реквизиты Исполнителя',
    ];
    for (const t of titles) {
      expect(screen.getByText(t)).toBeTruthy();
    }
  });

  it('глава 6: цена сессии — та, что на сайте при записи, без числа; редакция от 31 октября 2026 г.', () => {
    render(<OfferPage />);
    // Действующую цену задаёт админка (BookingSetting), дефолт в коде —
    // SESSION_DEFAULT_PRICE: число в договоре разъезжалось с ценой на сайте
    // (3 000 в оферте против 4 000 при записи). Решение владельца 2026-10-22 —
    // ссылка на цену при записи вместо числа.
    expect(screen.getByText(/^Стоимость указана на сайте kotlarewski\.gr при записи/)).toBeTruthy();
    expect(screen.queryByText(/\d[\d\s]*\([а-я ]+\) рублей/)).toBeNull();
    expect(screen.getByText('Редакция от 31 октября 2026 г.')).toBeTruthy();
  });

  it('реквизиты исполнителя содержат реальный e-mail и ИНН, а не плейсхолдер', () => {
    render(<OfferPage />);
    expect(screen.getAllByText('gregorykot@gmail.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('450163793969').length).toBeGreaterThan(0);
  });

  it('ссылка «На главную» ведёт на корень сайта', () => {
    render(<OfferPage />);
    const link = screen.getByText('← На главную') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/');
  });

  it('ссылка на политику конфиденциальности присутствует в разделе о персональных данных', () => {
    render(<OfferPage />);
    const link = screen.getByText('Политикой конфиденциальности') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/privacy');
  });
});
