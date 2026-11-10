// Карточка прошлого разбора (тап по строке в «Прошлые разборы», PhraseCheckEx.tsx). Правится только ответ
// Здорового Взрослого — фраза и приметы критика неизменны (см. UpdatePhraseCheckDto). Состояние — общее
// (shared/usePhraseHistoryCard), вёрстка своя. Read-after-write: onUpdated обновляет список у родителя
// сразу после PATCH. Удаление — DeleteBtn дневника («Удалить» → «Удалить навсегда» строкой, сбой —
// листом соломы PaperAlert, запись на месте); после DELETE — событие entry_deleted, лист закрывается.
// Вид (b18) — итоговая карточка разбора: «было» (реплика критика, PhraseSaid) → приметы бусинами → «стало»
// (поле-лист с тенью мха); «Сохранить ответ» — единственная залитая, поделиться — тихими ссылками.
import { useHistorySheet } from '../../../hooks/useHistorySheet';
import { detectCrisisAny } from '../../../utils/crisisMarkers';
import { CrisisCard } from '../../CrisisCard';
import { BottomSheetShell } from '../../BottomSheetShell';
import { PaperAlert } from '../../paper/PaperAlert';
import { SignArt } from '../../art/SignArt';
import { hueStyle } from '../../../lib/tone';
import { PhraseCheckShare } from './PhraseCheckShare';
import { PhraseSaid } from './PhraseSaid';
import { CARE_LOOK } from './phraseLook';
import { DeleteBtn } from '../../../sections/diary/DeleteBtn';
import { usePhraseHistoryCard } from '../../../../../shared/src/phraseCheck/usePhraseHistoryCard';
import { PhraseMarkPills } from '../../../../../shared/src/phraseCheck/PhraseMarkPills';
import { trackEntryDeleted } from '../../../../../shared/src/analytics/trackEntryDeleted';
import { LimitedTextarea } from '../../../../../shared/src/components/LimitedTextarea';
import { EXERCISE_TEXT_MAX } from '../../../../../shared/src/limits/textLimits';
import { api } from '../../../api';
import type { PhraseCheckEntry } from '../../../api';

export function PhraseHistoryCard({ entry, onClose, onUpdated, onDeleted, tr }: {
  entry: PhraseCheckEntry;
  onClose: () => void;
  onUpdated: (id: number, rewrite: string | null) => void;
  onDeleted: (id: number) => void;
  tr: (ty: string, vy: string) => string;
}) {
  const goBack = useHistorySheet(onClose);
  const { rewrite, setRewrite, saving, error, markLabels, save } =
    usePhraseHistoryCard(entry, api.updatePhraseCheck, onUpdated);

  async function handleSave() {
    if (await save()) goBack();
  }

  // Сбой пробрасывается в DeleteBtn: он покажет строку, лист останется открытым.
  // Событие — только после успешного DELETE (правило №8, блок удалений в /stats).
  async function handleDelete() {
    await api.deletePhraseCheck(entry.id);
    trackEntryDeleted(api, 'phrase_check');
    goBack(() => onDeleted(entry.id));
  }

  return (
    <BottomSheetShell goBack={goBack} zIndex={320}>
      <h2 className="ds-h3 ex2-sheet-h">Разбор фразы</h2>
      <PhraseSaid label="Было" text={entry.phrase} />
      <PhraseMarkPills labels={markLabels} />

      <div className="ex2-now" style={hueStyle(CARE_LOOK.hue)}>
        <label className="ds-label ex2-said-label" htmlFor="phrase-history-rewrite">
          <SignArt sign={CARE_LOOK.sign} size="nav" />{tr('Твой ответ себе', 'Ваш ответ себе')}
        </label>
        <LimitedTextarea
          id="phrase-history-rewrite"
          max={EXERCISE_TEXT_MAX}
          className="pa-field"
          value={rewrite}
          onChange={(e) => setRewrite(e.target.value)}
          placeholder="Каким может быть ответ Здорового Взрослого?"
          rows={4}
        />
      </div>
      {detectCrisisAny(rewrite) && <CrisisCard surface="phrase_check" />}

      {error && (
        <PaperAlert sign="looming" className="ex2-alert" title={tr(
          'Не сохранилось — проверь связь и попробуй ещё раз.',
          'Не сохранилось — проверьте связь и попробуйте ещё раз.',
        )} />
      )}

      <div className="ex2-foot">
        <span className="ex2-spacer" />
        <button className="ds-btn" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Сохраняю…' : 'Сохранить ответ'}
        </button>
      </div>

      <div className="ex2-share">
        <PhraseCheckShare phrase={entry.phrase} marks={entry.marks} rewrite={rewrite.trim() || undefined} />
      </div>

      <div className="ex2-sheet-delete">
        <DeleteBtn onClick={handleDelete} />
      </div>
    </BottomSheetShell>
  );
}
