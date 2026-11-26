// Разбор timeZone из декоратора @Cron — для сверки реестра аренд с
// исходниками. Неразобранная зона обязана давать метку, а не undefined:
// иначе сверка молча приняла бы «зону процесса» (правило №15).
import { cronTimeZone } from './cron-source-tz';

const consts = new Map([['POST_TZ', 'Europe/Moscow']]);

describe('cronTimeZone', () => {
  it.each([
    ["@Cron('0 0 * * *'", undefined],
    ["@Cron('0 0 * * *', { name: 'x' }", undefined],
    ["@Cron('0 0 * * *', { timeZone: 'Asia/Tokyo' }", 'Asia/Tokyo'],
    ['@Cron(X, { name: "y", timeZone: "UTC" }', 'UTC'],
    ['@Cron(X, { name: "y", timeZone: POST_TZ }', 'Europe/Moscow'],
    ['@Cron(X, { timeZone: OTHER_TZ }', '<не разобрано>'],
    ['@Cron(X, { timeZone }', '<не разобрано>'],
    ['@Cron(X, { timeZone: zones[0] }', '<не разобрано>'],
  ])('%s → %s', (src, expected) => {
    expect(cronTimeZone(src, consts)).toBe(expected);
  });
});
