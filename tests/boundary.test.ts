import { describe, expect, it } from 'vitest';

// @ts-expect-error The check is shared with the direct Node command.
import { checkBoundary, validateSpecifier } from '../scripts/check-boundary.mjs';

const filename = new URL('../src/example.ts', import.meta.url).pathname;

describe('independent project source boundary', () => {
  it('contains no external source imports, source symlinks, or linked dependencies', async () => {
    expect(await checkBoundary()).toBeGreaterThan(0);
  });

  it('rejects imports outside this independent project', () => {
    expect(() => validateSpecifier('../../web/src/App', filename)).toThrow();
    expect(() => validateSpecifier('../../netlify-decision-chain/model', filename)).toThrow();
    expect(() => validateSpecifier('../../sibling/model', filename)).toThrow();
    expect(() => validateSpecifier('/tmp/model', filename)).toThrow();
    expect(() => validateSpecifier('file:../../model', filename)).toThrow();
  });

  it('allows new local code and registry packages', () => {
    expect(() => validateSpecifier('./model', filename)).not.toThrow();
    expect(() => validateSpecifier('react', filename)).not.toThrow();
    expect(() => validateSpecifier('maplibre-gl', filename)).not.toThrow();
  });
});
