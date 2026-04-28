export function normalizeRedisUrl(rawUrl: string, rawPassword: string): string {
  const url = rawUrl.trim();
  const password = rawPassword.trim();
  if (!url || !password) return url;
  try {
    const parsed = new URL(url);
    if ((parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') || parsed.username || parsed.password) {
      return url;
    }
    parsed.password = password;
    return parsed.toString();
  } catch {
    return url;
  }
}
