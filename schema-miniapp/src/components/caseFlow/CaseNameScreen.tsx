import { useState } from 'react';
import { haptic } from '../../haptic';
import { PrimaryAction } from '../diary/diaryFlowUi';
import { TertiaryLink } from './caseFlowUi';
import { CASE_ALIAS_CHIPS } from '../../../../shared/src/case/caseAliasChips';
import type { Tr } from '../../../../shared/src/case/caseTypes';

/** Ограничение DTO — src/api/dto/notes.dto.ts, поле alias. */
const ALIAS_MAX = 64;

/** Экран имени части. Три равноценных выхода: чип-заготовка (мгновенный
 *  выбор), своё слово (требует явного подтверждения — свободный текст) или
 *  пропуск — имя не обязательно (правило: имя даёт человек, не мы). */
export function CaseNameScreen({
  impulseChipIds,
  saving,
  onConfirm,
  tr,
}: {
  impulseChipIds: string[];
  saving: boolean;
  onConfirm: (alias: string, source: 'chip' | 'own' | 'skipped') => void;
  tr: Tr;
}) {
  const [own, setOwn] = useState('');
  const suggestions = Array.from(
    new Set(
      impulseChipIds
        .map((id) => CASE_ALIAS_CHIPS[id])
        .filter((v): v is string => Boolean(v)),
    ),
  );

  return (
    <div>
      <div className="d-display" style={{ fontSize: 21, marginBottom: 8 }}>
        {tr('Как назовёшь эту часть?', 'Как назовёте эту часть?')}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--muted)',
          lineHeight: 1.5,
          marginBottom: 20,
        }}
      >
        {tr(
          'Своим словом — так её проще узнавать.',
          'Своим словом — так её проще узнавать.',
        )}
      </div>

      {suggestions.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-8)',
            marginBottom: 16,
          }}
        >
          {suggestions.map((label) => (
            <button
              key={label}
              onClick={() => {
                haptic.tap();
                onConfirm(label, 'chip');
              }}
              className="sel-btn"
              style={{
                background: 'var(--surface)',
                border: '1px solid rgba(34,30,27,0.1)',
                borderRadius: 999,
                padding: '10px 14px',
                minHeight: 44,
                color: 'var(--ink-2)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <input
        type="text"
        value={own}
        onChange={(e) => setOwn(e.target.value)}
        placeholder="Своё слово"
        aria-label={tr('Как назовёшь эту часть?', 'Как назовёте эту часть?')}
        maxLength={ALIAS_MAX}
        className="field-input"
        style={{
          width: '100%',
          background: 'rgba(var(--fg-rgb),0.05)',
          border: '1px solid rgba(var(--fg-rgb),0.1)',
          borderRadius: 'var(--r-12)',
          padding: '12px 14px',
          color: 'var(--text)',
          fontSize: 14,
          outline: 'none',
          marginBottom: 16,
        }}
      />

      <PrimaryAction
        label={saving ? 'Сохраняю…' : 'Назвать'}
        disabled={own.trim().length === 0 || saving}
        onClick={() => onConfirm(own.trim(), 'own')}
      />

      <TertiaryLink
        label="Пропустить →"
        onClick={() => onConfirm('', 'skipped')}
        muted
      />
    </div>
  );
}
