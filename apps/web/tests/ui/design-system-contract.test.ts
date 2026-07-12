import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');

describe('design system CSS contract', () => {
  it('keeps Tailwind theme ownership in one stylesheet', () => {
    const files = ['app/globals.css', 'app/styles/tailwind-theme.css', 'app/styles/component-utilities.css'];
    const themeOwners = files.filter((file) => fs.readFileSync(path.join(root, file), 'utf8').includes('@theme'));
    expect(themeOwners).toEqual(['app/styles/tailwind-theme.css']);
  });

  it('keeps global CSS as an explicit three-layer entrypoint', () => {
    const globals = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');
    expect(globals.match(/^@import /gm)).toHaveLength(3);
    expect(globals).toContain("@import './styles/tailwind-theme.css';");
    expect(globals).toContain("@import './styles/component-utilities.css';");
  });

  it('does not duplicate utility selector declarations', () => {
    const utilities = fs.readFileSync(path.join(root, 'app/styles/component-utilities.css'), 'utf8');
    const names = [...utilities.matchAll(/@utility\s+([^\s{]+)/g)].map((match) => match[1]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps the source CSS layers within the documented size budget', () => {
    const budgets: Record<string, number> = {
      'app/globals.css': 6_000,
      'app/styles/tailwind-theme.css': 6_000,
      'app/styles/component-utilities.css': 12_000,
    };
    for (const [file, budget] of Object.entries(budgets)) {
      expect(fs.statSync(path.join(root, file)).size, `${file} exceeded ${budget} bytes`).toBeLessThanOrEqual(budget);
    }
  });
});
