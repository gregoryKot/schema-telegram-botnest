import { SignArt } from '../../components/art/SignArt';
import { tableLabel } from '../../utils/mergeLabels';
import { dataKindSign } from './dataKindSign';

// «Что переедет» на /link и /account/merge: строка — знак вида данных (dataKindSign) размера строки,
// название, число справа. Знак декоративный: смысл несёт подпись.
export function MergeRows({ summary }: { summary: Record<string, number> }) {
  return (
    <ul className="am-rows">
      {Object.entries(summary).map(([table, n]) => {
        const sign = dataKindSign(table);
        return (
          <li key={table} className="am-row">
            <span className="am-row-sign" aria-hidden="true">{sign && <SignArt sign={sign} size="row" />}</span>
            <span className="am-row-label">{tableLabel(table)}</span>
            <span className="am-row-n">{n}</span>
          </li>
        );
      })}
    </ul>
  );
}
