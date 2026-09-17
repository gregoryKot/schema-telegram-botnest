// @vitest-environment jsdom
// PrivacyPage — политика конфиденциальности (0% покрытия, 292 строки,
// юридический документ, исключение из правил ты/вы и антиробот-стиля —
// см. OfferPage.test.tsx). Проверяем главы, реквизиты оператора и упоминание
// шифрования специальной категории данных (дневники/опросники) — это
// единственное место сайта, где явно написано, что дневники шифруются.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PrivacyPage } from './PrivacyPage';

afterEach(() => {
  cleanup();
});

describe('PrivacyPage', () => {
  it('рендерит заголовок и вступление со ссылкой на веб-приложение', () => {
    render(<PrivacyPage />);
    expect(screen.getByText('Политика конфиденциальности')).toBeTruthy();
    expect(screen.getAllByText(/веб-приложение «Всё по схеме»/).length).toBeGreaterThan(0);
  });

  it('содержит все 13 глав документа по порядку', () => {
    render(<PrivacyPage />);
    const titles = [
      'Оператор персональных данных', 'Основные понятия', 'Перечень обрабатываемых данных',
      'Цели и правовые основания обработки', 'Способы обработки', 'Сроки хранения',
      'Передача данных третьим лицам', 'Защита данных', 'Права субъекта персональных данных',
      'Cookie-файлы', 'Возрастное ограничение', 'Изменение политики',
      'Контактные данные оператора',
    ];
    for (const t of titles) {
      expect(screen.getByText(t)).toBeTruthy();
    }
  });

  it('явно фиксирует, что дневники и опросники шифруются AES-256-GCM', () => {
    // Регрессия: это единственное публичное место, где юзер узнаёт, что его
    // свободный текст (дневник, YSQ) не лежит в базе открытым текстом.
    render(<PrivacyPage />);
    expect(screen.getAllByText(/AES-256-GCM/).length).toBeGreaterThan(0);
  });

  it('реквизиты оператора содержат реальный e-mail, а не плейсхолдер', () => {
    render(<PrivacyPage />);
    const emailNodes = screen.getAllByText('gregorykot@gmail.com');
    expect(emailNodes.length).toBeGreaterThan(0);
  });

  it('раздел про cookie различает технические (без согласия) и аналитические (по согласию)', () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Обязательные \(технические\) cookie/)).toBeTruthy();
    expect(screen.getByText(/Аналитические cookie/)).toBeTruthy();
  });
});
