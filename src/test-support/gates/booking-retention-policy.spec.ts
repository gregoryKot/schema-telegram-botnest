// Срок обезличивания броней обещан в ТРЁХ местах, и они обязаны совпадать.
//
// `BOOKING_PII_RETENTION_MONTHS` — то, что код делает на самом деле. Политика
// конфиденциальности (`webapp/src/pages/PrivacyPage.tsx`, глава «Сроки
// хранения») и список невыданного в выгрузке данных
// (`src/account/data-export.service.ts`) — то, что продукт обещает человеку.
// Разъехаться они могут молча и в самую неприятную сторону: константу правит
// бэкенд-PR, а юридический документ живёт в другом пакете, и никакой гейт на
// него не смотрит (тот же класс слепой зоны, что у статики вне `src/` —
// правило №14). Обещание «12 месяцев» при фактических 36 — это не опечатка,
// а неверное раскрытие сроков обработки по 152-ФЗ.
//
// Поэтому пин, а не регэксп по словам «срок хранения»: класс живёт в МЕСТЕ
// (правило №4 — два реестра, обязанных совпадать, фиксируются тестом, который
// падает при рассинхроне). Поменял срок — правь оба текста в том же PR.
import { readFileSync } from 'fs';
import { join, resolve } from 'path';
import { BOOKING_PII_RETENTION_MONTHS } from '../../booking/booking-retention.service';

const ROOT = resolve(__dirname, '..', '..', '..');

const PRIVACY_PAGE = 'webapp/src/pages/PrivacyPage.tsx';
const EXPORT_SERVICE = 'src/account/data-export.service.ts';

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

// «месяц» без окончания: 12 → «месяцев», 2 → «месяца», 1 → «месяц». Пин ловит
// расхождение ЧИСЛА, а не падает на русской морфологии.
const TERM = `${BOOKING_PII_RETENTION_MONTHS} месяц`;

describe('срок обезличивания броней: код ↔ обещания продукту', () => {
  it('константа — целое число месяцев больше нуля', () => {
    expect(Number.isInteger(BOOKING_PII_RETENTION_MONTHS)).toBe(true);
    expect(BOOKING_PII_RETENTION_MONTHS).toBeGreaterThan(0);
  });

  it(`${PRIVACY_PAGE}: политика называет тот же срок`, () => {
    const text = read(PRIVACY_PAGE);
    // Строка таблицы «Сроки хранения» про данные формы записи — она и обещает
    // срок человеку, который записался на консультацию.
    expect(text).toContain('Данные формы записи');
    expect(text).toContain(TERM);
  });

  it(`${EXPORT_SERVICE}: причина невыдачи называет тот же срок`, () => {
    const text = read(EXPORT_SERVICE);
    // WITHHELD_OUT_OF_CONTOUR: человек получает выгрузку и читает, почему
    // брони в неё не попали — там же он узнаёт, когда они сотрутся.
    expect(text).toContain('WITHHELD_OUT_OF_CONTOUR');
    expect(text).toContain(TERM);
  });

  it('контрольный образец: срок не совпал бы — пин краснеет', () => {
    // Иначе тест ничего не доказывает: проверяем, что совпадение не случайно,
    // а именно по числу из константы (правило №15 п.2).
    const other = `${BOOKING_PII_RETENTION_MONTHS + 1} месяц`;
    expect(read(PRIVACY_PAGE)).not.toContain(other);
    expect(read(EXPORT_SERVICE)).not.toContain(other);
  });
});
