// Развёрнутое «О приложении» на сайте — паритет с мини-аппом (AboutSheet):
// «зачем это всё» и пять потребностей. Текст общий (shared/about/aboutData).
import { useAddressForm } from '../../utils/addressForm';
import { getAboutText, NEEDS_EXPLAINER } from '../../../../shared/src/about/aboutData';

export function AboutWhy() {
  const paragraphs = getAboutText(useAddressForm());
  return (
    <div className="st-body-block">
      {paragraphs.map((p, i) => (
        <p key={i} className="st-text">{p}</p>
      ))}
      <div className="ds-label">Пять потребностей</div>
      {NEEDS_EXPLAINER.map((n) => (
        <div key={n.name} className="st-need">
          <div className="st-need-name">{n.emoji} {n.name}</div>
          <p className="st-text">{n.text}</p>
        </div>
      ))}
    </div>
  );
}
