import { pressable } from '../../utils/a11y';
import { useTr } from '../../utils/addressForm';
import { GearButton } from '../../components/GearButton';
import { TherapyRelationInfo } from '../../api';
import { NextSessionBanner } from './NextSessionBanner';

// Шапка «Здесь и сейчас»: заголовок + значок ⚠️ «Важное о самопомощи»
// (открывает SelfHelpSheet; был широким чипом с текстом — по фидбеку
// владельца сузили до компактной кнопки-значка) + заметная шестерёнка
// настройки инструментов — второй (быстрый) вход в тот же лист, что и
// пилюля «Настроить» у «Инструментов» ниже по экрану (владелец не находил
// её — слишком глубоко по скроллу). Вынесено из HelpSection.tsx —
// файл-храповик у потолка (правило №10 CLAUDE.md).
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
        <div className="d-display" style={{ fontSize: 26 }}>
          Здесь и сейчас
        </div>
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
