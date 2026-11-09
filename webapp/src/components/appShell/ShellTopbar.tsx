// Верхняя строка кабинета на компьютере (вынесена из AppShell.tsx, правило №10): «Перейти к… ⌘K» и
// «Мне плохо» у самого края. «Мне плохо» — постоянный вход в помощь из любого раздела: бережная
// бумага «Мне плохо» (ENTITY_LOOK.sos, роза 25) и её знак Heart, а не тонкая розовая таблетка,
// которая весила меньше поля поиска. Поиск тише: бумага страницы и линия. Офлайн — плашка под
// строкой (OfflineBanner), не отдельное слово в шапке. На телефоне строка скрыта (index.css).
import { NavSign } from './NavSign';

export function ShellTopbar({ therapistMode, onSearch, onSos }: {
  therapistMode: boolean;
  onSearch: () => void;
  onSos: () => void;
}) {
  return (
    <div className="topbar">
      <div className="t-spacer" />
      <button className="search-pill" onClick={onSearch}>
        <span>Перейти к…</span>
        <span className="sp-spacer" />
        <span className="ds-kbd kbd-hint">⌘K</span>
      </button>
      {!therapistMode && (
        <button className="topbar-sos" onClick={onSos}><NavSign sign="heart" />Мне плохо</button>
      )}
    </div>
  );
}
