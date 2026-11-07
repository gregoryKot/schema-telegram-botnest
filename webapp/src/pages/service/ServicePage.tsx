import type { ReactNode } from 'react';
import '../../styles/auth-service.css';
import { BrandMark } from '../../components/art/BrandMark';

// Оболочка служебных страниц входа вне AppShell: корень сам красит экран
// (light-lock), по центру карточка со знаком «Всё по схеме» сверху.
// Обращений к читателю не содержит: часть страниц показывается до входа.
export function ServicePage({ children, width }: { children: ReactNode; width?: number }) {
  return (
    <div className="light-lock as-root">
      <div className="ds-card as-card" style={width ? { maxWidth: width } : undefined}>
        <a href="/" className="as-brand" aria-label="На главную" title="На главную">
          <BrandMark size={28} />
          <span className="as-brand-name">Всё по схеме</span>
        </a>
        {children}
      </div>
    </div>
  );
}
