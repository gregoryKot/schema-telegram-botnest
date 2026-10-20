import { api } from '../api';
import type { UserSettings } from '../api';

// Стартовые потребители настроек (форма обращения, окно «ты/вы», синхронизация
// экранов) просят GET /api/settings в одном проходе эффектов одного рендера —
// отдаём им один запрос на всех. Окно общего запроса — до конца текущей
// микрозадачи (эффекты одного коммита React выполняет подряд, синхронно): любой
// более поздний вызов идёт на сервер заново, поэтому изменённые позже настройки
// не залипают, а зависший запрос не раздаётся последующим вызовам.
let shared: Promise<UserSettings> | null = null;

export function loadSettingsShared(): Promise<UserSettings> {
  if (!shared) {
    shared = api.getSettings();
    queueMicrotask(() => {
      shared = null;
    });
  }
  return shared;
}
