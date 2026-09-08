import { describe, expect, it } from 'vitest';
import { PERMISSIONS, hasPermission } from './permissions';

describe('hasPermission', () => {
  it('grants a permission the token carries', () => {
    expect(
      hasPermission(
        { permissions: ['items:read', 'items:write'] },
        'items:write',
      ),
    ).toBe(true);
  });

  it('denies a permission the token does not carry', () => {
    expect(hasPermission({ permissions: ['items:read'] }, 'items:write')).toBe(
      false,
    );
  });

  it('denies everything for a token with no permissions', () => {
    expect(hasPermission({ permissions: [] }, PERMISSIONS.itemsRead)).toBe(
      false,
    );
  });
});
