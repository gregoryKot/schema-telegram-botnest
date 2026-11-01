import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { totalItems as sumItems } from '../utils/mergeLabels';
import { useTr } from '../utils/addressForm';
import { TwoFactorLossNote } from '../components/TwoFactorLossNote';
import { useMergeConfirm } from './merge/useMergeConfirm';
import { ServicePage } from './service/ServicePage';
import { ServiceRows } from './service/ServiceRows';
import { SourceTotpField } from './merge/SourceTotpField';
import { AckCheck } from './merge/AckCheck';
import { providerName } from './account/providerNames';

export function MergePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tr = useTr();
  const [acknowledged, setAcknowledged] = useState(false);

  const token = params.get('token') ?? '';
  const summaryStr = params.get('summary') ?? '{}';
  // В адресе — id провайдера (google, vk…); показываем имя, неизвестный id не показываем.
  const provider = providerName(params.get('provider'));
  const otherName = params.get('name') ?? '';
  const twoFactorLost = params.get('twofa') === '1';

  let summary: Record<string, number> = {};
  try { summary = JSON.parse(summaryStr); } catch { /* keep empty */ }
  const totalItems = sumItems(summary);
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
          {provider ? <>Аккаунт <b>{provider}</b></> : 'Другой аккаунт'}{otherName ? ` (${otherName})` : ''} уже существует со своими данными.{' '}{tr('Если объединить – все они переедут в твой текущий аккаунт.', 'Если объединить – все они переедут в ваш текущий аккаунт.')}
        </p>

        <div className="as-sec-head">
          <div className="ds-label">В переносимом аккаунте</div>
          {totalItems > 0 && <span className="ds-sub">{totalItems} {totalItems === 1 ? 'запись' : totalItems < 5 ? 'записи' : 'записей'}</span>}
        </div>
        {totalItems === 0 ? <p className="as-lead">Нет данных – объединение пройдёт без переноса.</p> : <ServiceRows summary={summary} />}

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
