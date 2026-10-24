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

  it('глава 6: сессия — 3 000 рублей прописью, редакция от 1 октября 2026 г.', () => {
    render(<OfferPage />);
    // Цена в оферте обязана совпадать с ценой на странице записи
    // (SESSION_DEFAULT_PRICE и BookingSetting) — решение владельца 2026-10-01.
    expect(screen.getByText(/^3 000 \(три тысячи\) рублей, если иная стоимость/)).toBeTruthy();
    expect(screen.queryByText(/четыре тысячи/)).toBeNull();
    expect(screen.getByText('Редакция от 1 октября 2026 г.')).toBeTruthy();
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
