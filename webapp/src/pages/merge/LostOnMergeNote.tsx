import { useTr } from '../../utils/addressForm';
import { WarnNote } from '../../components/WarnNote';
import { lostLines } from './lostText';

// Записи второго аккаунта с тем же ключом, что у текущего, сервер удаляет без
// объединения (src/auth/merge-lost.ts) — называем их до кнопки, а не после.
export function LostOnMergeNote({ lost }: { lost: Record<string, number> | undefined }) {
  const tr = useTr();
  const lines = lostLines(lost);
  if (lines.length === 0) return null;
  return (
    <WarnNote>
      {tr(
        'Это не переедет и удалится – в твоём аккаунте уже есть такие же записи, останутся они:',
        'Это не переедет и удалится – в вашем аккаунте уже есть такие же записи, останутся они:',
      )}
      <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
        {lines.map((l) => <li key={l}>{l}</li>)}
      </ul>
    </WarnNote>
  );
}

/** Сводка не загрузилась: что именно совпадёт, неизвестно — говорим правило. */
export function LostUnknownNote() {
  return (
    <WarnNote>
      Если в обоих аккаунтах есть одинаковые записи – оценка той же потребности за тот же день, незаконченный тест на схемы, – останутся записи текущего аккаунта, а дубли из второго удалятся.
    </WarnNote>
  );
}
