export function formatDebugInfo(data: Record<string, unknown>): string {
  return JSON.stringify(data, null, 2);
}
