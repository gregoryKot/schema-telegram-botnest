// Оболочка входа (docs/design/APP_2026-11.md, b26): лист-герой оттенка экрана и форма. На
// ≥1024 — разворот: герой слева во всю высоту, стык — вертикальный срез бумаги ножницами
// (authCut.ts, без размытия); уже — компактный герой сверху (знак продукта, слоган, картинка
// справа), срез снизу, форма под ним. Один каркас на вход (LoginPage: персик и SceneEntry) и
// 2FA (небо и знак Limits). Страница живёт вне AppShell: корень сам красит экран (light-lock)
// и занимает всю ширину #root (flex-ряд, pageRoots.test.ts).
import type { ReactNode } from 'react';
import { BrandMark } from '../../components/art/BrandMark';
import { hueStyle } from '../../lib/tone';
import { cutPath, cutViewBox } from './authCut';
import '../../styles/auth-login.css';

function AuthCut({ side }: { side: 'right' | 'bottom' }) {
  return (
    <svg className={`al-cut al-cut--${side}`} viewBox={cutViewBox(side)} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="al-cut-under" d={cutPath('under', side)} />
      <path className="al-cut-top" d={cutPath('top', side)} />
    </svg>
  );
}

export function AuthShell({ hue, art, pitch, className, children }: {
  /** Бумага героя: вход — персик 45, 2FA — небо 240. */
  hue: number;
  /** Картинка героя: сцена или знак крупно; размер задаёт слот `.al-hero-art`. */
  art: ReactNode;
  /** Слоган под знаком продукта; без него герой — знак продукта и картинка. */
  pitch?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`light-lock al-root${className ? ` ${className}` : ''}`} style={hueStyle(hue)}>
      <aside className="pp-paper al-hero">
        <a href="/" className="al-brand" aria-label="На главную" title="На главную">
          <BrandMark size={36} className="al-logo" />
          <span className="al-brand-name">Всё по схеме</span>
        </a>
        <div className="al-hero-art" aria-hidden="true">{art}</div>
        {pitch && <div className="al-pitch">{pitch}</div>}
        <AuthCut side="right" />
        <AuthCut side="bottom" />
      </aside>
      <main className="al-side">
        <div className="al-form">{children}</div>
      </main>
    </div>
  );
}
