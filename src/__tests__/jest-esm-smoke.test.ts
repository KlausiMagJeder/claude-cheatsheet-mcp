// Smoke-Test: verifies Jest + ts-jest + ESM + Node16 toolchain is wired correctly.
// A real ESM import from a Node builtin ensures ESM resolution is not silently
// falling back to CJS.
import { sep } from 'node:path';

describe('jest-esm-smoke', () => {
  it('runs a trivial assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('can import from a node: ESM builtin', () => {
    expect(typeof sep).toBe('string');
    expect(sep.length).toBeGreaterThan(0);
    // Platform-robust: macOS/Linux "/" oder Windows "\".
    expect(sep).toMatch(/[/\\]/);
  });
});
