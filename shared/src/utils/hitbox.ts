// hitboxStyle() — расширяет кликабельную/тач-зону мелкого визуального элемента
// (иконка-кнопка, точка-пагинатор) до accessibility-минимума 44×44 (24×24 для
// мелких индикаторов, где 44 визуально не помещается), не меняя видимый размер.
//
// Техника: внешний элемент занимает hitSize×hitSize, но отрицательный margin
// компенсирует прирост — во flow-раскладке родителя он по-прежнему занимает
// ровно visualW×visualH (margin вычитается из вклада в поток), а сам
// прямоугольник заливки/попадания курсора рисуется больше и наезжает на
// соседний padding/gap. Видимый стиль (фон, radius, цвет) остаётся на
// внутреннем элементе — outer прозрачен.
//
// Правило «одна механика — один компонент» (CLAUDE.md): дизайн-аудит 2026-08
// (К3) нашёл эту растяжку нужной в шести местах обоих фронтендов — вместо
// копипасты пары margin/padding в каждом общий расчёт живёт здесь.
export interface HitboxStyles {
  outer: {
    width: number;
    height: number;
    marginLeft: number;
    marginRight: number;
    marginTop: number;
    marginBottom: number;
    padding: number;
    border: 'none';
    background: 'transparent';
    display: 'flex';
    alignItems: 'center';
    justifyContent: 'center';
    cursor: 'pointer';
  };
  inner: { width: number; height: number };
}

export function hitboxStyle(
  visualW: number,
  visualH: number,
  hitSize = 44,
): HitboxStyles {
  const padX = Math.max(0, (hitSize - visualW) / 2);
  const padY = Math.max(0, (hitSize - visualH) / 2);
  return {
    outer: {
      width: hitSize,
      height: hitSize,
      marginLeft: padX === 0 ? 0 : -padX,
      marginRight: padX === 0 ? 0 : -padX,
      marginTop: padY === 0 ? 0 : -padY,
      marginBottom: padY === 0 ? 0 : -padY,
      padding: 0,
      border: 'none',
      background: 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
    },
    inner: { width: visualW, height: visualH },
  };
}
