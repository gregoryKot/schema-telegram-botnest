// Продолжение реестра решений о шифровании: сущности, у которых нет владельца
// среди пользователей, — бронирование и деньги, контент проекта, инфраструктура.
// Отдельным файлом по правилу №10: реестр рос вместе с продуктом и пробил
// потолок 300 строк, а дробить данные по смыслу честнее, чем заводить
// исключение из храповика (правило №15).
import { Policy, enc, plain, ID, TOKEN } from './encryption-policy';

export const INFRA_FIELD_POLICY: Record<string, Record<string, Policy>> = {
  AvailabilityRule: { timezone: ID },
  Booking: {
    clientName: enc('src/booking/booking.service.ts'),
    clientContact: enc('src/booking/booking.service.ts'),
    message: enc('src/booking/booking.service.ts'),
    cancelToken: TOKEN,
    meetingUrl: plain('ссылка на Zoom/Телемост, задаётся терапевтом'),
    calDavUid: ID,
    source: plain(
      'страница + referrer при брони — структурная атрибуция лида, не PII',
    ),
  },
  ClientMeeting: {
    clientKey: plain('sha256 от контакта — уже псевдонимизирован'),
    meetingUrl: plain('переиспользуемая ссылка на встречу'),
    zoomMeetingId: ID,
  },
  BookingSetting: {
    key: ID,
    value: plain('настройки модуля записи (цены и т.п.)'),
  },
  Donation: {
    source: ID,
    email: enc('src/donation/donation.service.ts'),
    comment: enc('src/donation/donation.service.ts'),
  },
  Subscription: {
    period: ID,
    email: enc('src/subscription/subscription.service.ts'),
    cancelToken: TOKEN,
  },
  Article: {
    slug: ID,
    title: plain('публичный контент сайта'),
    description: plain('публичный контент сайта'),
    content: plain('публичный контент сайта'),
    heroImage: ID,
    diagramKey: ID,
  },
  HealthyAdultPhrase: { text: plain('контент проекта, не данные юзера') },
  HealthyAdultPost: {
    text: plain('контент проекта, не данные юзера'),
    source: plain('контент проекта, не данные юзера'),
  },
  ChannelDelivery: {
    source: plain('слот публикации: утро/вечер/вручную/проверка'),
    platform: plain('ключ площадки: telegram/vk/max'),
    destination: plain('id канала проекта, не пользовательские данные'),
    reason: plain(
      'текст ошибки площадки — техническая диагностика, не данные юзера',
    ),
    text: plain('фраза канала — контент проекта, не данные юзера'),
  },
  CronLease: {
    name: plain('имя расписания (midnightPlanner и т.п.), не данные юзера'),
    instanceId: plain(
      'имя процесса-лидера из HOSTNAME — нужно, чтобы по строке было видно, ' +
        'какой инстанс забрал прогон; пользователя в ней нет',
    ),
  },
};
