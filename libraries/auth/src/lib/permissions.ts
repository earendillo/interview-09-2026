/**
 * Authorization, kept separate from authentication on purpose: a valid token
 * answers "who is this?", a permission answers "may they do this?". The two
 * produce different HTTP statuses (401 vs 403).
 */
export const PERMISSIONS = {
  itemsRead: 'items:read',
  itemsWrite: 'items:write',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export function hasPermission(
  bearer: { permissions: string[] },
  required: string,
): boolean {
  return bearer.permissions.includes(required);
}
