// bookingCardText — уведомление админу о брони. Проверяем добавку из
// clientTimeZone: без пояса/с московским поясом карточка выглядит как
// раньше (только МСК), с непустым не-московским поясом строка времени несёт
// и время клиента.
import { bookingCardText } from './booking-notify.format';

// 30 сент. 12:00 UTC = 15:00 МСК = 19:00 в Бангкоке.
const startsAt = new Date('2026-09-30T12:00:00Z');

function card(clientTimeZone?: string | null) {
  return {
    clientName: 'Иван',
    clientContact: '@ivan',
    startsAt,
    message: null,
    clientTimeZone,
  };
}

describe('bookingCardText — часовой пояс клиента', () => {
  it('без пояса — как раньше, только МСК', () => {
    const text = bookingCardText('Заголовок', card(undefined));
    expect(text).toContain('15:00 МСК');
    expect(text).not.toContain('у клиента');
  });

  it('пояс совпадает с московским — тоже только МСК, дублировать незачем', () => {
    const text = bookingCardText('Заголовок', card('Europe/Moscow'));
    expect(text).toContain('15:00 МСК');
    expect(text).not.toContain('у клиента');
  });

  it('невалидный пояс — не бросает, ведёт себя как «без пояса»', () => {
    const text = bookingCardText('Заголовок', card('мусор'));
    expect(text).toContain('15:00 МСК');
    expect(text).not.toContain('у клиента');
  });

  it('пояс отличается от московского — обе строки времени', () => {
    const text = bookingCardText('Заголовок', card('Asia/Bangkok'));
    expect(text).toContain('15:00 МСК');
    expect(text).toContain('у клиента 19:00 (Бангкок, UTC+7)');
  });

  it('пустое состояние: карточка без источника/сообщения/ссылки не рисует мусор', () => {
    const text = bookingCardText('Заголовок', {
      clientName: 'Иван',
      clientContact: '@ivan',
      startsAt,
      message: null,
    });
    expect(text).not.toMatch(/undefined|null|NaN/);
  });

  it('сохраняет прочие поля карточки (сообщение, источник)', () => {
    const text = bookingCardText('Заголовок', {
      clientName: 'Иван',
      clientContact: '@ivan',
      startsAt,
      message: 'Хочу разобраться с тревогой',
      source: 'landing',
      clientTimeZone: 'Asia/Seoul',
    });
    expect(text).toContain('💬 Хочу разобраться с тревогой');
    expect(text).toContain('🧭 Откуда: landing');
    expect(text).toContain('у клиента');
  });
});
