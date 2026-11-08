import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTr } from '../utils/addressForm';
import { TwoFactorLossNote } from '../components/TwoFactorLossNote';
import { useMergeConfirm } from './merge/useMergeConfirm';
import { ServicePage } from './service/ServicePage';
import { SourceTotpField } from './merge/SourceTotpField';
import { AckCheck } from './merge/AckCheck';
import { providerName } from './account/providerNames';

export function MergePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tr = useTr();
  const [acknowledged, setAcknowledged] = useState(false);

  const token = params.get('token') ?? '';
  // S20 (аудит 2026-11): `name` и `summary` из адреса не показываем — адрес
  // собирает кто угодно, а подписан только токен. Ручки «сводка по merge-токену»
  // у бэкенда пока нет — экран говорит нейтрально. Провайдер — из словаря.
  const provider = providerName(params.get('provider'));
  const twoFactorLost = params.get('twofa') === '1';
  const { busy, error, needCode, code, setCode, confirm } = useMergeConfirm(token);

  useEffect(() => {
    if (!token) navigate('/account', { replace: true });
  }, [token, navigate]);

  return (
    <ServicePage width={560}>
      <div className="as-body">
        <div className="ds-eyebrow">Аккаунт</div>
        <h1 className="ds-h2">Объединить аккаунты?</h1>
        <p className="as-lead">
          {provider ? <>Найден ещё один аккаунт – со входом через <b>{provider}</b>.</> : 'Найден ещё один аккаунт.'}{' '}
          {tr('Если объединить – всё, что в нём записано, переедет в твой текущий аккаунт.', 'Если объединить – всё, что в нём записано, переедет в ваш текущий аккаунт.')}
        </p>

        <p className="as-warn">
          Если в обоих аккаунтах есть пересекающиеся записи (одна и та же оценка за один день, например) – версия текущего аккаунта остаётся, дубль из второго удаляется. <b>Действие необратимо.</b>
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
