import { THERAPIST_MODE_KEY } from '../../../../shared/src/utils/storageKeys';

// Куда ведёт «← Назад» на /account — в дом режима, из которого пришли. Страница
// вне AppShell: терапевт с телефона попадает сюда из кабинета (лист настроек →
// «Аккаунт и способы входа», #902), и возврат в клиентское «Сегодня» — лишний
// прыжок: бутстрап (useBootstrapLoad) тут же вернул бы его в /cabinet. Флаг
// режима пишут useBootstrapLoad и switchTherapistMode: '1' — кабинет, иначе клиент.
export function accountBackPath(flag: string | null): string {
  return flag === '1' ? '/cabinet' : '/today';
}

// То же по флагу из localStorage: ключ общий с писателями — THERAPIST_MODE_KEY.
export const accountBackPathFromStorage = () => accountBackPath(localStorage.getItem(THERAPIST_MODE_KEY));
