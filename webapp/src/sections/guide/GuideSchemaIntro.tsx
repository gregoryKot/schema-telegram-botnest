import { SignArt } from '../../components/art/SignArt';
import { Cited } from '../../components/therapist/guide/GuideText';
import { Disclosure } from '../../../../shared/src/components/Disclosure';
import { COPING_ABOUT } from '../../../../shared/src/schemaTherapy/guide/schemas/copingAbout';
import { COPING_STYLES } from '../../../../shared/src/schemaTherapy/guide/copingStyles';
import { styleVars } from './guideSchemaTableModel';

const ABOUT_CLASSES = { root: 'gst-about', btn: 'gst-about-btn', label: 'ds-label', chev: 'ds-fold-chev', body: 'gst-about-body' };

/**
 * Шапка «Схем» → «Таблицей»: лид, три копинга блоками со знаком и сутью, свёрнутая врезка «почему копинг держит
 * схему» (уровни, режим, исследования) и тихая подсказка, как читать таблицу. Правило «текст для чтения оформлен»
 * (frontend-visual.md) сверяет guideReadableText.test.tsx.
 */
export function GuideSchemaIntro({ canMark }: { canMark: boolean }) {
  return (
    <header className="gst-intro">
      <p className="gst-lede">Одна схема — три способа с ней жить. Один и тот же человек переходит между ними в разных ситуациях.</p>
      <ul className="gst-styles" aria-label="Три стиля копинга">
        {COPING_STYLES.map((s) => (
          <li key={s.id} className="gst-style" style={styleVars(s)}>
            <span className="gst-style-sign" aria-hidden="true"><SignArt sign={s.sign} size="row" /></span>
            <span className="gst-style-name">{s.label}</span>
            <span className="gst-style-gist">Человек {s.gist}</span>
          </li>
        ))}
      </ul>
      <Disclosure classes={ABOUT_CLASSES} title="Почему копинг держит схему">
        <p><Cited text={COPING_ABOUT.relief} /></p>
        <p><Cited text={COPING_ABOUT.levelsLead} /></p>
        <ul className="gst-levels">{COPING_ABOUT.levels.map((l) => <li key={l}>{l}</li>)}</ul>
        <p>{COPING_ABOUT.mode}</p>
        <p><Cited text={COPING_ABOUT.research} /></p>
      </Disclosure>
      <p className="gst-how">
        В клетке — суть одной строкой; тап раскрывает полный пример
        {canMark ? ' и кнопку «Про клиента»: стиль ляжет в схему случая клиента' : ''}. Тап по схеме открывает её лист.
      </p>
    </header>
  );
}
