// Карточка прошлого разбора (тап по строке в «Прошлые разборы»,
// PhraseCheckEx.tsx). Правится только ответ Здорового Взрослого — фраза и
// приметы критика неизменны (см. UpdatePhraseCheckDto). Паритет с miniapp
// (schema-miniapp/src/components/phraseCheck/HistoryCard.tsx, правило №3 —
// гейт паритета фич поймал этот роут как miniapp-only). Read-after-write:
// onUpdated обновляет список у родителя сразу после PATCH.
import { useState } from 'react';
import { useHistorySheet } from '../../../hooks/useHistorySheet';
import { detectCrisisAny } from '../../../utils/crisisMarkers';
import { CrisisCard } from '../../CrisisCard';
import { PHRASE_CRITERIA } from '../../../../../shared/src/phraseCheck/criteria';
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
  const [rewrite, setRewrite] = useState(entry.rewrite ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const marks = entry.marks
    .map((id) => PHRASE_CRITERIA.find((c) => c.id === id)?.short)
    .filter((s): s is string => Boolean(s));

  async function save() {
    setSaving(true);
    setError(false);
    try {
      const res = await api.updatePhraseCheck(entry.id, rewrite.trim());
      onUpdated(entry.id, res.rewrite);
      goBack();
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 320,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'flex-end',
      }}
      onClick={goBack}
    >
      <div
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: '20px 20px 0 0',
          padding: '24px 24px 40px',
          width: '100%',
          maxWidth: 560,
          margin: '0 auto',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: 'var(--surface-3)',
            margin: '0 auto 20px',
          }}
        />
        <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
          Разбор фразы
        </div>

        <div
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            borderRadius: 14,
            padding: '12px 14px',
            marginBottom: marks.length > 0 ? 10 : 16,
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--text-sub)',
          }}
        >
          «{entry.phrase}»
        </div>

        {marks.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {marks.map((m) => (
              <span
                key={m}
                style={{
                  fontSize: 11.5,
                  padding: '4px 9px',
                  borderRadius: 999,
                  background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)',
                  color: 'var(--text-sub)',
                }}
              >
                {m}
              </span>
            ))}
          </div>
        )}

        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-sub)', marginBottom: 8 }}>
          {tr('Твой ответ себе', 'Ваш ответ себе')}
        </div>
        <textarea
          className="paper-area"
          value={rewrite}
          onChange={(e) => {
            setRewrite(e.target.value);
            setError(false);
          }}
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
            onClick={() => void save()}
            disabled={saving}
            style={{ opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Сохраняю…' : 'Сохранить ответ'}
          </button>
        </div>
      </div>
    </div>
  );
}
