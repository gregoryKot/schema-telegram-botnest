import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

const TABLE_LABELS: Record<string, string> = {
  Rating: 'оценки потребностей',
  YsqProgress: 'прогресс теста на схемы',
  YsqResult: 'результат теста на схемы',
  YsqResultHistory: 'история тестов',
  Note: 'заметки',
  UserSchemaNote: 'заметки по схемам',
  UserModeNote: 'заметки по режимам',
  UserBeliefCheck: 'проверки убеждений',
  UserLetter: 'письма себе',
  UserSafePlace: 'безопасное место',
  UserFlashcard: 'флэшкарты',
  UserPractice: 'практики',
  PracticePlan: 'планы практик',
  ChildhoodRating: 'колесо детства',
  ScheduledNotification: 'уведомления',
  SchemaDiaryEntry: 'дневник схем',
  ModeDiaryEntry: 'дневник режимов',
  GratitudeDiaryEntry: 'дневник благодарности',
  AppActivity: 'активность',
  UserTask: 'задания',
  DiaryDraft: 'черновики',
  TherapyRelation: 'связи терапевт↔клиент',
  Pair: 'пары',
};

export function MergePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setAccessToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const token = params.get('token') ?? '';
  const summaryStr = params.get('summary') ?? '{}';
  const providerName = params.get('provider') ?? 'провайдер';
  const otherName = params.get('name') ?? '';

  let summary: Record<string, number> = {};
  try { summary = JSON.parse(summaryStr); } catch { /* keep empty */ }
  const totalItems = Object.values(summary).reduce((s, n) => s + n, 0);

  useEffect(() => {
    if (!token) navigate('/account', { replace: true });
  }, [token, navigate]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/merge`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'webapp' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Merge failed' }));
        throw new Error(body.message ?? 'Merge failed');
      }
      const { accessToken, expiresIn } = await res.json() as { accessToken: string; expiresIn: number };
      setAccessToken(accessToken, expiresIn);
      navigate('/account', { replace: true });
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  return (
    <div className="page-inner-wide" style={{ paddingTop: 80, paddingBottom: 80, maxWidth: 720, margin: '0 auto' }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>Аккаунт</div>
      <h1 style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 18 }}>
        Объединить аккаунты?
      </h1>
      <div className="text-md muted" style={{ maxWidth: 600, lineHeight: 1.6, marginBottom: 36 }}>
        Аккаунт <b>{providerName}</b>{otherName ? ` (${otherName})` : ''} уже существует со своими данными. Если объединить – все они переедут в твой текущий аккаунт.
      </div>

      <div className="section">
        <div className="section-head">
          <h3>В переносимом аккаунте</h3>
          {totalItems > 0 && <span className="hint">{totalItems} {totalItems === 1 ? 'запись' : totalItems < 5 ? 'записи' : 'записей'}</span>}
        </div>
        {totalItems === 0 ? (
          <div className="text-sm muted">Нет данных – объединение пройдёт без переноса.</div>
        ) : (
          Object.entries(summary).map(([table, n]) => (
            <div key={table} className="list-line">
              <span className="text-sm" style={{ flex: 1 }}>{TABLE_LABELS[table] ?? table}</span>
              <span className="num text-md" style={{ fontWeight: 500 }}>{n}</span>
            </div>
          ))
        )}
      </div>

      <div className="section">
        <div className="text-sm" style={{ color: 'var(--c-amber)', lineHeight: 1.6, maxWidth: 600 }}>
          Если в обоих аккаунтах есть пересекающиеся записи (одна и та же оценка за один день, например) – версия текущего аккаунта остаётся, дубль из второго удаляется. <b>Действие необратимо.</b>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 8, marginBottom: 16, padding: '12px 14px', borderLeft: '3px solid var(--c-rose)', background: 'color-mix(in srgb, var(--c-rose) 6%, transparent)' }}>
          <div className="text-sm" style={{ color: 'var(--c-rose)', fontWeight: 500 }}>{error}</div>
        </div>
      )}

      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 24, cursor: busy ? 'default' : 'pointer', maxWidth: 600 }}>
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={e => setAcknowledged(e.target.checked)}
          disabled={busy}
          style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--accent)' }}
        />
        <span className="text-sm" style={{ lineHeight: 1.5 }}>
          Я понимаю что данные второго аккаунта необратимо переедут, а сам тот аккаунт будет удалён.
        </span>
      </label>

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button disabled={busy || !acknowledged} onClick={confirm} className="btn btn-primary">
          {busy ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              Объединяю…
            </span>
          ) : 'Объединить'}
        </button>
        <button disabled={busy} onClick={() => navigate('/account')} className="btn btn-secondary">
          Отмена
        </button>
      </div>
    </div>
  );
}
