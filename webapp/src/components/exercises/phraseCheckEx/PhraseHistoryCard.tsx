// Карточка прошлого разбора (тап по строке в «Прошлые разборы»,
// PhraseCheckEx.tsx). Правится только ответ Здорового Взрослого — фраза и
// приметы критика неизменны (см. UpdatePhraseCheckDto). Паритет с miniapp
// (schema-miniapp/src/components/phraseCheck/HistoryCard.tsx, правило №3 —
// гейт паритета фич поймал этот роут как miniapp-only). Состояние — общее
// (shared/usePhraseHistoryCard), вёрстка своя. Read-after-write: onUpdated
// обновляет список у родителя сразу после PATCH.
import { useHistorySheet } from '../../../hooks/useHistorySheet';
import { detectCrisisAny } from '../../../utils/crisisMarkers';
import { CrisisCard } from '../../CrisisCard';
import { BottomSheetShell } from '../../BottomSheetShell';
import { usePhraseHistoryCard } from '../../../../../shared/src/phraseCheck/usePhraseHistoryCard';
import { PhraseMarkPills } from '../../../../../shared/src/phraseCheck/PhraseMarkPills';
import { api } from '../../../api';
import type { PhraseCheckEntry } from '../../../api';

export function PhraseHistoryCard({
  entry,
  onClose,
  onUpdated,
  tr,
}: {
  entry: PhraseCheckEntry;
  onClose: () => void;
  onUpdated: (id: number, rewrite: string | null) => void;
  tr: (ty: string, vy: string) => string;
}) {
  const goBack = useHistorySheet(onClose);
  const { rewrite, setRewrite, saving, error, markLabels, save } =
    usePhraseHistoryCard(entry, api.updatePhraseCheck, onUpdated);

  async function handleSave() {
    if (await save()) goBack();
  }

  return (
    <BottomSheetShell goBack={goBack} zIndex={320}>
        <h2 className="ds-h3 ex2-sheet-h">Разбор фразы</h2>

        <div className="ds-card ds-card--row ex2-sheet-quote">«{entry.phrase}»</div>

        <PhraseMarkPills labels={markLabels} />

        <div className="ds-label ex2-sheet-label">
          {tr('Твой ответ себе', 'Ваш ответ себе')}
        </div>
        <textarea
          className="ds-textarea"
          value={rewrite}
          onChange={(e) => setRewrite(e.target.value)}
          placeholder="Каким может быть ответ Здорового Взрослого?"
          rows={4}
        />
        {detectCrisisAny(rewrite) && <CrisisCard surface="phrase_check" />}

        {error && (
          <div className="ex2-err ex2-gap">
            {tr(
              'Не сохранилось — проверь связь и попробуй ещё раз.',
              'Не сохранилось — проверьте связь и попробуйте ещё раз.',
            )}
          </div>
        )}

        <div className="ex2-foot">
          <span className="ex2-spacer" />
          <button
            className="ds-btn"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? 'Сохраняю…' : 'Сохранить ответ'}
          </button>
        </div>
    </BottomSheetShell>
  );
}
