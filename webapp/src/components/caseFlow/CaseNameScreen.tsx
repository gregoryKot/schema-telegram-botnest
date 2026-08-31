import { useState } from 'react';
import { ExScreen } from '../exercises/ExScreen';
import { CaseFlowFoot, TertiaryLink } from './caseFlowUi';
import { CASE_ALIAS_CHIPS } from '../../../../shared/src/case/caseAliasChips';
import type { Tr } from '../../../../shared/src/case/caseTypes';

/** Ограничение DTO — src/api/dto/notes.dto.ts, поле alias. */
const ALIAS_MAX = 64;

/** Экран имени части. Три равноценных выхода: чип-заготовка, своё слово или
 *  пропуск — имя не обязательно. Twin schema-miniapp CaseNameScreen.tsx. */
export function CaseNameScreen({
  impulseChipIds,
  saving,
  onBack,
  onConfirm,
  onLater,
  crisis,
  onHardNow,
  tr,
}: {
  impulseChipIds: string[];
  saving: boolean;
  onBack: () => void;
  onConfirm: (alias: string, source: 'chip' | 'own' | 'skipped') => void;
  onLater: () => void;
  crisis: boolean;
  onHardNow: () => void;
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
    <ExScreen
      onBack={onBack}
      backLabel="Закрыть"
      eyebrow="Разбор случая"
      eyebrowColor="var(--accent-indigo)"
      title={tr('Как назовёшь эту часть?', 'Как назовёте эту часть?')}
      lede="Своим словом — так её проще узнавать."
    >
      {suggestions.length > 0 && (
        <div className="chip-row">
          {suggestions.map((label) => (
            <button
              key={label}
              type="button"
              className="chip-pill"
              onClick={() => onConfirm(label, 'chip')}
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
        style={{ marginBottom: 16 }}
      />

      <button
        type="button"
        className="ex-btn ex-btn-primary"
        disabled={own.trim().length === 0 || saving}
        onClick={() => onConfirm(own.trim(), 'own')}
      >
        {saving ? 'Сохраняю…' : 'Назвать'}
      </button>

      <div style={{ marginTop: 8 }}>
        <TertiaryLink label="Пропустить →" onClick={() => onConfirm('', 'skipped')} />
      </div>

      <CaseFlowFoot onLater={onLater} crisis={crisis} onHardNow={onHardNow} />
    </ExScreen>
  );
}
