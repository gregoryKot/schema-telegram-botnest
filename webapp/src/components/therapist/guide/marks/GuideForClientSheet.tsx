import { useState } from 'react';
import { GuideReference } from '../../../../sections/guide/GuideReference';
import { ConceptFullscreenSheet } from '../../ConceptFullscreenSheet';
import type { GuideMarkClient } from './useClientGuideMarks';

/**
 * «Справочник» поверх карточки клиента: выделение и «Про клиента» сразу идут этому клиенту. С `address` лист
 * раздела открывается сразу («Открыть в справочнике» у отметки). Закрытие отдаёт управление карточке: она перечитывает отметки.
 */
export function GuideForClientSheet({ client, address, onClose }: { client: GuideMarkClient; address?: string; onClose: () => void }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <ConceptFullscreenSheet title="Справочник" closeLabel="Закрыть" onClose={onClose}>
      <GuideReference key={attempt} onRetry={() => setAttempt((a) => a + 1)} client={client} openAddress={address} />
    </ConceptFullscreenSheet>
  );
}
