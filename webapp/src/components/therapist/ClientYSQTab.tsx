import '../../styles/therapist-tabs.css';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { fmtDate, momentDayKey } from '../../utils/format';
import type { ClientData, TherapyClientSummary } from '../../api';
import { isVirtualId } from '../../../../shared/src/utils/sameId';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { buildYsqRows, YSQ_TOP_N } from './ysqRows';
import { YSQTable } from './YSQTable';
import { YSQDynamics } from './YSQDynamics';

interface Props {
  clientData: ClientData | null;
  selectedClient: TherapyClientSummary;
  selfSchemaIds: string[];
  ysqSchemaIds: string[];
  ysqRequested: boolean;
  ysqError: string;
  exportCopied: boolean;
  handleRequestYsq: () => void;
  handleExport: () => void;
}

export function ClientYSQTab({ clientData, selectedClient, selfSchemaIds, ysqRequested, ysqError, exportCopied, handleRequestYsq, handleExport }: Props) {
  const virtual = isVirtualId(selectedClient.telegramId);

  if (!clientData?.ysqHistory || clientData.ysqHistory.length === 0) {
    return (
      <div className="ds-page tb-page tb-page--ysq">
        <div className="tb-ysq-empty">
          <div className="ds-h2">YSQ ещё не проходился</div>
          {virtual ? (
            <div className="tb-meta">Клиент без Telegram – YSQ недоступен</div>
          ) : (
            <>
              <div className="ds-sub">Запроси тест – клиент получит уведомление в боте</div>
              <button onClick={handleRequestYsq} disabled={ysqRequested} className="ds-btn">
                {ysqRequested ? '✓ Запрос отправлен' : 'Запросить тест на схемы'}
              </button>
              {ysqError && <div className="tb-error">{ysqError}</div>}
            </>
          )}
        </div>
        {selfSchemaIds.length > 0 && (
          <div>
            <div className="ds-label tb-archive-label">Схемы, отмеченные клиентом самостоятельно</div>
            <div className="tb-tags">
              {selfSchemaIds.map(id => {
                const s = SCHEMA_DOMAINS.flatMap(d => d.schemas).find(x => x.id === id);
                const domain = SCHEMA_DOMAINS.find(d => d.schemas.some(x => x.id === id));
                return (
                  <div key={id} className="tag-mini">
                    <span className="swatch" style={{ background: domain?.color ?? 'var(--accent)' }} />
                    {s?.name ?? id}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  const hist = clientData.ysqHistory;
  const rows = buildYsqRows(hist[0], hist[1] ?? null);

  return (
    <div className="ds-page tb-page tb-page--ysq">
      <div className="ds-head-row tb-ysq-head-row">
        <div>
          <h2 className="tb-h32">Опросник схем YSQ</h2>
          <div className="tb-sub">
            {hist.length} {pluralRu(hist.length, 'прохождение', 'прохождения', 'прохождений')} · последнее {clientData.ysqCompletedAt ? fmtDate(momentDayKey(clientData.ysqCompletedAt)) : '–'}
          </div>
        </div>
        <div className="tb-actions">
          <button onClick={handleExport} className="ds-btn ds-btn--sm ds-btn--secondary">
            {exportCopied ? '✓ Скопировано' : 'Экспорт'}
          </button>
          {!virtual && (
            <button onClick={handleRequestYsq} disabled={ysqRequested} className="ds-btn ds-btn--sm">
              {ysqRequested ? '✓ Запрос отправлен' : 'Запросить повтор'}
            </button>
          )}
        </div>
      </div>
      {ysqError && <div className="tb-error">{ysqError}</div>}

      <YSQTable rows={rows} hasPrev={hist.length > 1} />
      {hist.length >= 2 && <YSQDynamics chronHist={hist.slice().reverse()} top={rows.slice(0, YSQ_TOP_N)} />}
    </div>
  );
}
