export type PasswordBreachStatus = 'safe' | 'compromised' | 'unavailable';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const HIBP_RANGE_ENDPOINT = 'https://api.pwnedpasswords.com/range/';

async function sha1UpperHex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Checks a password with HIBP's k-anonymity range API.
 * Only the first five hash characters leave the browser. Network/API failure is fail-open
 * because the check is defense-in-depth and must not lock users out during an outage.
 */
export async function checkPasswordAgainstBreaches(
  password: string,
  fetchImpl: FetchLike = fetch,
): Promise<PasswordBreachStatus> {
  try {
    const hash = await sha1UpperHex(password);
    const response = await fetchImpl(`${HIBP_RANGE_ENDPOINT}${hash.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true' },
      cache: 'no-store',
    });
    if (!response.ok) return 'unavailable';

    const suffix = hash.slice(5);
    const ranges = (await response.text()).split(/\r?\n/);
    return ranges.some((line) => line.split(':', 1)[0]?.trim().toUpperCase() === suffix) ? 'compromised' : 'safe';
  } catch {
    return 'unavailable';
  }
}
