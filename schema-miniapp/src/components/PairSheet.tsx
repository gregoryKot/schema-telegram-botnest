import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { ShareCardSheet } from '../share/ShareCardSheet';
import { pairInviteShare } from '../../../shared/src/share/cards/inviteShare';
import { PairPanel } from './pairSheet/PairPanel';
import { usePairMechanics } from './pairSheet/usePairMechanics';

interface Props {
  onClose: () => void;
}

// «Вместе» — полноэкранный лист механики «пара». Логика/состояние —
// usePairMechanics, разметка — PairPanel (общие с секцией настроек,
// см. settingsSheet/PartnerSection.tsx). Здесь — только шапка листа и то,
// что уникально для этой поверхности: карточка-приглашение после создания
// (правило №11 CLAUDE.md — вторая поверхность вместо неё best-effort шарит
// нативно, см. PartnerSection).
export function PairSheet({ onClose }: Props) {
  const [showInviteShare, setShowInviteShare] = useState(false);
  const pair = usePairMechanics(() => setShowInviteShare(true));

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 8 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 20,
          }}
        >
          Вместе
        </div>
        <PairPanel pair={pair} />
      </div>

      {showInviteShare && pair.inviteCode && (
        <ShareCardSheet
          {...pairInviteShare(pair.inviteCode, pair.inviteUrl)}
          onClose={() => setShowInviteShare(false)}
          zIndex={300}
        />
      )}
    </BottomSheet>
  );
}
