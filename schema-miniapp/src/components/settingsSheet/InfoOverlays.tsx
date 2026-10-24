import { InfoSheetShell } from '../InfoSheetShell';
import { useTr } from '../../utils/addressForm';
import { InfoParts } from '../../../../shared/src/settings/InfoParts';
import {
  settingsInfoTexts,
  type SettingsInfoKey,
} from '../../../../shared/src/settings/infoTexts';

// Три объясняющих листа настроек. Тексты — в shared/src/settings/infoTexts.ts
// (одна формулировка на оба фронтенда, правило №3); здесь только разметка.
function InfoOverlay({
  infoKey,
  onClose,
}: {
  infoKey: SettingsInfoKey;
  onClose: () => void;
}) {
  const tr = useTr();
  const { title, paragraphs } = settingsInfoTexts(tr)[infoKey];
  return (
    <InfoSheetShell title={title} onClose={onClose}>
      {paragraphs.map((p, i) => (
        <p
          key={i}
          style={{
            fontSize: p.lead ? 15 : 14,
            color: p.lead ? 'var(--text)' : 'var(--text-sub)',
            lineHeight: 1.7,
            marginBottom: i < paragraphs.length - 1 ? 12 : 0,
          }}
        >
          <InfoParts parts={p.parts} boldClassName="u-fg" />
        </p>
      ))}
    </InfoSheetShell>
  );
}

export const NotifyInfoOverlay = ({ onClose }: { onClose: () => void }) => (
  <InfoOverlay infoKey="notify" onClose={onClose} />
);
export const PairInfoOverlay = ({ onClose }: { onClose: () => void }) => (
  <InfoOverlay infoKey="pair" onClose={onClose} />
);
export const TherapistInfoOverlay = ({ onClose }: { onClose: () => void }) => (
  <InfoOverlay infoKey="therapist" onClose={onClose} />
);
