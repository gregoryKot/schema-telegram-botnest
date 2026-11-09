// Части дневника благодарности (GratitudeEntrySheet; файл листа — в бейслайне размера и только
// худеет, правило №10): подсказка «Почему это работает», строка тетради «Добавить ещё пункт» и
// сбой сохранения строкой. Тексты — прежние, без правок.
import { GlyphPlus } from '../exercises/ExGlyphs';
import { PaperAlert } from '../paper/PaperAlert';
import { DiaryAside } from './DiaryStepCard';

export function GratitudeWhy({ hue }: { hue: number }) {
  return (
    <DiaryAside hue={hue} eyebrow="Почему это работает" title="Мозг учится замечать">
      <p className="ds-sub">Психика устроена так, чтобы запоминать опасное. Регулярная практика благодарности – не «позитивное мышление», а тренировка нервной системы замечать тёплое наряду с тревожным.</p>
    </DiaryAside>
  );
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
