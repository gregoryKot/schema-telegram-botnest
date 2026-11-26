import { GlyphChevron } from '../exercises/ExGlyphs';
import { SignGroup } from '../schemaSheets/SignGroup';
import type { buildModes } from './data';
import { libraryGroupLook } from './modesLook';
import { ModeShareButton } from './ModeShareButton';

type Group = ReturnType<typeof buildModes>[number];

/** Группа режимов справочника: лист бумаги группы со знаком (у копингов — три) у подписи — тот же
 *  SignGroup, что у групп «Паттернов» и листов выбора (сведение b15+b16); режимы — белый список: имя
 *  и «Чувствуется как», описание и «Поделиться» — по раскрытию строки (открыта одна, openMode). */
export function ModesGroup({ group: g, openMode, onToggle }: { group: Group; openMode: string | null; onToggle: (name: string) => void }) {
  const look = libraryGroupLook(g);
  return (
    <SignGroup look={{ hue: look.hue }} signs={look.signs} title={g.group}>
      {g.items.map((m) => {
        const isOpen = openMode === m.name;
        return (
          <div key={m.name} className={`ss-mode${isOpen ? ' is-open' : ''}`}>
            <button type="button" className="ss-mode-head" aria-expanded={isOpen} onClick={() => onToggle(m.name)}>
              <span className="ss-mode-text">
                <span className="ss-mode-name">{m.name}</span>
                <span className="ss-mode-feel">Чувствуется как: {m.feel}</span>
              </span>
              <span className={`ss-chev${isOpen ? ' is-open' : ''}`} aria-hidden="true"><GlyphChevron /></span>
            </button>
            {isOpen && (
              <div className="ss-mode-more">
                <p className="ss-body ss-body--sm">{m.desc}</p>
                <ModeShareButton group={g.group} color={g.color} name={m.name} feel={m.feel} desc={m.desc} />
              </div>
            )}
          </div>
        );
      })}
    </SignGroup>
  );
}
