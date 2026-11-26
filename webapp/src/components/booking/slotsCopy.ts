// Форма обращения в выборе слота (BookingSlotsSection, TimeZonePicker). Визитка
// публичная и говорит «вы» всем — это значение по умолчанию; запись клиента из
// приложения (#546) передаёт useTr() пользователя, у которого может быть «ты».
export type Tr = (ty: string, vy: string) => string;

export const VY: Tr = (_ty, vy) => vy;
