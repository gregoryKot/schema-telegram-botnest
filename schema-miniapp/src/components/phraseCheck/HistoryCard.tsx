// Карточка прошлого разбора (тап по строке в «Прошлые разборы»,
// PhraseCheck.tsx). Исходная фраза и отметки критика — цитата момента, не
// редактируются; правится только ответ Здорового Взрослого (правило: добрый
// ответ себе со временем находится точнее). Read-after-write (правило
// CLAUDE.md о read-after-write тестах) держит onUpdated — родитель обновляет
// список сразу после успешного PATCH, без перезахода.
import { useState } from 'react';
import { BottomSheet } from '../BottomSheet';
import { CrisisGate } from '../CrisisGate';
import { PhraseCheckShare } from './PhraseCheckShare';
import { PHRASE_CRITERIA } from '../../../../shared/src/phraseCheck/criteria';
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
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

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
            marginBottom: marks.length > 0 ? 10 : 16,
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--text-sub)',
          }}
        >
          «{entry.phrase}»
        </div>

        {marks.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginBottom: 16,
            }}
          >
            {marks.map((m) => (
              <span
                key={m}
                style={{
                  fontSize: 11.5,
                  padding: '4px 9px',
                  borderRadius: 999,
                  background:
                    'color-mix(in srgb, var(--accent-red) 8%, transparent)',
                  color: 'var(--text-sub)',
                }}
              >
                {m}
              </span>
            ))}
          </div>
        )}

        <div className="section-label" style={{ marginBottom: 8 }}>
          {tr('Твой ответ себе', 'Ваш ответ себе')}
        </div>
        <textarea
          value={rewrite}
          onChange={(e) => {
            setRewrite(e.target.value);
            setError(false);
          }}
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
          onClick={save}
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
