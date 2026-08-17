import { SectionHeader } from './ui';
import { PairPanel } from '../pairSheet/PairPanel';
import { usePairMechanics } from '../pairSheet/usePairMechanics';

// «Партнёр» в настройках — компактная секция той же механики «пара», что и
// PairSheet.tsx («Вместе»). Логика/состояние/разметка общие
// (usePairMechanics + PairPanel, правило №11 CLAUDE.md); эта поверхность
// после создания приглашения best-effort зовёт нативный navigator.share —
// полноэкранная карточка-приглашение здесь неуместна (тесная секция внутри
// настроек, не отдельный экран).
export function PartnerSection({ onInfo }: { onInfo: () => void }) {
  const pair = usePairMechanics((_code, url) => {
    if (!navigator.share) return;
    navigator
      .share({ text: `Давай отслеживать потребности вместе! ${url}` })
      .catch(() => {
        /* best-effort: ошибку намеренно игнорируем */
      });
  });

  return (
    <div style={{ marginBottom: 8 }}>
      <SectionHeader onInfo={onInfo}>ПАРТНЁР</SectionHeader>
      <div className="card" style={{ borderRadius: 16, padding: 16 }}>
        <PairPanel pair={pair} compact />
      </div>
    </div>
  );
}
