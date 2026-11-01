import { useState, useEffect } from 'react';
import { API_BASE } from '../../utils/apiBase'; import { useTr } from '../../utils/addressForm';
import { LimitedTextarea } from '../../../../shared/src/components/LimitedTextarea';
import * as LIM from '../../../../shared/src/limits/textLimits';
import { humanizeThrown, readHumanError } from '../../../../shared/src/api/humanizeError';
import { TherapistRequestRejectedNote } from '../../../../shared/src/therapy/TherapistRequestRejectedNote';

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
  const tr = useTr(); const [req, setReq] = useState<TherapistRequest | null>(null);
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
      if (!r.ok) throw new Error((await readHumanError(r, 'Не удалось отправить заявку')).message);
      setReq({ id: 0, status: 'pending', rejectReason: null, createdAt: new Date().toISOString(), reviewedAt: null });
      setOpen(false);
    } catch (e) {
      setErr(humanizeThrown(e, 'Не удалось отправить заявку'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ds-card ds-card--ink aa-role">
      <div className="aa-role-label">Роль психолога</div>
      <TherapistRequestRejectedNote request={req} className="aa-role-note" />
      {req?.status === 'pending' ? (
        <div className="aa-role-note">
          {tr('Твоя заявка на рассмотрении. О решении сообщим в Telegram, на почту или по контактам из заявки; здесь тоже обновится статус.', 'Ваша заявка на рассмотрении. О решении сообщим в Telegram, на почту или по контактам из заявки; здесь тоже обновится статус.')}
        </div>
      ) : req?.status === 'approved' ? (
        <div className="aa-role-note">
          {tr('Заявка одобрена. Перезайди в приложение.', 'Заявка одобрена. Перезайдите в приложение.')}
        </div>
      ) : !open ? (
        <>
          <div className="ds-h3">{tr('Ведёшь клиентов? Открой кабинет терапевта', 'Ведёте клиентов? Откройте кабинет терапевта')}</div>
          <button onClick={() => setOpen(true)} className="ds-btn">
            Я психолог — подать заявку
          </button>
        </>
      ) : (
        <div className="aa-role-form">
          <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="ФИО" maxLength={LIM.THERAPIST_REQUEST_NAME_MAX} className="ds-input" />
          <LimitedTextarea max={LIM.THERAPIST_REQUEST_QUAL_MAX} value={qualification} onChange={e => setQualification(e.target.value)} rows={3}
            placeholder="Квалификация: образование, направление, опыт, сертификаты" className="ds-textarea" />
          <input value={contacts} onChange={e => setContacts(e.target.value)} placeholder="Контакты: сайт, @telegram, b17 и т.д." maxLength={LIM.THERAPIST_REQUEST_CONTACTS_MAX} className="ds-input" />
          <LimitedTextarea max={LIM.THERAPIST_REQUEST_MESSAGE_MAX} value={message} onChange={e => setMessage(e.target.value)} rows={2}
            placeholder="Сообщение админу (необязательно)" className="ds-textarea" />
          <div className="aa-actions">
            <button disabled={busy} onClick={() => setOpen(false)} className="ds-btn ds-btn--secondary">Отмена</button>
            <button disabled={busy} onClick={submit} className="ds-btn">{busy ? 'Отправляю…' : 'Отправить заявку'}</button>
          </div>
          {err && <div className="aa-fail">{err}</div>}
        </div>
      )}
    </div>
  );
}
