// Каркас /install (docs/design/APP_2026-11.md, b28; принцип 4 — лист-герой + содержимое): знак продукта
// ссылкой на главную сверху, лист небесной бумаги (240, как «Поставить на экран») со сценой SceneHomeScreen
// — значок на экране телефона, рядом шаги установки (InstallBlock) или одна кнопка. На ≥1024 — разворот
// SpreadLayout. Корень — flex: 1 (#root — flex-ряд: без него страница липла к левому краю).
import type { ReactNode } from 'react';
import '../../styles/install-page.css';
import { BrandMark } from '../../components/art/BrandMark';
import { SceneHomeScreen } from '../../components/art/LandingScenesMore';
import { EntitySheet } from '../../components/paper/EntitySheet';
import { SpreadLayout } from '../../components/paper/SpreadLayout';

export function InstallFrame({ title, lead, children }: { title: ReactNode; lead: ReactNode; children: ReactNode }) {
  return (
    <div className="light-lock ip-root">
      <div className="ip-top">
        <a href="/" className="ip-brand" aria-label="На главную" title="На главную">
          <BrandMark size={28} /><span className="ip-brand-name">Всё по схеме</span>
        </a>
      </div>
      <SpreadLayout
        className="ip-main"
        side={<EntitySheet look={{ hue: 240 }} label="Приложение" title={title} titleAs="h1" sub={lead} art={<SceneHomeScreen hue={240} />} className="ip-sheet" />}
      >
        {children}
      </SpreadLayout>
    </div>
  );
}
