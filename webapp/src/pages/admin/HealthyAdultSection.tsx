import { useState, useEffect } from 'react';
import { api } from '../../api';
import type { HealthyAdultPhrase } from '../../api';
import { card, btn, btnGhost, input } from './shared';
import { hasSecondPerson } from '../../utils/secondPerson';

/** Админ-вкладка: управление пулом фраз «Здорового Взрослого» для канала. */
export function HealthyAdultSection({ adminKey }: { adminKey: string }) {
  const [phrases, setPhrases] = useState<HealthyAdultPhrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api
      .adminListPhrases(adminKey)
      .then(setPhrases)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, [adminKey]);

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    try {
      const row = await api.adminCreatePhrase(adminKey, text);
      setPhrases((p) => [...p, row]);
      setDraft('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить');
    }
  };

  const patch = (row: HealthyAdultPhrase) =>
    setPhrases((p) => p.map((x) => (x.id === row.id ? row : x)));
  const drop = (id: number) => setPhrases((p) => p.filter((x) => x.id !== id));

  const testPost = async (slot: 0 | 1) => {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await api.adminTestPhrasePost(adminKey, slot);
      setTestMsg(res.message);
    } catch (e) {
      setTestMsg(e instanceof Error ? e.message : 'Ошибка отправки');
    } finally {
      setTesting(false);
    }
  };

  const enabledCount = phrases.filter((p) => p.enabled).length;

  return (
    <>
      <section style={card}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 0, marginBottom: 8 }}>
          Канал «Здоровый Взрослый»
        </h2>
        <p style={{ color: 'var(--text-sub)', fontSize: 14, margin: '0 0 14px', lineHeight: 1.5 }}>
          Заботливые схематерапевтичные фразы уходят в Telegram-канал автоматически
          дважды в день (09:00 и 20:00 МСК). Ниже — весь пул: фразы перебираются
          по кругу, повтора не будет, пока не пройдёт весь список. Канал задаётся
          переменной окружения <code>HEALTHY_ADULT_CHANNEL</code>, бот должен быть
          администратором канала.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={btnGhost} onClick={() => testPost(0)} disabled={testing}>
            {testing ? 'Отправка…' : 'Проверить: отправить сейчас'}
          </button>
          <span style={{ color: 'var(--text-sub)', fontSize: 13 }}>
            Активных фраз: {enabledCount} / {phrases.length}
          </span>
        </div>
        {testMsg && (
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 13, margin: '10px 0 0', color: 'var(--text)', background: 'rgba(var(--fg-rgb),0.04)', padding: 10, borderRadius: 8 }}>
            {testMsg}
          </p>
        )}
      </section>

      <section style={card}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginTop: 0, marginBottom: 12 }}>
          Добавить фразу
        </h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <textarea
            style={{ ...input, flex: 1, minHeight: 60, resize: 'vertical', lineHeight: 1.5 }}
            placeholder="Безличная поддерживающая фраза (без «ты/вы»)…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button style={btn} onClick={add} disabled={!draft.trim()}>Добавить</button>
        </div>
        {draft.trim() && hasSecondPerson(draft) && (
          <p style={{ color: 'var(--accent-red)', fontSize: 12.5, margin: '8px 0 0' }}>
            ⚠️ Похоже на обращение «ты/вы». Канал общий — лучше переформулировать безлично.
          </p>
        )}
        {error && <p style={{ color: 'var(--accent-red)', fontSize: 13, margin: '10px 0 0' }}>{error}</p>}
      </section>

      {loading ? (
        <p style={{ color: 'var(--text-sub)', fontSize: 14 }}>Загрузка…</p>
      ) : (
        phrases.map((p) => (
          <PhraseRow key={p.id} adminKey={adminKey} row={p} onPatch={patch} onDrop={drop} />
        ))
      )}
    </>
  );
}

function PhraseRow({ adminKey, row, onPatch, onDrop }: {
  adminKey: string;
  row: HealthyAdultPhrase;
  onPatch: (r: HealthyAdultPhrase) => void;
  onDrop: (id: number) => void;
}) {
  const [text, setText] = useState(row.text);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = text.trim() !== row.text && text.trim().length > 0;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      const updated = await api.adminUpdatePhrase(adminKey, row.id, { text: text.trim() });
      onPatch(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  const toggle = () =>
    run(async () => onPatch(await api.adminUpdatePhrase(adminKey, row.id, { enabled: !row.enabled })));
  const remove = () =>
    run(async () => {
      if (!confirm('Удалить фразу?')) return;
      await api.adminDeletePhrase(adminKey, row.id);
      onDrop(row.id);
    });

  return (
    <section style={{ ...card, marginBottom: 10, opacity: row.enabled ? 1 : 0.55 }}>
      <textarea
        style={{ ...input, minHeight: 52, resize: 'vertical', lineHeight: 1.5 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {hasSecondPerson(text) && (
        <p style={{ color: 'var(--accent-red)', fontSize: 12, margin: '6px 0 0' }}>
          ⚠️ Возможное «ты/вы» — канал общий, лучше безлично.
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={btn} onClick={save} disabled={busy || !dirty}>Сохранить</button>
        <button style={btnGhost} onClick={toggle} disabled={busy}>
          {row.enabled ? 'Выключить' : 'Включить'}
        </button>
        <button style={{ ...btnGhost, color: 'var(--accent-red)' }} onClick={remove} disabled={busy}>
          Удалить
        </button>
        {saved && <span style={{ color: '#4a6335', fontSize: 13 }}>Сохранено ✓</span>}
        {!row.enabled && <span style={{ color: 'var(--text-sub)', fontSize: 12 }}>выключена</span>}
        {error && <span style={{ color: 'var(--accent-red)', fontSize: 13 }}>{error}</span>}
      </div>
    </section>
  );
}
