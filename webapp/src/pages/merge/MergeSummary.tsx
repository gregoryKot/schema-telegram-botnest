import { totalItems } from '../../utils/mergeLabels';
import { Skeleton } from '../../components/Skeleton';
import { MergeRows } from './MergeRows';
import { providerName } from '../account/providerNames';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import type { MergePreviewState } from './useMergePreview';
import { useMergeTexts } from './combinedText';

// Чей второй аккаунт, что из него переедет и что объединится — только из ответа
// сервера (useMergePreview). Грузится — силуэт абзаца и строк; не загрузилось —
// нейтрально «найден ещё один аккаунт», без имён и цифр.
export function MergeSummary({ preview }: { preview: MergePreviewState }) {
  const { moves, combined } = useMergeTexts(preview.kind === 'ok' ? preview.combined : 0);
  if (preview.kind === 'loading') {
    return (
      <div className="am-skel" aria-hidden="true">
        <Skeleton height={14} />
        <Skeleton height={14} width="80%" style={{ marginTop: 8 }} />
        <Skeleton height={44} radius={12} style={{ marginTop: 16 }} />
      </div>
    );
  }
  if (preview.kind === 'failed') return <p className="am-lead">Найден ещё один аккаунт. {moves}</p>;
  const name = providerName(preview.provider);
  const total = totalItems(preview.summary);
  return (
    <>
      <p className="am-lead">
        {name ? <>Аккаунт <b>{name}</b></> : 'Другой аккаунт'}{preview.otherDisplay ? ` (${preview.otherDisplay})` : ''} уже существует. {moves}
      </p>
      {combined && <p className="am-lead">{combined}</p>}
      <div className="am-sec-head">
        <div className="ds-label">В переносимом аккаунте</div>
        {total > 0 && <span className="ds-sub">{total} {pluralRu(total, 'запись', 'записи', 'записей')}</span>}
      </div>
      {total === 0 ? <p className="am-lead">Нет данных – объединение пройдёт без переноса.</p> : <MergeRows summary={preview.summary} />}
    </>
  );
}
