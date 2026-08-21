import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';
import { GearButton } from '../../components/GearButton';
import { TherapyRelationInfo } from '../../api';
import { NextSessionBanner } from './NextSessionBanner';

// Шапка «Здесь и сейчас»: заголовок + значок ⚠️ «Важное о самопомощи»
// (открывает SelfHelpSheet; был широким чипом с текстом — по фидбеку
// владельца сузили до компактной кнопки-значка) + шестерёнка настройки
// инструментов.
//
// Ж2 (аудит 2026-08): раньше было ДВА входа в один и тот же лист —
// эта шестерёнка И пилюля «Настроить» у заголовка «Инструменты» ниже по
// экрану. Владелец не находил пилюлю (слишком глубоко по скроллу), поэтому
// оставлен один вход — шестерёнка здесь, сразу под заголовком, без скролла.
// Она же и единообразнее: тот же `GearButton` открывает «настроить экран»
// на «Сегодня» и «Паттернах» — единый паттерн входа во всех трёх секциях,
// а не разовая пилюля только в «Инструментах». Пилюля удалена из
// ToolsList.tsx; открытие листа по-прежнему идёт через customizeOpenRef
// (состояние листа живёт в ToolsList, шестерёнка — в этом компоненте).
// Вынесено из HelpSection.tsx — файл-храповик у потолка (правило №10 CLAUDE.md).
interface Props {
  relation: TherapyRelationInfo | null | undefined;
  onOpenSelfHelp: () => void;
  onOpenCustomize: () => void;
}

export function HelpHeader({
  relation,
  onOpenSelfHelp,
  onOpenCustomize,
}: Props) {
  const tr = useTr();
  return (
    <div style={{ padding: '20px 20px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h1 className="d-display" style={{ fontSize: 26, margin: 0 }}>
          Здесь и сейчас
        </h1>
        <button
          {...pressable(onOpenSelfHelp)}
          aria-label="Важное о самопомощи"
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            flexShrink: 0,
            border: 'none',
            cursor: 'pointer',
            fontSize: 20,
            color: 'var(--ink-2)',
            background:
              'color-mix(in srgb, var(--accent-yellow) 16%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          ⚠️
        </button>
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <GearButton
            onClick={onOpenCustomize}
            ariaLabel="Настроить инструменты"
          />
        </div>
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-sub)',
          marginTop: 4,
          lineHeight: 1.5,
        }}
      >
        {tr(
          'Тяжёлый момент? Начни с одного вдоха',
          'Тяжёлый момент? Начните с одного вдоха',
        )}
      </div>
      <NextSessionBanner relation={relation} />
    </div>
  );
}
