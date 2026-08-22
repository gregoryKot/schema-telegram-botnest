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
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
          Разбор фразы
        </div>

        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-14)',
            padding: '12px 14px',
            marginBottom: markLabels.length > 0 ? 10 : 16,
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--text-sub)',
          }}
        >
          «{entry.phrase}»
        </div>

        <PhraseMarkPills labels={markLabels} />

        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 8 }}>
          {tr('Твой ответ себе', 'Ваш ответ себе')}
        </div>
        <textarea
          className="paper-area"
          value={rewrite}
          onChange={(e) => setRewrite(e.target.value)}
          placeholder="Каким может быть ответ Здорового Взрослого?"
          rows={4}
          style={{ marginBottom: 10 }}
        />
        {detectCrisisAny(rewrite) && <CrisisCard surface="phrase_check" />}

        {error && (
          <div style={{ fontSize: 12.5, color: 'var(--accent-red)', marginBottom: 10, lineHeight: 1.5 }}>
            {tr(
              'Не сохранилось — проверь связь и попробуй ещё раз.',
              'Не сохранилось — проверьте связь и попробуйте ещё раз.',
            )}
          </div>
        )}

        <div className="ex-foot">
          <span className="spacer" />
          <button
            className="ex-btn ex-btn-primary"
            onClick={() => void handleSave()}
            disabled={saving}
            style={{ opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Сохраняю…' : 'Сохранить ответ'}
          </button>
        </div>
    </BottomSheetShell>
  );
}
