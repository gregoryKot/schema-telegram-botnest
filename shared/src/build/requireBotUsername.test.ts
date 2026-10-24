import { describe, it, expect } from 'vitest';
import {
  assertBotUsernameForBuild,
  requireBotUsernamePlugin,
  BOT_USERNAME_MISSING_MESSAGE,
} from './requireBotUsername';

const build = (env: Record<string, string | undefined>) => ({
  command: 'build',
  mode: 'production',
  env,
});

describe('assertBotUsernameForBuild', () => {
  it('production-сборка без VITE_BOT_USERNAME падает с понятным текстом', () => {
    expect(() => assertBotUsernameForBuild(build({}))).toThrow(
      BOT_USERNAME_MISSING_MESSAGE,
    );
  });

  it('пробельная строка — тоже «не задан»', () => {
    expect(() =>
      assertBotUsernameForBuild(build({ VITE_BOT_USERNAME: '   ' })),
    ).toThrow(/VITE_BOT_USERNAME/);
  });

  it('контрольный: имя задано — сборка проходит', () => {
    expect(() =>
      assertBotUsernameForBuild(
        build({ VITE_BOT_USERNAME: 'SchemeHappensBot' }),
      ),
    ).not.toThrow();
  });

  it('dev-сервер и vitest (mode test) не затронуты', () => {
    expect(() =>
      assertBotUsernameForBuild({
        command: 'serve',
        mode: 'development',
        env: {},
      }),
    ).not.toThrow();
    expect(() =>
      assertBotUsernameForBuild({ command: 'serve', mode: 'test', env: {} }),
    ).not.toThrow();
  });

  it('не-production сборка (vite build --mode staging) не затронута', () => {
    expect(() =>
      assertBotUsernameForBuild({ command: 'build', mode: 'staging', env: {} }),
    ).not.toThrow();
  });

  it('плагин вешает guard на configResolved', () => {
    const plugin = requireBotUsernamePlugin();
    expect(plugin.name).toBe('require-bot-username');
    expect(() => plugin.configResolved(build({}))).toThrow();
  });
});
