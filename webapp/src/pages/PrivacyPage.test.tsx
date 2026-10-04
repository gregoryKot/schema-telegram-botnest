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

// D-4 / D-11 (аудит 2026-10): политика называет всех получателей данных и
// честно описывает, где работает счётчик. Список — privacy/processors.ts.
describe('PrivacyPage — получатели данных', () => {
  it('называет Telegram, Google, Resend, iCloud, Zoom и Яндекс Метрику с назначением', () => {
    render(<PrivacyPage />);
    for (const name of ['Telegram (Telegram', 'Google LLC', 'Resend', 'Apple iCloud', 'Zoom', 'Яндекс Метрика (ООО']) {
      expect(screen.getAllByText(new RegExp(name.replace(/[()]/g, '\\$&'))).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/ссылки для входа и восстановления доступа/)).toBeTruthy();
    expect(screen.getByText(/календарь Оператора/)).toBeTruthy();
    expect(screen.getByText(/создание ссылки на видеовстречу/)).toBeTruthy();
  });

  it('про Метрику: только публичные страницы, в приложении и кабинете счётчик не работает', () => {
    render(<PrivacyPage />);
    expect(screen.getAllByText(/В приложении и личном кабинете счётчик не работает/).length).toBeGreaterThan(0);
    // Старое обещание «тепловые карты» снято — карта кликов выключена.
    expect(screen.getByText(/Тепловые карты кликов и отслеживание переходов по ссылкам отключены/)).toBeTruthy();
  });
});
