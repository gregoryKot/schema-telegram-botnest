// Стрелка «открыть ещё раз, снаружи» у ссылки — SVG, а не глиф «→» в тексте
// (docs/design/APP_2026-11.md, принцип 7). Цвет — цвет ссылки (currentColor).
export function OutArrow() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      style={{ marginLeft: 6 }}
    >
      <path
        d="M3 8h9M8.5 4l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
