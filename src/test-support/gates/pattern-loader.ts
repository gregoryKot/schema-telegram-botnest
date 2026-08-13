// Loads the exported `PATTERNS` (and similar RegExp[] exports) from a real
// scripts/*.mjs gate as plain data, so gendered-forms.spec.ts and
// robot-phrases.spec.ts can pin every named rule directly with a regex test
// against a corpus — not just indirectly through CLI stdout, like
// gate-sandbox.ts's runGate() does for the ratchet mechanics.
//
// Jest's own module system can't `import()` an ESM .mjs file without
// `--experimental-vm-modules` ("A dynamic import callback was invoked
// without --experimental-vm-modules"), so this shells out to a plain `node`
// process instead — same principle as runGate(), just importing rather than
// running as CLI. The gate script's scan/report logic must stay behind an
// `if (isMain)` guard so importing it has no side effects (no scanning the
// real repo tree, no process.exit).
import { spawnSync } from 'child_process';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { REAL_SCRIPTS_DIR } from './gate-sandbox';

export interface NamedPattern {
  name: string;
  source: string;
  flags: string;
}

export interface RawPattern {
  source: string;
  flags: string;
}

function importExport(
  scriptName: string,
  exportName: string,
  mapExpr: string,
): string {
  const url = pathToFileURL(join(REAL_SCRIPTS_DIR, scriptName)).href;
  const code = [
    `import(${JSON.stringify(url)}).then((m) => {`,
    `  const out = (${mapExpr})(m[${JSON.stringify(exportName)}]);`,
    `  process.stdout.write(JSON.stringify(out));`,
    `}).catch((e) => {`,
    `  process.stderr.write(String((e && e.stack) || e));`,
    `  process.exitCode = 1;`,
    `});`,
  ].join('\n');
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', code], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(
      `pattern-loader: import ${exportName} from ${scriptName} failed: ${res.stderr}`,
    );
  }
  return res.stdout;
}

/** Loads a `[string, RegExp][]` export (e.g. `PATTERNS`) as plain data. */
export function loadNamedPatterns(
  scriptName: string,
  exportName: string,
): NamedPattern[] {
  const stdout = importExport(
    scriptName,
    exportName,
    '(list) => list.map(([name, re]) => ({ name, source: re.source, flags: re.flags }))',
  );
  return JSON.parse(stdout) as NamedPattern[];
}

/** Loads a bare `RegExp[]` export (e.g. `ALLOW`) as plain data. */
export function loadRegexList(
  scriptName: string,
  exportName: string,
): RawPattern[] {
  const stdout = importExport(
    scriptName,
    exportName,
    '(list) => list.map((re) => ({ source: re.source, flags: re.flags }))',
  );
  return JSON.parse(stdout) as RawPattern[];
}
