import { useState, useEffect } from 'react';
import { api } from '../../api';
import type { HealthyAdultPhrase, HealthyAdultPoolStatus } from '../../api';
import { card, btn, input } from './shared';

/**
 * Массовое добавление фраз в пул канала + остаток пула.
 *
 * Пул пополняется вручную пачками (см. HEALTHY_ADULT.md): просишь Claude Code
 * сгенерировать 10 штук по брифу, читаешь, вставляешь сюда списком. Отдельный
 * файл от HealthyAdultSection — там уже 172 строки, а правило №10 не даёт
 * файлам пухнуть.
 */
export function HealthyAdultImport({
  adminKey,
  onImported,
}: {
  adminKey: string;
  onImported: (rows: HealthyAdultPhrase[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [status, setStatus] = useState<HealthyAdultPoolStatus | null>(null);

  const loadStatus = () => {
    api
      .adminPhrasePoolStatus(adminKey)
      .then(setStatus)
      .catch(() => setStatus(null));
  };
  useEffect(loadStatus, [adminKey]);

  const lineCount = draft.split('\n').filter((l) => l.trim() !== '').length;

  const submit = async () => {
    setBusy(true);
    setReport(null);
    try {
      const res = await api.adminImportPhrases(adminKey, draft);
      setReport(res.message);
      if (res.created.length > 0) {
        onImported(res.created);
        setDraft('');
        loadStatus();
      }
    } catch (e) {
      setReport(e instanceof Error ? e.message : 'Не удалось добавить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={card}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 0, marginBottom: 6 }}>
        Добавить списком
      </h3>
      <p style={{ color: 'var(--text-sub)', fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>
        По одной фразе на строку. Пачка генерируется через Claude Code по
        брифу из <code>HEALTHY_ADULT.md</code> — удачные фразы можно вставить
        сюда. Дубли и повторы зачинов отсеются сами, отчёт будет ниже.
      </p>

      <PoolMeter status={status} />

      <textarea
        style={{ ...input, width: '100%', minHeight: 160, resize: 'vertical', lineHeight: 1.6, marginTop: 12 }}
        placeholder={'Устал – значит устал.\nОшибка не делает человека плохим.\n…'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={btn} onClick={submit} disabled={busy || lineCount === 0}>
          {busy ? 'Добавляю…' : `Добавить (${lineCount})`}
        </button>
      </div>

      {report && (
        <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, margin: '12px 0 0', color: 'var(--text)', background: 'rgba(var(--fg-rgb),0.04)', padding: 10, borderRadius: 8, lineHeight: 1.6 }}>
          {report}
        </p>
      )}
    </section>
  );
}

/** Остаток пула словами: сколько ещё не звучало и на сколько дней хватит. */
function PoolMeter({ status }: { status: HealthyAdultPoolStatus | null }) {
  if (status === null) {
    // Скелетон по форме будущей строки, а не спиннер (правило про загрузку).
    return (
      <div style={{ height: 34, borderRadius: 8, background: 'rgba(var(--fg-rgb),0.06)' }} />
    );
  }
  const low = status.daysLeft < 7;
  return (
    <div
      style={{
        fontSize: 13,
        lineHeight: 1.5,
        padding: '8px 10px',
        borderRadius: 8,
        color: low ? 'var(--accent-red)' : 'var(--text-sub)',
        background: low ? 'rgba(var(--accent-red-rgb,200,60,60),0.08)' : 'rgba(var(--fg-rgb),0.04)',
      }}
    >
      {status.enabled === 0
        ? 'Пул пуст — канал сейчас публиковать нечего.'
        : `Ещё не звучали: ${status.unused} из ${status.enabled}. Хватит примерно на ${status.daysLeft} дн.`}
      {low && status.enabled > 0 && ' Пора пополнить.'}
    </div>
  );
}
