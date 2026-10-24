import type { CSSProperties, ReactNode } from 'react';
import { AddHomeScreenButton as SharedAddHomeScreenButton } from '../../../shared/src/host/AddHomeScreenButton';

// Кнопка «добавить значок на экран»: механика (Android — нативный вызов, iOS —
// настоящая ссылка на прыжковую страницу) живёт в shared/src/host/AddHomeScreenButton.tsx
// и общая с сайтом; здесь только вид мини-аппа.
export function AddHomeScreenButton(props: {
  children: ReactNode;
  /** Побочные действия при активации (снуз, аналитика, согласие). */
  onActivated?: () => void;
  style?: CSSProperties;
}) {
  return (
    <SharedAddHomeScreenButton
      className="btn-primary"
      linkStyle={{ display: 'block', textAlign: 'center' }}
      {...props}
    />
  );
}
