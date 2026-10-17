import type { ReactNode } from 'react';
import '../../styles/auth-service.css';

// Оболочка служебных страниц входа вне AppShell: корень сам красит экран
// (light-lock), по центру карточка со знаком «Всё по схеме» сверху.
// Обращений к читателю не содержит: часть страниц показывается до входа.
export function ServicePage({ children, width }: { children: ReactNode; width?: number }) {
  return (
    <div className="light-lock as-root">
      <div className="ds-card as-card" style={width ? { maxWidth: width } : undefined}>
        <div className="as-brand">
          <div className="as-logo">В</div>
          <span className="as-brand-name">Всё по схеме</span>
        </div>
        {children}
      </div>
    </div>
  );
}
