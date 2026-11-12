import type { CSSProperties } from 'react';
import { glue } from '../../../../shared/src/utils/typo';
import type { InstallPlatform } from '../../utils/pwaInstall';
import { INSTALL_STEPS } from './installSteps';
import { StepText } from '../NavGlyphs';

// Шаги «значок на экран» карточками — одна механика на лендинг (AppInstallSection: три платформы рядом)
// и /install (InstallPage: шаги своей платформы). Текст — из INSTALL_STEPS, строки склеены glue (короткое
// слово не висит). Вид задаёт место: на лендинге — его карточки pl2-* (раскладка лендинга не меняется),
// на /install — лист небесной бумаги (240, как «Поставить на экран») с номерами шагов (install-page.css).
type Look = 'landing' | 'page';

const CLS: Record<Look, { card: string; title: string; meta: string; list: string }> = {
  landing: { card: 'ds-card pl2-card pl2-install', title: 'pl2-card-title', meta: 'pl2-card-meta', list: 'pl2-card-list' },
  page: { card: 'pp-paper ib-card', title: 'ib-title', meta: 'ib-meta', list: 'ib-steps' },
};
const PAGE_HUE = { '--h': 240 } as CSSProperties;

export function InstallBlock({ platforms, look }: { platforms: readonly InstallPlatform[]; look: Look }) {
  const c = CLS[look];
  return (
    <>
      {platforms.map((p) => {
        const b = INSTALL_STEPS[p];
        return (
          <div key={p} className={c.card} style={look === 'page' ? PAGE_HUE : undefined}>
            <p className={c.title}>{b.title}</p>
            <p className={c.meta}>{b.browser}</p>
            <ol className={c.list}>
              {b.steps.map((s) => <li key={s}><StepText text={s} fmt={glue} /></li>)}
            </ol>
          </div>
        );
      })}
    </>
  );
}
