import { pressable } from '../../utils/a11y';
import { TherapyClientSummary } from '../../api';
import { SessionCard } from './SessionCard';
import { ClinicalSnapshot } from './ClinicalSnapshot';
import { ActionButtons } from './ActionButtons';
import { ClientDetail } from './types';
import { WebBanner } from '../WebBanner';
import { WEB_CABINET_URL } from '../../utils/webBanner';
import { ClientNameHeader } from './ClientNameHeader';

interface ClientDetailViewProps {
  selectedClient: TherapyClientSummary;
  today: string;
  safeTop: number;
  animKey: number;
  switchView: (v: 'list' | 'client') => void;
  detail: ClientDetail;
  aliasInputRef: React.RefObject<HTMLInputElement | null>;
  startDateInputRef: React.RefObject<HTMLInputElement | null>;
  nextSessionInputRef: React.RefObject<HTMLInputElement | null>;
}

export function ClientDetailView({
  selectedClient,
  today,
  safeTop,
  animKey,
  switchView,
  detail,
  aliasInputRef,
  startDateInputRef,
  nextSessionInputRef,
}: ClientDetailViewProps) {
  const { setRenamingAlias, setYsqRequested, deleteError } = detail;

  return (
    <div
      key={`client-${animKey}`}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fade-in 0.22s ease',
      }}
    >
      {/* ── STICKY HEADER ── */}
      <div
        style={{
          flexShrink: 0,
          paddingTop: safeTop + 8,
          padding: `${safeTop + 8}px 20px 0`,
          background: 'var(--bg)',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}
        >
          {/* Back button — large touch target */}
          <div
            {...pressable(() => {
              switchView('list');
              setRenamingAlias(false);
              setYsqRequested(false);
            })}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: 'pointer',
              marginLeft: -8,
            }}
          >
            <span
              style={{
                fontSize: 26,
                color: 'var(--text-sub)',
                lineHeight: 1,
              }}
            >
              ‹
            </span>
          </div>

          {/* Name / rename — вынесено в ClientNameHeader (правило №10) */}
          <ClientNameHeader
            selectedClient={selectedClient}
            detail={detail}
            aliasInputRef={aliasInputRef}
          />
        </div>

        {/* Delete error */}
        {deleteError && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--accent-red)',
              marginTop: 4,
              textAlign: 'center',
            }}
          >
            {deleteError}
          </div>
        )}

        {/* Thin separator */}
        <div
          style={{
            height: 1,
            background: 'rgba(var(--fg-rgb),0.06)',
            margin: '10px -20px 0',
          }}
        />
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto' as const,
          padding: '12px 20px 100px',
        }}
      >
        {/* ── SESSION CARD ── */}
        <SessionCard
          selectedClient={selectedClient}
          today={today}
          detail={detail}
          startDateInputRef={startDateInputRef}
          nextSessionInputRef={nextSessionInputRef}
        />

        {/* ── CLINICAL SNAPSHOT ── */}
        <ClinicalSnapshot detail={detail} />

        {/* ── ACTION BUTTONS ── */}
        <ActionButtons detail={detail} />

        {/* Карта режимов — только на сайте (скрываемый баннер) */}
        <div style={{ marginTop: 12 }}>
          <WebBanner
            id="mode_map"
            emoji="🗺"
            title="Карта режимов клиента — на сайте"
            text="Визуальная схема-карта режимов с зонами, переходами и экспортом. В мини-аппе не помещается — редактор открывается в кабинете на сайте."
            url={WEB_CABINET_URL}
          />
        </div>
      </div>
    </div>
  );
}
