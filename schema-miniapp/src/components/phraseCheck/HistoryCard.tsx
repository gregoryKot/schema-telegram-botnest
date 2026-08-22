// Карточка прошлого разбора (тап по строке в «Прошлые разборы»,
// PhraseCheck.tsx). Исходная фраза и отметки критика — цитата момента, не
// редактируются; правится только ответ Здорового Взрослого (правило: добрый
// ответ себе со временем находится точнее). Состояние — общее с webapp
// (shared/usePhraseHistoryCard, правило №3), вёрстка своя. Read-after-write
// (правило CLAUDE.md о read-after-write тестах) держит onUpdated — родитель
// обновляет список сразу после успешного PATCH, без перезахода.
import { BottomSheet } from '../BottomSheet';
import { CrisisGate } from '../CrisisGate';
import { PhraseCheckShare } from './PhraseCheckShare';
import { usePhraseHistoryCard } from '../../../../shared/src/phraseCheck/usePhraseHistoryCard';
import { PhraseMarkPills } from '../../../../shared/src/phraseCheck/PhraseMarkPills';
import { api } from '../../api';
import type { PhraseCheckHistoryRow } from './HistoryList';

export function PhraseCheckHistoryCard({
  entry,
  onClose,
  onUpdated,
  tr,
}: {
  entry: PhraseCheckHistoryRow;
  onClose: () => void;
  onUpdated: (id: number, rewrite: string | null) => void;
  tr: (ty: string, vy: string) => string;
}) {
  const { rewrite, setRewrite, saving, error, markLabels, save } =
    usePhraseHistoryCard(entry, api.updatePhraseCheck, onUpdated);

  return (
    <BottomSheet onClose={onClose} zIndex={220}>
      <div style={{ paddingTop: 4 }}>
        <div className="section-label" style={{ marginBottom: 8 }}>
          Разбор фразы
        </div>

        <div
          style={{
            background: 'rgba(var(--fg-rgb),0.04)',
            border: '1px solid rgba(var(--fg-rgb),0.08)',
            borderRadius: 14,
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

        <div className="section-label" style={{ marginBottom: 8 }}>
          {tr('Твой ответ себе', 'Ваш ответ себе')}
        </div>
        <textarea
          value={rewrite}
          onChange={(e) => setRewrite(e.target.value)}
          placeholder="Каким может быть ответ Здорового Взрослого?"
          rows={4}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            background: 'rgba(var(--fg-rgb),0.04)',
            border: '1px solid rgba(var(--fg-rgb),0.1)',
            borderRadius: 14,
            padding: '13px 14px',
            color: 'var(--text)',
            fontSize: 14,
            lineHeight: 1.7,
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            marginBottom: 10,
          }}
        />
        <CrisisGate texts={[rewrite]} surface="phrase_check" />

        {error && (
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--accent-red)',
              marginBottom: 10,
              lineHeight: 1.5,
            }}
          >
            {tr(
              'Не сохранилось — проверь связь и попробуй ещё раз.',
              'Не сохранилось — проверьте связь и попробуйте ещё раз.',
            )}
          </div>
        )}

        <button
          onClick={() => void save()}
          disabled={saving}
          className="btn-primary"
          style={{ width: '100%', marginBottom: 14, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Сохраняю…' : 'Сохранить ответ'}
        </button>

        <PhraseCheckShare
          phrase={entry.phrase}
          marks={entry.marks}
          rewrite={rewrite.trim() || undefined}
        />
      </div>
    </BottomSheet>
  );
}
