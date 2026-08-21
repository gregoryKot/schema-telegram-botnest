// Карточка «Мои схемы»/«Мои режимы» — редизайн вкладки «Я»: до 3 самых
// «звучащих» за неделю паттернов, тап открывает единый PatternSheet (правило
// «одна механика — один компонент», см. SchemasPatternSection.tsx — тот же
// приём). Статус карточки и частота — общие источники (usePatternStatus,
// patternsSummary), без второй логики поиска цвета/названия — patternMeta.
import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { api } from '../../api';
import { pressable } from '../../utils/a11y';
import { IdentityDot } from '../../../../shared/src/components/IdentityDot';
import { PROFILE_PATTERN_OPEN_EVENT } from '../../../../shared/src/share/analytics';
import { FreqBar } from '../../components/PatternFrequencyList';
import { PatternSheet } from '../../components/patternSheet/PatternSheet';
import { usePatternStatus } from '../../components/patternSheet/usePatternStatus';
import {
  schemaEntryCounts,
  modeEntryCounts,
} from '../../components/patternSheet/patternStatus';
import {
  patternMeta,
  type PatternMeta,
} from '../../components/patternSheet/patternMeta';
import type { MyCardsKind } from '../../components/myCards/useMyCards';
import { shortName } from '../schemas/utils';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../../types';

const TITLE: Record<MyCardsKind, string> = {
  schema: 'Мои схемы',
  mode: 'Мои режимы',
};
const TAB: Record<MyCardsKind, 'schemas' | 'modes'> = {
  schema: 'schemas',
  mode: 'modes',
};
const rowStyle = {
  width: '100%',
  minHeight: 60,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 2px',
  border: 'none',
  borderTop: '1px solid var(--border-color)',
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left' as const,
};

function Row({
  id,
  meta,
  freq,
  status,
  isSchema,
  onOpen,
}: {
  id: string;
  meta: PatternMeta;
  freq: number;
  status: string;
  isSchema: boolean;
  onOpen: () => void;
}) {
  return (
    <button key={id} {...pressable(onOpen)} style={rowStyle}>
      <IdentityDot color={meta.color} size={10} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text)',
          }}
        >
          {isSchema ? shortName(meta.name) : meta.name}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 11.5,
            color: 'var(--text-faint)',
            marginTop: 2,
          }}
        >
          {status}
        </span>
      </span>
      {freq > 0 && <FreqBar freq={freq} />}
      <span
        aria-hidden
        style={{ color: 'var(--text-faint)', fontSize: 18, flexShrink: 0 }}
      >
        ›
      </span>
    </button>
  );
}

interface Props {
  kind: MyCardsKind;
  ids: string[];
  weekFreq: Record<string, number>;
  schemaEntries?: SchemaDiaryEntry[];
  setSchemaEntries?: Dispatch<SetStateAction<SchemaDiaryEntry[]>>;
  modeEntries?: ModeDiaryEntry[];
  setModeEntries?: Dispatch<SetStateAction<ModeDiaryEntry[]>>;
  onOpenPatterns: (tab: 'schemas' | 'modes') => void;
  /** Сколько строк показать сверху списка (сортировка та же). По умолчанию
   *  3 — превью на карточке профиля; PortraitSheet передаёт Infinity —
   *  полный список внутри листа «Мой портрет» (правило «одна механика —
   *  один компонент», второй копии списка нет). */
  limit?: number;
  /** PortraitSheet сам — BottomSheet; открытый изнутри него PatternSheet
   *  обязан стоять выше (см. PatternSheet.zIndex). Не задан — верхний
   *  уровень, поведение как раньше. */
  patternSheetZIndex?: number;
}

export function MyPatternsCard({
  kind,
  ids,
  weekFreq,
  schemaEntries = [],
  setSchemaEntries,
  modeEntries = [],
  setModeEntries,
  onOpenPatterns,
  limit = 3,
  patternSheetZIndex,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const entryCounts =
    kind === 'schema'
      ? schemaEntryCounts(schemaEntries)
      : modeEntryCounts(modeEntries);
  const { items, reload, statusFor } = usePatternStatus(kind, entryCounts);

  if (ids.length === 0) return null;

  const filledIds = new Set(items.map((i) => i.id));
  const rows = ids
    .map((id) => ({ id, freq: weekFreq[id] ?? 0, meta: patternMeta(kind, id) }))
    .filter((r): r is typeof r & { meta: PatternMeta } => !!r.meta)
    .sort((a, b) => {
      if (b.freq !== a.freq) return b.freq - a.freq;
      const aFilled = filledIds.has(a.id);
      const bFilled = filledIds.has(b.id);
      if (aFilled !== bFilled) return aFilled ? -1 : 1;
      return a.meta.name.localeCompare(b.meta.name, 'ru');
    })
    .slice(0, limit);

  function openRow(id: string) {
    void api.trackEvent(PROFILE_PATTERN_OPEN_EVENT, { kind });
    setOpenId(id);
  }

  return (
    <div
      className="card"
      style={{ borderRadius: 20, padding: '16px 16px 6px' }}
    >
      <div className="d-caps" style={{ marginBottom: 10 }}>
        {TITLE[kind]}
      </div>
      {rows.map((r) => (
        <Row
          key={r.id}
          id={r.id}
          meta={r.meta}
          freq={r.freq}
          status={statusFor(r.id)}
          isSchema={kind === 'schema'}
          onOpen={() => openRow(r.id)}
        />
      ))}
      <button
        onClick={() => onOpenPatterns(TAB[kind])}
        style={{
          ...rowStyle,
          minHeight: 'auto',
          padding: '12px 2px',
          color: 'var(--text-sub)',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Все {ids.length} →
      </button>

      {openId && (
        <PatternSheet
          kind={kind}
          id={openId}
          items={items}
          reload={reload}
          schemaEntries={schemaEntries}
          setSchemaEntries={setSchemaEntries}
          modeEntries={modeEntries}
          setModeEntries={setModeEntries}
          onClose={() => setOpenId(null)}
          zIndex={patternSheetZIndex}
        />
      )}
    </div>
  );
}
