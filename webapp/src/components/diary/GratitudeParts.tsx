// Части дневника благодарности (GratitudeEntrySheet — в бейслайне размера, правило №10): заголовок и подводка героя
// (разметка — glueIf листа её не склеивает, клеим здесь), «Почему это работает», «Добавить ещё пункт», сбой.
import { GlyphPlus } from '../exercises/ExGlyphs';
import { glue } from '../../../../shared/src/utils/typo';
import { PaperAlert } from '../paper/PaperAlert';
import { DiaryAside } from './DiaryStepCard';

// Хвост «… – спасибо» одной строкой (nowrap: после «–» браузер рвёт строку и при неразрывном пробеле); запись задним числом — «в этот день».
export const GratitudeTitle = ({ today }: { today: boolean }) => <>За что<br /><span className="it sd-grat-it">{today ? <span className="sd-grat-nowrap">сегодня – спасибо</span> : <>{glue('в этот')} <span className="sd-grat-nowrap">день – спасибо</span></>}</span></>;
export const GratitudeLede = () => <>{glue('Даже самое маленькое. Особенно самое маленькое. Запоминается то, что удалось назвать. Хватит и одной строки.')}</>;
export function GratitudeWhy({ hue }: { hue: number }) {
  return <DiaryAside hue={hue} eyebrow="Почему это работает" title="Мозг учится замечать"
    text="Психика устроена так, чтобы запоминать опасное. Регулярная практика благодарности – не «позитивное мышление», а тренировка нервной системы замечать тёплое наряду с тревожным." />;
}
/** «Добавить ещё пункт» — последней строкой тетради: «+» в колонке номеров. */
export function GratitudeAddRow({ onAdd }: { onAdd: () => void }) {
  return (
    <button type="button" className="sd-grat-add" onClick={onAdd}>
      <span className="sd-grat-add-glyph" aria-hidden="true"><GlyphPlus /></span>
      <span>Добавить ещё пункт</span>
    </button>
  );
}
/** Сбой сохранения: лист открыт, текст черновиком. 409 «не читается» (E15) — без «можно повторить»:
 *  повтор получит тот же отказ, прежние пункты сервер бережёт. */
export function GratitudeSaveError({ kind }: { kind: 'failed' | 'unreadable' }) {
  const unreadable = kind === 'unreadable';
  return (
    <PaperAlert role="status" sign="pebbles" className="sd-grat-error"
      title={unreadable ? 'Не сохранилось: прежние пункты этого дня сейчас не читаются, и новая запись стёрла бы их.' : 'Не удалось сохранить.'}
      text={unreadable ? 'Текст остался черновиком, о сбое уже сообщено' : 'Текст остался черновиком — можно повторить'} />
  );
}
