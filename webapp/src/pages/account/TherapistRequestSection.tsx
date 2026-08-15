import { useState, useEffect } from 'react';
import { API_BASE } from '../../utils/apiBase';
import { useTr } from '../../utils/addressForm';

// Секция «Роль психолога» (заявка терапевта). Вынесено из AccountPage.tsx
// (правило №10).
interface TherapistRequest {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export function TherapistRequestSection({ accessToken }: { accessToken: string | null }) {
  const tr = useTr();
  const [req, setReq] = useState<TherapistRequest | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [qualification, setQualification] = useState('');
  const [contacts, setContacts] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/therapy/request`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json()).then(setReq).catch(() => {})
      .finally(() => setLoaded(true));
  }, [accessToken]);

  if (!loaded) return null;

  const submit = async () => {
    setErr(null);
    if (!fullName.trim() || !qualification.trim() || !contacts.trim()) {
      setErr(tr('Заполни ФИО, квалификацию и контакты', 'Заполните ФИО, квалификацию и контакты'));
      return;
    }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE}/api/therapy/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          fullName: fullName.trim(),
          qualification: qualification.trim(),
          contacts: contacts.trim(),
          message: message.trim() || undefined,
        }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({ message: 'Ошибка' }));
        throw new Error(body.message ?? 'Ошибка');
      }
      setReq({ id: 0, status: 'pending', rejectReason: null, createdAt: new Date().toISOString(), reviewedAt: null });
      setOpen(false);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>Роль психолога</div>
      {req?.status === 'pending' ? (
        <div className="card-elevated" style={{ padding: 16, fontSize: 13, color: 'var(--text-sub)', lineHeight: 1.5 }}>
          {tr('Твоя заявка на рассмотрении. Рассмотрим её и напишем в боте.', 'Ваша заявка на рассмотрении. Рассмотрим её и напишем в боте.')}
        </div>
      ) : req?.status === 'approved' ? (
        <div className="card-elevated" style={{ padding: 16, fontSize: 13, color: 'var(--accent-green)' }}>
          {tr('Заявка одобрена. Перезайди в приложение.', 'Заявка одобрена. Перезайдите в приложение.')}
        </div>
      ) : !open ? (
        <button onClick={() => setOpen(true)} style={{ padding: '9px 20px', borderRadius: 6, border: '1px solid rgba(var(--fg-rgb),0.15)', background: 'transparent', color: 'var(--text-sub)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          Я психолог — подать заявку
        </button>
      ) : (
        <div className="card-elevated" style={{ padding: 16 }}>
          {req?.status === 'rejected' && (
            <div style={{ fontSize: 12, color: 'var(--accent-red)', marginBottom: 10, padding: 8, background: 'rgba(248,113,113,0.08)', borderRadius: 8 }}>
              Прошлая заявка отклонена{req.rejectReason ? `: ${req.rejectReason}` : ''}. {tr('Можешь подать новую.', 'Можете подать новую.')}
            </div>
          )}
          <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="ФИО"
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, background: 'rgba(var(--fg-rgb),0.06)', border: '1px solid rgba(var(--fg-rgb),0.12)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14 }} />
          <textarea value={qualification} onChange={e => setQualification(e.target.value)} rows={3}
            placeholder="Квалификация: образование, направление, опыт, сертификаты"
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, background: 'rgba(var(--fg-rgb),0.06)', border: '1px solid rgba(var(--fg-rgb),0.12)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
          <input value={contacts} onChange={e => setContacts(e.target.value)} placeholder="Контакты: сайт, @telegram, b17 и т.д."
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, background: 'rgba(var(--fg-rgb),0.06)', border: '1px solid rgba(var(--fg-rgb),0.12)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14 }} />
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2}
            placeholder="Сообщение админу (необязательно)"
            style={{ width: '100%', boxSizing: 'border-box', marginBottom: 8, background: 'rgba(var(--fg-rgb),0.06)', border: '1px solid rgba(var(--fg-rgb),0.12)', borderRadius: 10, padding: '10px 12px', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={busy} onClick={() => setOpen(false)} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid rgba(var(--fg-rgb),0.15)', background: 'transparent', color: 'var(--text-sub)', fontSize: 13, cursor: 'pointer' }}>Отмена</button>
            <button disabled={busy} onClick={submit} style={{ flex: 2, padding: '10px 0', borderRadius: 6, border: 'none', background: 'var(--text)', color: 'var(--bg)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Отправляю…' : 'Отправить заявку'}</button>
          </div>
          {err && <div style={{ fontSize: 12, color: 'var(--accent-red)', marginTop: 8 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
