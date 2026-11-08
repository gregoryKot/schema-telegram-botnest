import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { TwoFactorLossNote } from '../components/TwoFactorLossNote';
import { useMergeConfirm } from './merge/useMergeConfirm';
import { ServicePage } from './service/ServicePage';
import { SourceTotpField } from './merge/SourceTotpField';
import { AckCheck } from './merge/AckCheck';
import { useMergePreview } from './merge/useMergePreview';
import { MergeSummary } from './merge/MergeSummary';

export function MergePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [acknowledged, setAcknowledged] = useState(false);

  const token = params.get('token') ?? '';
  // S20 (аудит 2026-11): имя и сводка — с сервера по подписанному токену, не из
  // адреса (его собирает кто угодно). Флаг 2FA из адреса — запасной: он только
  // добавляет предупреждение и нужен, пока сводка не загрузилась.
  const preview = useMergePreview(token, accessToken);
  const twoFactorLost = preview.kind === 'ok' ? preview.twoFactorLost : params.get('twofa') === '1';
  const { busy, error, needCode, code, setCode, confirm } = useMergeConfirm(token);

  useEffect(() => {
    if (!token) navigate('/account', { replace: true });
  }, [token, navigate]);

  return (
    <ServicePage width={560}>
      <div className="as-body">
        <div className="ds-eyebrow">Аккаунт</div>
        <h1 className="ds-h2">Объединить аккаунты?</h1>
        <MergeSummary preview={preview} />

        <p className="as-warn">
          Совпадающие оценки (одна и та же потребность за один день) и незаконченные черновики остаются из текущего аккаунта, дубль из второго удаляется. <b>Действие необратимо.</b>
        </p>

        {twoFactorLost && <TwoFactorLossNote />}

        {needCode && <SourceTotpField code={code} onChange={setCode} disabled={busy} />}

        {error && <div className="ds-card as-err">{error}</div>}

        <AckCheck checked={acknowledged} onChange={setAcknowledged} disabled={busy}>
          Я понимаю, что данные второго аккаунта необратимо переедут, а сам тот аккаунт будет удалён.
        </AckCheck>

        <div className="as-actions-row">
          <button disabled={busy || !acknowledged || (needCode && code.trim().length < 6)} onClick={confirm} className="ds-btn">
            {busy ? 'Объединяю…' : 'Объединить'}
          </button>
          <button disabled={busy} onClick={() => navigate('/account')} className="ds-btn ds-btn--secondary">
            Отмена
          </button>
        </div>
      </div>
    </ServicePage>
  );
}
