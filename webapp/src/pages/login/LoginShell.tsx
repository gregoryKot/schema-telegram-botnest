import { lazy, Suspense, type ReactNode } from 'react';
import { AuthShell } from './AuthShell';

// Сцена входа едет своим чанком (сцены приложения — в ленивых чанках, APP_2026-11.md, принцип 11):
// рамка `.al-scene` держит пропорцию холста 320×260 сразу, вёрстка не прыгает, когда рисунок ляжет.
const SceneEntry = lazy(() => import('../../components/art/SceneEntry'));

// Оболочка экрана входа: лист персика со сценой SceneEntry и слоганом, форма — `children`.
// Обращения к читателю в тексте нет: экран показывается до входа, формы ты/вы ещё нет.
export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <AuthShell
      hue={45}
      art={<div className="al-scene"><Suspense fallback={null}><SceneEntry /></Suspense></div>}
      pitch={(
        <>
          <h2 className="al-slogan">
            От «что со мной не так» к <i>«какая схема включилась»</i>
          </h2>
          <p className="al-lead">Инструмент схема-терапии для работы с мыслями, эмоциями и паттернами</p>
        </>
      )}
    >
      {children}
    </AuthShell>
  );
}
