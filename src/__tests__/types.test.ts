import { isEntryKind, isScope, createEntryId } from '../types.js';

describe('isEntryKind', () => {
  it('returns true for valid kinds', () => {
    expect(isEntryKind('skill')).toBe(true);
    expect(isEntryKind('command')).toBe(true);
    expect(isEntryKind('agent')).toBe(true);
    expect(isEntryKind('mcp_tool')).toBe(true);
    expect(isEntryKind('cli_command')).toBe(true);
    expect(isEntryKind('hook')).toBe(true);
    expect(isEntryKind('role')).toBe(true);
  });

  it('returns false for invalid kinds', () => {
    expect(isEntryKind('foo')).toBe(false);
    expect(isEntryKind('')).toBe(false);
  });
});

describe('isScope', () => {
  it('returns true for valid scopes', () => {
    expect(isScope('global')).toBe(true);
    expect(isScope('project')).toBe(true);
  });

  it('returns false for invalid scopes', () => {
    expect(isScope('local')).toBe(false);
  });
});

describe('createEntryId', () => {
  it('creates id from kind and name', () => {
    expect(createEntryId('skill', 'superpowers:brainstorming')).toBe(
      'skill:superpowers:brainstorming',
    );
  });

  it('creates id for cli_command', () => {
    expect(createEntryId('cli_command', '/help')).toBe('cli_command:/help');
  });
});
