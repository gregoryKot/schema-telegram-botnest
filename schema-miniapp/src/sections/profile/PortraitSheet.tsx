// Лист «Мой портрет» — открывается тапом по карточке PortraitCard. Полные
// списки «Мои схемы»/«Мои режимы» переехали сюда с профиля целиком (были
// отдельными карточками — правило «Онбординг»: одна карточка портрета,
// одно очевидное действие вместо трёх конкурирующих). REUSE MyPatternsCard
// (правило «одна механика — один компонент») — здесь просто без лимита в 3
// строки. PatternSheet, открытый строкой изнутри, — сам BottomSheet, поэтому
// получает поднятый zIndex (см. MyPatternsCard.patternSheetZIndex).
import { BottomSheet } from '../../components/BottomSheet';
import { useTr } from '../../utils/addressForm';
import { MyPatternsCard } from './MyPatternsCard';
import { PortraitNeedRows } from './PortraitNeedRows';
import type { AboutMeState } from './useAboutMe';

// PatternSheet сам — BottomSheet поверх этого (backdrop 200/панель 201) —
// поднимаем достаточно, чтобы не спорить со вложенным ShareCardSheet
// PatternSheet (zIndex + 20, см. patternSheet/PatternSheet.tsx).
const NESTED_PATTERN_SHEET_Z = 300;

interface Props {
  aboutMe: AboutMeState;
  onOpenPatterns: (tab: 'schemas' | 'modes') => void;
  onClose: () => void;
}

export function PortraitSheet({ aboutMe, onOpenPatterns, onClose }: Props) {
  const tr = useTr();

  function openPatterns(tab: 'schemas' | 'modes') {
    // Закрываем лист ДО навигации — иначе он остаётся смонтированным поверх
    // вкладки «Паттерны» (тот же приём, что у закрытия других профильных
    // листов перед переходом).
    onClose();
    onOpenPatterns(tab);
  }

  const isEmpty =
    aboutMe.mySchemaIds.length === 0 && aboutMe.myModeIds.length === 0;

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
          Мой портрет
        </div>

        {isEmpty && (
          <div
            style={{
              marginTop: 14,
              fontSize: 13,
              color: 'var(--text-sub)',
              lineHeight: 1.6,
            }}
          >
            {tr(
              'Отметь схемы и режимы, которые узнаёшь у себя, — или пройди тест на схемы. Здесь появятся их карточки.',
              'Отметьте схемы и режимы, которые узнаёте у себя, — или пройдите тест на схемы. Здесь появятся их карточки.',
            )}
          </div>
        )}

        {/* Пять базовых потребностей — та же группировка, что теперь у
            карточки на профиле. Тап по строке раскрывает объяснение (правило
            «Онбординг»: смысл в контексте, не в спрятанном About). */}
        <PortraitNeedRows needs={aboutMe.portrait.needs} />

        <div
          style={{
            marginTop: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <MyPatternsCard
            kind="schema"
            ids={aboutMe.mySchemaIds}
            weekFreq={aboutMe.schemaWeekFreq}
            schemaEntries={aboutMe.schemaEntries}
            setSchemaEntries={aboutMe.setSchemaEntries}
            onOpenPatterns={openPatterns}
            limit={Infinity}
            patternSheetZIndex={NESTED_PATTERN_SHEET_Z}
          />
          <MyPatternsCard
            kind="mode"
            ids={aboutMe.myModeIds}
            weekFreq={aboutMe.modeWeekFreq}
            modeEntries={aboutMe.modeEntries}
            setModeEntries={aboutMe.setModeEntries}
            onOpenPatterns={openPatterns}
            limit={Infinity}
            patternSheetZIndex={NESTED_PATTERN_SHEET_Z}
          />
        </div>
      </div>
    </BottomSheet>
  );
}
