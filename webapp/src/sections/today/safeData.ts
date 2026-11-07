// Ответы API, которые по контракту массивы. При сбое сервер или прокси может
// отдать `{}`/null — тогда экран «Сегодня» показывает пусто, а не падает
// с «e is not iterable» (пользователь видел сырую страницу ошибки роутера).

export function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}
