// Контроль хелпера: маркер находится и в тексте, и в разметке кнопок, а чистая
// карточка проходит — иначе тесты карточек владельцу молча пропускали бы утечку.
import { PII, expectNoMarkers, findMarkers } from './pii-markers';

describe('pii-markers', () => {
  it('находит маркер и производную форму пояса (город, «у клиента»)', () => {
    expect(findMarkers(`👤 ${PII.name}`)).toEqual([PII.name]);
    expect(findMarkers(`tg:${PII.telegramId}`)).toEqual([
      String(PII.telegramId),
    ]);
    expect(findMarkers('у клиента 19:00 (Бангкок, UTC+7)')).toEqual([
      'Бангкок',
      'у клиента',
    ]);
  });

  it('маркер в кнопках роняет проверку так же, как в тексте', () => {
    const markup = {
      inline_keyboard: [[{ text: 'ok', callback_data: PII.email }]],
    };
    expect(() => expectNoMarkers('🩺 Заявка #5', markup)).toThrow();
    expect(() => expectNoMarkers(`💬 ${PII.message}`)).toThrow();
  });

  it('чистая карточка проходит', () => {
    const markup = {
      inline_keyboard: [[{ text: '✅', callback_data: 'treq:approve:5' }]],
    };
    expect(() => expectNoMarkers('🩺 Заявка #5', markup)).not.toThrow();
  });
});
