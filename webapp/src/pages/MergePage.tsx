import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

const TABLE_LABELS: Record<string, string> = {
  Rating: 'оценки потребностей',
  YsqProgress: 'прогресс YSQ-теста',
  YsqResult: 'результат YSQ-теста',
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
        headers: { 'Content-Type': 'application/json' },
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
    <div style={{ flex: 1, padding: 24, maxWidth: 480, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '100%', boxSizing: 'border-box' }}>
      <div className="card" style={{ padding: 28 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🔀</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Объединить аккаунты?</h1>
        <p style={{ color: 'var(--text-sub)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
          Аккаунт <b>{providerName}</b>{otherName ? ` (${otherName})` : ''} уже существует со своими данными.
          Если объединить — все они переедут в твой текущий аккаунт.
        </p>

        {totalItems > 0 ? (
          <div style={{ background: 'rgba(var(--fg-rgb),0.04)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 8 }}>В переносимом аккаунте:</div>
            {Object.entries(summary).map(([table, n]) => (
              <div key={table} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                <span style={{ color: 'var(--text-sub)' }}>{TABLE_LABELS[table] ?? table}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{n}</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--text-faint)', marginBottom: 20 }}>
            В переносимом аккаунте нет данных — объединение пройдёт без переноса.
          </p>
        )}

        <p style={{ fontSize: 12, color: 'var(--accent-yellow)', lineHeight: 1.5, marginBottom: 16 }}>
          ⚠️ Если в обоих аккаунтах есть пересекающиеся записи (одна и та же оценка за один день, например) — версия текущего аккаунта остаётся, дубль из второго удаляется. Действие необратимо.
        </p>

        {error && (
          <div style={{ color: 'var(--accent-red)', fontSize: 13, marginBottom: 12 }}>{error}</div>
        )}

        <button disabled={busy} onClick={confirm} style={{
          width: '100%', padding: '14px 0', borderRadius: 12, border: 'none',
          background: 'var(--accent)', color: 'white', fontSize: 15, fontWeight: 600,
          cursor: busy ? 'default' : 'pointer', marginBottom: 8, opacity: busy ? 0.6 : 1,
        }}>
          {busy ? 'Объединяю...' : 'Объединить'}
        </button>
        <button disabled={busy} onClick={() => navigate('/account')} style={{
          width: '100%', padding: '14px 0', borderRadius: 12,
          border: '1px solid rgba(var(--fg-rgb),0.15)', background: 'transparent',
          color: 'var(--text-sub)', fontSize: 14, cursor: 'pointer',
        }}>
          Отмена
        </button>
      </div>
    </div>
  );
}
