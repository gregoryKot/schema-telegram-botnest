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

  it('называет срок обезличивания данных формы записи', () => {
    // Обещание документа обязано совпадать с кодом: срок затирания имени,
    // контакта и текста запроса задан в booking-retention.service.ts, и
    // расхождение между ним и этой строкой ловит отдельный пин
    // (src/test-support/gates/booking-retention-policy.spec.ts). Здесь —
    // что строка в документе вообще есть и называет срок.
    render(<PrivacyPage />);
    expect(screen.getAllByText(/через 12 месяцев после даты консультации/).length).toBeGreaterThan(0);
    // Заявка с формы знакомства без консультации обезличивается по дате подачи
    // (src/booking/intro-lead-retention.service.ts, отсчёт от createdAt).
    expect(screen.getAllByText(/или подачи заявки, если консультации не было/).length).toBeGreaterThan(0);
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
  it('называет Telegram, Yandex Cloud Postbox, Yandex Object Storage, Яндекс ID и Яндекс Метрику с назначением', () => {
    render(<PrivacyPage />);
    for (const name of [
      'Telegram (Telegram', 'Yandex Cloud Postbox (ООО «Яндекс.Облако»)', 'Yandex Object Storage (ООО «Яндекс.Облако»)',
      'Яндекс ID (ООО «Яндекс»)', 'Яндекс Метрика (ООО',
    ]) {
      expect(screen.getAllByText(new RegExp(name.replace(/[()]/g, '\\$&'))).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/ссылки для входа и восстановления доступа/)).toBeTruthy();
  });

  // Запрос РКН №08-1063539 (2026-11): письма шлёт российский Yandex Cloud
  // Postbox, вход через Яндекс ID — тоже российский сервис. Оба стоят
  // отдельным перечнем после иностранных и до статистики; Resend не назван.
  it('российские сервисы — отдельный перечень: не трансграничная передача; слова «Resend» на странице нет', () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Российские сервисы. Письма и вход через Яндекс работают на серверах в России и трансграничной передачей не являются:');
    expect(text).not.toMatch(/resend|plus five five/i);
    const order = ['Трансграничная передача данных.', 'Telegram (Telegram', 'Видеовстреча консультации проходит в сервисе Zoom',
      'Российские сервисы.', 'Yandex Cloud Postbox', 'Yandex Object Storage (ООО', 'Яндекс ID (ООО', 'Статистика посещений.'].map((s) => text.indexOf(s));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Иностранный перечень (первый список главы 7 после «Трансграничная…») российских сервисов не содержит.
    const foreign = text.slice(order[0], order[2]);
    expect(foreign).not.toMatch(/Postbox|Яндекс ID/);
  });

  it('способы входа: п. 3.2 и гл. 8 называют VK ID и Яндекс ID', () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Идентификатор способа входа: адрес электронной почты, идентификатор VK ID, Яндекс ID или MAX; идентификатор Telegram – у тех, кто открывает приложение внутри Telegram');
    expect(text).toContain('Беспарольная аутентификация: на сайте – вход по ссылке из письма, через VK ID или Яндекс ID, внутри MAX и Telegram – по подписи мессенджера; пароли не создаются и не хранятся');
  });

  // Запрос РКН №08-1063539 (2026-11): iCloud и Zoom данных клиента не получают,
  // вход через Telegram на сайте убран — политика говорит то, что делает код.
  it('Zoom и iCloud — без данных клиента; способы входа на сайте — почта, VK ID и Яндекс ID', () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('не передаёт сервису имя, контакт или иные данные клиента');
    expect(text).toContain('В календарь Оператора (Apple iCloud) попадают только время и вид записи');
    expect(text).not.toMatch(/имя клиента в названии встречи|имя, контакт, текст обращения и время встречи/);
    expect(text).toContain('на сайте – вход по ссылке из письма, через VK ID или Яндекс ID, внутри MAX и Telegram – по подписи мессенджера');
    expect(text).toContain('идентификатор Telegram – у тех, кто открывает приложение внутри Telegram');
    expect(text).not.toMatch(/вход через Telegram или OAuth-провайдера/);
    expect(text).toContain('для входа на сайт не используется');
  });

  it('про Метрику: только публичные страницы, в приложении и кабинете счётчик не работает', () => {
    render(<PrivacyPage />);
    expect(screen.getAllByText(/В приложении и личном кабинете счётчик не работает/).length).toBeGreaterThan(0);
    // Старое обещание «тепловые карты» снято — карта кликов выключена.
    expect(screen.getByText(/Тепловые карты кликов и отслеживание переходов по ссылкам отключены/)).toBeTruthy();
  });
});

// Сверка 2026-10-22: документ совпадает с тем, что делает сайт.
describe('PrivacyPage — бэкапы и cookie', () => {
  it('резервные копии: хранятся в России (Yandex Object Storage), зашифрованы, не дольше 30 дней', () => {
    // Срок держит scripts/backup-upload.sh (потолок BACKUP_RETENTION_MAX_DAYS);
    // число с кодом сверяет src/test-support/gates/backup-retention-policy.spec.ts.
    render(<PrivacyPage />);
    expect(screen.getByText(/зашифрованные резервные копии базы данных \(Yandex Object Storage\) хранятся на серверах\s+на территории Российской Федерации/)).toBeTruthy();
    expect(document.body.textContent ?? '').not.toMatch(/Cloudflare/i);
    expect(screen.getByText(/Резервные копии базы данных хранятся в\s+зашифрованном виде не дольше 30 дней/)).toBeTruthy();
  });

  it('cookie — только те, что ставит бэкенд; удалённых нет', () => {
    // tg_pkce_verifier ставил вход /api/auth/telegram-oidc, удалённый в #725;
    // сессионной cookie нет вовсе — токен доступа живёт в памяти страницы.
    render(<PrivacyPage />);
    expect(screen.queryByText(/tg_pkce_verifier/)).toBeNull();
    expect(screen.queryByText(/Сессионные cookie/)).toBeNull();
    expect(screen.getByText('Refresh-token cookie (refresh_token, refresh_cross)')).toBeTruthy();
    expect(screen.getByText('Cookie шагов входа (oauth_state, vk_pkce, link_token, login_ticket)')).toBeTruthy();
    // Билет входа и PKCE VK (аудит 2026-11, S9 и S21): назначение и срок названы.
    expect(screen.getByText(/login_ticket – хеш кода устройства, начавшего вход по билету, живёт 5 минут/)).toBeTruthy();
    expect(screen.getByText(/vk_pkce – проверка входа через VK ID, живёт 10 минут/)).toBeTruthy();
  });
});

// Вход через Google убран (2026-11, запрос РКН №08-1063539): страница входа к
// Google не обращается, cookie g_state не ставится — политика их не называет.
describe('PrivacyPage — входа через Google нет', () => {
  it('ни получателя Google, ни его cookie в тексте политики', () => {
    const { container } = render(<PrivacyPage />);
    expect(container.textContent).not.toMatch(/Google|g_state|gsi_nonce/);
  });
});

describe('PrivacyPage — сверка с уведомлениями РКН (2026-11-07)', () => {
  it('показывает номер в реестре операторов, учёт услуг ссылается на п. 2 ч. 1 ст. 6', () => {
    const { container } = render(<PrivacyPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('77-26-561994');
    expect(text).toContain('п. 2 ч. 1 ст. 6');
    expect(text).not.toContain('п. 3 ч. 1 ст. 6');
  });
});
