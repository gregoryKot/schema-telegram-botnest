import type { ReactNode } from 'react';
import { GlyphArrowLeft } from '../ExGlyphs';
import { SignArt } from '../../art/SignArt';
import { ExHint, ExHintText } from '../ExHint';
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

/** Подсказка вопросов карточки — общая ExHint упражнений: на ≥1024 раскрыта в колонке разворота под
 *  листом, на телефоне — свёрнутой строкой до поля, шапка до поля не растёт (принцип 5). Пояснение «что
 *  это за карточка» — только на первом вопросе: на ≥1024 над подсказкой, на телефоне — после формы
 *  (ex-cards.css), как у мастера дневника. */
export function CardAside({ explainer, eyebrow, title, text }: {
  explainer?: string; eyebrow: string; title: ReactNode; text: ReactNode;
}) {
  return (
    <>
      {explainer && <p className="sd-explainer">{glue(explainer)}</p>}
      <ExHint label={eyebrow} title={title}><ExHintText>{text}</ExHintText></ExHint>
    </>
  );
}
