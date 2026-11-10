// Плитка библиотеки «Практик» — лист бумаги упражнения (practiceLook → ENTITY_LOOK) со знаком
// крупно и тенью-вырезкой, как плитки «Возможностей» лендинга: время, название Literata, одна строка
// описания, внизу мета из реальных записей и стрелка. Номера 01–08 ушли: при скрытии и перестановке
// они перенумеровывались и ничего не значили (аудит b14). Раскладку (бенто на компьютере, две
// колонки на телефоне, широкая последняя плитка без дыры в ряду) держит client-practice.css.
// На телефоне плитка тесная: у начатого упражнения внизу статистика, у не начатого — описание
// (две строки) на её месте: новичку «откуда это и зачем» до первого нажатия (ревью g4 r2).
import { hueStyle } from '../../lib/tone';
import { glue } from '../../../../shared/src/utils/typo';
import { fmtAgo } from '../../utils/format';
import { SignHero } from '../../components/paper/SignHero';
import { fmtCount, type ExStats } from './exerciseLibraryModel';
import type { ExerciseCard } from '../../../../shared/src/exercises/exerciseCatalog';
import { exerciseLook } from './practiceLook';

/** Мета плитки из данных: «3 записи · вчера» (половины не рвутся посередине, перенос — после « ·»);
 *  у колеса детства даты нет — «пройдено». */
function State({ s }: { s: ExStats | undefined }) {
  if (!s) return <span className="cp-ex-state is-new">не начато</span>;
  return <span className="cp-ex-state"><span>{fmtCount(s.count)}{'\u00a0·'}</span> <span>{s.lastDone ? fmtAgo(s.lastDone) : 'пройдено'}</span></span>;
}

export function ExerciseTile({ ex, stat, onOpen, phone = false }: { ex: ExerciseCard; stat?: ExStats; onOpen: () => void; phone?: boolean }) {
  const { hue, sign } = exerciseLook(ex.id);
  const desc = !phone || !stat; // телефон: описание — только пока статистики нет
  return (
    <button type="button" className="pp-paper cp-ex" style={hueStyle(hue)} onClick={onOpen}>
      <span className="cp-ex-art" aria-hidden="true"><SignHero sign={sign} /></span>
      <span className="cp-ex-time">{ex.time}</span>
      <span className="cp-ex-title">{glue(ex.title)}</span>
      {desc && <span className="cp-ex-desc">{glue(ex.desc)}</span>}
      <span className="cp-ex-foot">{(stat || !phone) && <State s={stat} />}<span className="pp-arrow" aria-hidden="true">→</span></span>
    </button>
  );
}
