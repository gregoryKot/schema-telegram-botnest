import type { ReactNode } from 'react';
import { GlyphArrowLeft } from '../ExGlyphs';
import { SignArt } from '../../art/SignArt';
import { DiaryAside } from '../../diary/DiaryStepCard';
import type { SignKey } from '../../../../../shared/src/theme/entityLook';
import { glue } from '../../../../../shared/src/utils/typo';

/** Тихие ссылки внизу листа-героя карточки (ExScreen heroFoot, как «Сменить режим» дневника режимов):
 *  «Сменить схему/режим» и «Про режим» — знаком группы режима вместо глифа ⓘ. */
export function CardHeroLinks({ changeLabel, onChange, about }: {
  changeLabel: string; onChange: () => void; about?: { sign?: SignKey; onClick: () => void };
}) {
  return (
    <div className="sd-mode-links">
      <button type="button" className="ds-link sd-mode-link" onClick={onChange}><GlyphArrowLeft /> {changeLabel}</button>
      {about && (
        <button type="button" className="ds-link sd-mode-link ex2-about-link" onClick={about.onClick}>
          {about.sign && <SignArt sign={about.sign} size="nav" />}Про режим
        </button>
      )}
    </div>
  );
}

/** Подсказка вопросов карточки — как у мастера дневника (DiaryAside): на ≥1024 в колонке разворота
 *  под листом, на телефоне — после формы (diary-wizard.css, «Разворот мастера»), шапка до поля не
 *  растёт. Пояснение «что это за карточка» — только на первом вопросе. */
export function CardAside({ explainer, hue, eyebrow, title, text }: {
  explainer?: string; hue: number; eyebrow: string; title: ReactNode; text: ReactNode;
}) {
  return (
    <>
      {explainer && <p className="sd-explainer">{glue(explainer)}</p>}
      <DiaryAside hue={hue} eyebrow={eyebrow} title={title} text={text} />
    </>
  );
}
