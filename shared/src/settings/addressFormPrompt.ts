// Когда спрашивать форму обращения («ты» или «вы») у того, кто её ещё не
// выбирал. Один модуль на оба фронтенда (правило №3): раньше в каждом лежала
// своя строчка с sessionStorage, и отметка «уже спрашивали» жила ровно одну
// вкладку — человек, нажавший «Позже», видел вопрос при каждом новом открытии.
//
// Источник правды — серверное поле User.addressForm: выбрал = не спрашиваем
// нигде и никогда. Локальная отметка нужна только для «Позже»: она откладывает
// вопрос на неделю, а не прячет его навсегда (иначе форму уже не предложить).

export const ADDRESS_FORM_ASKED_KEY = 'addr_form_asked';
export const ASK_AGAIN_AFTER_DAYS = 7;
const DAY_MS = 86_400_000;

/** Чистая логика: не истёк ли отложенный вопрос. Разбор сырого значения. */
export function isAskSnoozed(raw: string | null, now: number): boolean {
  if (!raw) return false;
  const askedAt = Number(raw);
  if (!Number.isFinite(askedAt) || askedAt <= 0) return false;
  return now < askedAt + ASK_AGAIN_AFTER_DAYS * DAY_MS;
}

/**
 * Спрашивать ли форму обращения сейчас.
 * @param addressForm значение с сервера ('ty' | 'vy' | null)
 */
export function shouldAskAddressForm(
  addressForm: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (addressForm) return false;
  try {
    return !isAskSnoozed(localStorage.getItem(ADDRESS_FORM_ASKED_KEY), now);
  } catch {
    // приватный режим — спросим, выбор всё равно уедет на сервер
    return true;
  }
}

/**
 * Вопрос задан (выбрали форму или нажали «Позже») — отложить на неделю.
 * @returns удалось ли запомнить. false в приватном режиме: выбор формы всё
 * равно уезжает на сервер и закрывает вопрос там, а «Позже» вернётся в
 * следующей сессии — поэтому вызывающему обычно нечего с этим делать, но
 * молча глотать отказ хранилища мы не имеем права (правило «тихих catch»).
 */
export function markAddressFormAsked(now: number = Date.now()): boolean {
  try {
    localStorage.setItem(ADDRESS_FORM_ASKED_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}
