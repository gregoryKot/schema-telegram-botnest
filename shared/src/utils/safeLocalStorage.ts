// Единственный в проекте доступ к localStorage, переживающий отказ хранилища.
//
// Зачем один примитив. Приватный режим Safari, забитая квота и настройка
// «блокировать данные сайтов» роняют ЛЮБОЕ обращение к localStorage — включая
// чтение. Три файла (webapp/auth/clearLocalData, miniapp/utils/homeScreen,
// miniapp/utils/uiPrefsSync) обернули это своим try/catch каждый, то есть
// одна механика написана трижды (CLAUDE.md, «одна механика — один
// компонент»). Здесь она одна и под тестом.
//
// Отказ здесь ничего не скрывает от человека: значения тут — подсказки
// интерфейса (какую форму экрана показать, предлагали ли значок), а не
// сохранённые данные. Худшее следствие — экран покажет вариант для новичка.
// Именно поэтому файл целиком объявлен best-effort в FILE_ALLOW гейта
// scripts/silent-catch-rules.mjs; тот же catch в любом другом файле
// по-прежнему считается долгом (граница проверяется тестом гейта).

/** Значение или null, если хранилище недоступно либо ключа нет. */
export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** true — записалось. false — хранилище недоступно. */
export function writeLocal(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** true — удалилось (или ключа и не было). false — хранилище недоступно. */
export function removeLocal(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
