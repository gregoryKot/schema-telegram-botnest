// Трансформер ESM-пакетов Nest 12 для jest (src/test-support/esm-to-cjs.transform.cjs):
// без него ни один спек, импортирующий '@nestjs/common', не грузится на Node 22.
import { Injectable } from '@nestjs/common';
import { transformSync, type TransformOptions } from '@babel/core';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileFunction } from 'node:vm';

interface EsmToCjs {
  babelOptions: TransformOptions;
  process: unknown;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const transformer = require('./esm-to-cjs.transform.cjs') as EsmToCjs;

// Форма, на которой падал serve-static: свой `const require` из import.meta
// и `import()` — как ValidationPipe грузит class-validator.
const ESM = `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
export const url = import.meta.url;
export const dir = import.meta.dirname;
export const pathSep = require('path').sep;
export const load = () => import('path');
`;
const FILE = join(sep, 'pkg', 'dist', 'loader.js');

const compile = (options: TransformOptions): string =>
  transformSync(ESM, { ...options, filename: FILE })?.code ?? '';

type Loaded = {
  url: string;
  dir: string;
  pathSep: string;
  load: () => Promise<{ join: unknown }>;
};

function runAsCommonJs(code: string): Loaded {
  const module = { exports: {} as Loaded };
  // Та же обёртка, что у CJS-модуля: exports/require/module, без ESM-синтаксиса.
  const wrapper = compileFunction(code, ['exports', 'require', 'module']);
  wrapper(module.exports, require, module);
  return module.exports;
}

describe('esm-to-cjs.transform', () => {
  it('ESM с import.meta, своим require и import() исполняется как CommonJS', async () => {
    const code = compile(transformer.babelOptions);
    expect(code).not.toMatch(/import\.meta|\bimport\(|^\s*(import|export)\s/m);

    const m = runAsCommonJs(code);
    expect(m.url).toBe(pathToFileURL(FILE).href);
    expect(m.dir).toBe(join(sep, 'pkg', 'dist'));
    expect(m.pathSep).toBe(sep);
    expect(typeof (await m.load()).join).toBe('function');
  });

  it('КОНТРОЛЬ: без своих плагинов import.meta и import() остаются в выводе', () => {
    const bare = compile({
      ...transformer.babelOptions,
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    });
    expect(bare).toMatch(/import\.meta/);
    expect(bare).toMatch(/\bimport\('path'\)/);
  });

  it('@nestjs/common — только ESM и через трансформер грузится в jest', () => {
    const pkg = require.resolve('@nestjs/common/package.json');
    const { type } = JSON.parse(readFileSync(pkg, 'utf8')) as { type: string };
    expect(type).toBe('module');
    expect(typeof Injectable).toBe('function');
    expect(typeof transformer.process).toBe('function');
  });
});
