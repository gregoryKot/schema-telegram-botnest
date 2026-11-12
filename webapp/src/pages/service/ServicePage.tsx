import type { ReactNode } from 'react';
import type { Look } from '../../../../shared/src/theme/entityLook';
import { BrandMark } from '../../components/art/BrandMark';
import { SignArt } from '../../components/art/SignArt';
import { hueStyle } from '../../lib/tone';
import '../../styles/auth-service.css';

// Оболочка рабочих служебных страниц вне AppShell (сверка входа, привязка, объединение, установка):
// белый лист по центру с тенью-слоем тоном бумаги и знаком «Всё по схеме» сверху — ссылкой на главную.
// `look` — полоса бумаги экрана со знаком справа (сверка входа: Limits на небе); без него — шапка
// без картинки. Исходы (готово, отказ, устарело, сбой) рисует не она, а PaperOutcome
// (docs/design/APP_2026-11.md, «Исходы служебных страниц»). Корень сам красит экран (light-lock) и
// занимает всю ширину #root (pageRoots.test.ts). Обращений к читателю нет: часть страниц — до входа.
// Знак — SignArt, не SignHero: оболочку берут страницы главного потока (MergePage), а SignHero тянет
// sceneKit и переставляет CSS-чанки (check-css-link-order).
export function ServicePage({ children, width, look }: { children: ReactNode; width?: number; look?: Look }) {
  return (
    <div className="light-lock as-root" style={hueStyle(look?.hue)}>
      <div className="as-card" style={width ? { maxWidth: width } : undefined}>
        <div className={look ? 'pp-paper as-head as-head--paper' : 'as-head'}>
          <a href="/" className="as-brand" aria-label="На главную" title="На главную">
            <BrandMark size={28} />
            <span className="as-brand-name">Всё по схеме</span>
          </a>
          {look && <span className="as-head-sign" aria-hidden="true"><SignArt sign={look.sign} size="hero" /></span>}
        </div>
        <div className="as-main">{children}</div>
      </div>
    </div>
  );
}
