import '../../styles/therapist-tabs.css';
import { SCHEMA_DOMAINS } from '../../schemaTherapyData';
import { useTr } from '../../utils/addressForm';
import { DOMAIN_HUE, hueStyle } from '../../lib/tone';
import { fmtDate, momentDayKey } from '../../utils/format';
import type { ClientData, TherapyClientSummary } from '../../api';
import { isVirtualId } from '../../../../shared/src/utils/sameId';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import { CONCEPT_EXPORT_EMPTY } from '../../../../shared/src/therapy/conceptExport';
import { buildYsqRows, YSQ_TOP_N } from './ysqRows';
import { TabTitle } from './TabTitle';
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
  exportEmpty?: boolean; // пустой концепт: экспорт недоступен, подсказка строкой
  handleRequestYsq: () => void;
  handleExport: () => void;
}

export function ClientYSQTab({ clientData, selectedClient, selfSchemaIds, ysqRequested, ysqError, exportCopied, exportEmpty = false, handleRequestYsq, handleExport }: Props) {
  const tr = useTr();
  const virtual = isVirtualId(selectedClient.telegramId);

  if (!clientData?.ysqHistory || clientData.ysqHistory.length === 0) {
    return (
      <div className="ds-page tb-page--ysq">
        <div className="u-col8">
          <p className="ds-empty">YSQ ещё не проходился</p>
          {virtual ? (
            <div className="tb-meta">У офлайн-клиента нет аккаунта – тест пройти негде</div>
          ) : (
            <>
              <div className="ds-sub">{tr('Запроси тест – у клиента появится задание «Пройти тест на схемы», а в Telegram придёт сообщение, если он привязан', 'Запросите тест – у клиента появится задание «Пройти тест на схемы», а в Telegram придёт сообщение, если он привязан')}</div>
              <button onClick={handleRequestYsq} disabled={ysqRequested} className="ds-btn ds-btn--sm" style={{ alignSelf: 'flex-start' }}>
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
                return <span key={id} className="ds-chip tone-tint" style={hueStyle(domain ? DOMAIN_HUE[domain.id] : undefined)}>{s?.name ?? id}</span>;
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
    <div className="ds-page tb-page--ysq">
      <div className="ds-head-row">
        <TabTitle title="Опросник схем YSQ">
          <div className="ds-sub">{hist.length} {pluralRu(hist.length, 'прохождение', 'прохождения', 'прохождений')} · последнее {clientData.ysqCompletedAt ? fmtDate(momentDayKey(clientData.ysqCompletedAt)) : '–'}</div>
        </TabTitle>
        <div className="tb-actions">
          <button onClick={handleExport} disabled={exportEmpty} className="ds-btn ds-btn--sm ds-btn--secondary">
            {exportCopied ? '✓ Скопировано' : 'Экспорт'}
          </button>
          {!virtual && (
            <button onClick={handleRequestYsq} disabled={ysqRequested} className="ds-btn ds-btn--sm">
              {ysqRequested ? '✓ Запрос отправлен' : 'Запросить повтор'}
            </button>
          )}
        </div>
      </div>
      {exportEmpty && <div className="tb-meta">{CONCEPT_EXPORT_EMPTY}</div>}
      {ysqError && <div className="tb-error">{ysqError}</div>}

      <YSQTable rows={rows} hasPrev={hist.length > 1} />
      {hist.length >= 2 && <YSQDynamics chronHist={hist.slice().reverse()} top={rows.slice(0, YSQ_TOP_N)} />}
    </div>
  );
}
