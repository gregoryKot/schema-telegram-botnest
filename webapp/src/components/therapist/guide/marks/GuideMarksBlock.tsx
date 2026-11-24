import { useState } from 'react';
import { useGuide } from '../../../../../../shared/src/therapy/conceptGraph/guideLoader';
import type { GuideMark } from '../../../../../../shared/src/therapy/guideMarks/guideMarksApi';
import { useTr } from '../../../../utils/addressForm';
import { SkeletonLines } from '../../../Skeleton';
import { markEntries, type GuideMarkEntry } from './guideMarkModel';
import { GuideForClientSheet } from './GuideForClientSheet';
import type { GuideMarkClient } from './useClientGuideMarks';

/**
 * Блок «Из справочника» под схемой случая (#1484): разделы, отмеченные «Про клиента», с заметкой и
 * крестиком-снятием. Раздел переписан — сохранённый при отметке текст с пометкой «раздел изменился».
 * Отметок нет — блока нет; в пустой схеме случая — строка, откуда он берётся (`conceptEmpty`).
 */
export function GuideMarksBlock({ marks, conceptEmpty, onRemove, client, onReload }: {
  /** undefined — грузятся, null — не загрузились (блока нет: схема случая работает и без него). */
  marks: GuideMark[] | null | undefined;
  conceptEmpty: boolean;
  onRemove: (mark: GuideMark) => void;
  /** Клиент карточки: есть — кнопка «Добавить из справочника» и «Открыть в справочнике» у отметок. */
  client?: GuideMarkClient;
  /** Лист справочника закрыт — перечитать отметки. */
  onReload?: () => void;
}) {
  const tr = useTr();
  const guide = useGuide();
  // null — справочник закрыт; '' — открыт целиком; иначе адрес раздела.
  const [at, setAt] = useState<string | null>(null);
  const sheet = client && at !== null && (
    <GuideForClientSheet client={client} address={at || undefined} onClose={() => { setAt(null); onReload?.(); }} />
  );
  const add = client && (
    <button type="button" className="ds-btn ds-btn--secondary" onClick={() => setAt('')}>Добавить из справочника</button>
  );
  if (marks === null) return null;
  if (marks?.length === 0) {
    if (!add) return conceptEmpty ? <p className="ds-sub gd-mark-hint">{tr('Отмечай', 'Отмечайте')} в Справочнике «Про клиента» — это появится здесь</p> : null;
    return (
      <section aria-label="Из справочника" className="gd-marks">
        {conceptEmpty && <p className="ds-sub gd-mark-hint">{tr('Отмечай', 'Отмечайте')} в Справочнике «Про клиента» — это появится здесь</p>}
        {add}{sheet}
      </section>
    );
  }
  const label = tr('Из справочника — что ты отмечаешь «Про клиента»', 'Из справочника — что вы отмечаете «Про клиента»');
  if (marks === undefined || guide === undefined) {
    return (
      <section aria-label="Из справочника" aria-busy="true" className="gd-marks">
        <SkeletonLines widths={['60%', '90%', '40%', '85%']} />
      </section>
    );
  }
  // Тексты справочника не загрузились — сохранённые тексты как есть.
  const entries: GuideMarkEntry[] = guide
    ? markEntries(marks, guide, tr)
    : marks.map((mark) => ({ mark, title: 'Раздел справочника', text: mark.snapshot, changed: false, fragment: !!mark.fragment }));
  return (
    <section aria-label="Из справочника" className="gd-marks">
      <h3 className="ds-label gd-label">{label}</h3>
      <ul className="gd-marks-list">
        {entries.map(({ mark, title, text, changed, fragment }) => (
          <li key={mark.id < 0 ? `${mark.address}#${mark.snapshot}` : mark.id} className="gd-marks-item">
            <div className="gd-min">
              <div className="gd-lead">{title}{fragment && <span className="ds-sub gd-marks-frag"> · фрагмент</span>}</div>
              {mark.note && <p className="gd-text">{mark.note}</p>}
              {fragment ? <blockquote className="gd-sel-quote">{text}</blockquote> : <p className="ds-sub gd-marks-text">{text}</p>}
              {changed && <span className="ds-sub gd-marks-changed">раздел изменился</span>}
              {client && (guide?.resolveAddress(mark.address)
                ? <button type="button" className="ds-link gd-mark-open" onClick={() => setAt(mark.address)}>Открыть в справочнике</button>
                : <span className="ds-sub gd-marks-changed">раздела в справочнике больше нет</span>)}
            </div>
            <button type="button" className="gd-mark-x" aria-label={`Снять отметку: ${title}`} onClick={() => onRemove(mark)}>×</button>
          </li>
        ))}
      </ul>
      {add}{sheet}
    </section>
  );
}
