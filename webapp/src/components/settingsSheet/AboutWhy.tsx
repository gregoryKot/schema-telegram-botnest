// Развёрнутое «О приложении»: «зачем это всё» и пять потребностей. Текст общий
// (shared/about/aboutData). У потребности — её знак (NeedArt), а не эмодзи: поле emoji в данных
// остаётся, здесь не рисуется. Id потребности — по порядку NEED_ORDER: NEEDS_EXPLAINER — массив без id
// в том же порядке (та же пара в shared/src/portrait/portraitTexts.ts).
import { useAddressForm } from '../../utils/addressForm';
import { getAboutText, NEEDS_EXPLAINER } from '../../../../shared/src/about/aboutData';
import { NEED_ORDER } from '../../../../shared/src/needs/types';
import { glueSpaces } from '../../../../shared/src/utils/typo';
import { NeedArt } from '../art/NeedArt';

export function AboutWhy() {
  const paragraphs = getAboutText(useAddressForm());
  return (
    <div className="st-about-why">
      {paragraphs.map((p, i) => (
        <p key={i} className="st-about-p">{glueSpaces(p)}</p>
      ))}
      <div className="ds-label st-needs-label">Пять потребностей</div>
      <ul className="st-needs">
        {NEEDS_EXPLAINER.map((n, i) => (
          <li key={n.name} className="st-need" data-need={NEED_ORDER[i]}>
            <span className="pp-row-art" aria-hidden="true"><NeedArt id={NEED_ORDER[i]} size="row" /></span>
            <div className="st-need-body">
              <div className="st-need-name">{n.name}</div>
              <p className="st-text">{glueSpaces(n.text)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
