import { useState } from 'react';
import { api } from '../../api';
import type { AuditedPhrase, PhraseIssue } from '../../api';
import { card, btn, btnGhost, input } from './shared';

/**
 * Проверка текста фразы до сохранения + проверка всего пула.
 *
 * Пул живёт строками в БД, а гейты репозитория обходят файлы на диске — текст,
 * заведённый здесь, не проходил ни одной проверки (реальный пропуск 2026-08:
 * фраза с мужским родом во всём тексте и выдуманным «несправлянием» доехала до
 * пользователей). Планка теперь стоит на записи, но её надо ВИДЕТЬ до того, как
 * жать «Добавить», — и надо чем-то перебрать фразы, заведённые раньше неё.
 *
 * Отдельный файл от HealthyAdultSection: там уже 180 строк, правило №10 не даёт
 * файлам пухнуть.
 */

const KIND_LABEL: Record<string, string> = {
  род: 'мужской род',
  робот: 'штамп',
  слово: 'выдуманное слово',
};

function IssueList({ issues }: { issues: PhraseIssue[] }) {
  return (
    <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
      {issues.map((i, n) => (
        <li key={n} style={{ color: i.severity === 'block' ? 'var(--c-rose)' : 'var(--text-sub)' }}>
          <b>{KIND_LABEL[i.kind] ?? i.kind}</b>: «{i.fragment}»
          {i.severity === 'warn' && ' — спорно, решать автору'}
        </li>
      ))}
    </ul>
  );
}

export function HealthyAdultCheck({ adminKey }: { adminKey: string }) {
  const [draft, setDraft] = useState('');
  const [issues, setIssues] = useState<PhraseIssue[] | null>(null);
  const [pool, setPool] = useState<AuditedPhrase[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'не получилось');
    } finally {
      setBusy(false);
    }
  };

  const check = () =>
    run(async () => {
      setPool(null);
      const res = await api.adminCheckPhrase(adminKey, draft.trim());
      setIssues(res.issues);
    });

  const auditPool = () =>
    run(async () => {
      setIssues(null);
      setPool(await api.adminAuditPhrases(adminKey));
    });

  const blocking = (issues ?? []).filter((i) => i.severity === 'block').length;

  return (
    <div style={card}>
      <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>Проверка текста</h3>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-sub)' }}>
        Мужской род, штампы вроде «это не X, это Y», выдуманные слова. Та же
        планка, что стоит на сохранении, — можно посмотреть заранее.
      </p>

      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setIssues(null);
        }}
        rows={4}
        placeholder="Текст фразы для проверки"
        style={{ ...input, resize: 'vertical', marginBottom: 10 }}
      />

      <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
        <button
          style={{ ...btn, opacity: busy || draft.trim() === '' ? 0.5 : 1 }}
          disabled={busy || draft.trim() === ''}
          onClick={check}
        >
          Проверить
        </button>
        <button style={{ ...btnGhost, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={auditPool}>
          Проверить весь пул
        </button>
      </div>

      {error && (
        <p role="alert" style={{ marginTop: 10, fontSize: 13, color: 'var(--c-rose)' }}>
          {error}
        </p>
      )}

      {issues !== null && (
        <div role="status" style={{ marginTop: 12, fontSize: 14 }}>
          {issues.length === 0 ? (
            <span style={{ color: 'var(--c-moss)' }}>Чисто — придраться не к чему.</span>
          ) : (
            <>
              <span style={{ color: blocking > 0 ? 'var(--c-rose)' : 'var(--text-sub)' }}>
                {blocking > 0
                  ? `Так сохранить не даст: ${blocking}`
                  : 'Сохранить даст, но стоит взглянуть:'}
              </span>
              <IssueList issues={issues} />
            </>
          )}
        </div>
      )}

      {pool !== null && (
        <div role="status" style={{ marginTop: 12, fontSize: 14 }}>
          {pool.length === 0 ? (
            <span style={{ color: 'var(--c-moss)' }}>Весь пул чист.</span>
          ) : (
            <>
              <span>Фраз с претензиями: {pool.length}. Править — в списке ниже.</span>
              {pool.map((row) => (
                <div
                  key={row.id}
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <div style={{ fontSize: 13.5, color: 'var(--text)' }}>
                    #{row.id}
                    {!row.enabled && ' (выключена)'}: {row.text}
                  </div>
                  <IssueList issues={row.issues} />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
