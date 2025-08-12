let cached: string | undefined;
let inflight: Promise<string | undefined> | undefined;

export const getCsrfToken = async (): Promise<string | undefined> => {
  if (cached) return cached;
  if (inflight) return inflight;

  const base = (import.meta as any).env?.VITE_API_URL || '';
  inflight = fetch(`${base}/csrf-token`, {
    method: 'GET',
    credentials: 'include',
  })
    .then(async (r) => {
      if (!r.ok) return undefined;
      const data = await r.json().catch(() => ({}) as any);
      cached = (data as any)?.token;
      return cached;
    })
    .catch(() => undefined)
    .finally(() => {
      inflight = undefined;
    });

  return inflight;
};

export const clearCsrfTokenCache = () => {
  cached = undefined;
};
