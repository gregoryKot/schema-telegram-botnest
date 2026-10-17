/** Список «что считается» — общий для десктопной и мобильной раскладки. */
export function NeedExamples({ examples }: { examples: string[] }) {
  return (
    <ul className="tk2-ex">
      {examples.map((ex, i) => (
        <li key={i}>
          <span className="tk2-ex-n">{i + 1}.</span>
          <span className="tk2-ex-t">{ex}</span>
        </li>
      ))}
    </ul>
  );
}
