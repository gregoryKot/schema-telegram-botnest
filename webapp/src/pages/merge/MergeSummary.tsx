import { totalItems } from '../../utils/mergeLabels';
import { useTr } from '../../utils/addressForm';
import { Skeleton } from '../../components/Skeleton';
import { ServiceRows } from '../service/ServiceRows';
import { providerName } from '../account/providerNames';
import { pluralRu } from '../../../../shared/src/utils/pluralRu';
import type { MergePreviewState } from './useMergePreview';

// Чей второй аккаунт и что из него переедет — только из ответа сервера
// (useMergePreview). Пока грузится — силуэт абзаца и строк; не загрузилось —
// нейтрально «найден ещё один аккаунт», без имён и цифр.
export function MergeSummary({ preview }: { preview: MergePreviewState }) {
  const tr = useTr();
  const moves = tr('Если объединить – всё, что в нём записано, переедет в твой текущий аккаунт.', 'Если объединить – всё, что в нём записано, переедет в ваш текущий аккаунт.');
  if (preview.kind === 'loading') {
    return (
      <div aria-hidden="true">
        <Skeleton height={14} />
        <Skeleton height={14} width="80%" style={{ marginTop: 8 }} />
        <Skeleton height={44} radius={12} style={{ marginTop: 16 }} />
      </div>
    );
  }
  if (preview.kind === 'failed') return <p className="as-lead">Найден ещё один аккаунт. {moves}</p>;
  const name = providerName(preview.provider);
  const total = totalItems(preview.summary);
  return (
    <>
      <p className="as-lead">
        {name ? <>Аккаунт <b>{name}</b></> : 'Другой аккаунт'}{preview.otherDisplay ? ` (${preview.otherDisplay})` : ''} уже существует. {moves}
      </p>
      <div className="as-sec-head">
        <div className="ds-label">В переносимом аккаунте</div>
        {total > 0 && <span className="ds-sub">{total} {pluralRu(total, 'запись', 'записи', 'записей')}</span>}
      </div>
      {total === 0 ? <p className="as-lead">Нет данных – объединение пройдёт без переноса.</p> : <ServiceRows summary={preview.summary} />}
    </>
  );
}
