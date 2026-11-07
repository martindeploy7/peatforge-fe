export type FieldMessage = { id: string; direction: string; body: string; created_at: string; status: string };
export type FieldResponse = {
  items: FieldMessage[];
  responder?: { name: string; village_id: string };
  state?: string;
  mode?: 'live' | 'replay';
  day?: number;
  browser_voice_supported?: boolean;
};

export class FieldError extends Error {
  constructor(public readonly status: number) { super('Layanan percakapan belum tersedia.'); }
}
export const fieldDenied = (error: unknown) => error instanceof FieldError && [401, 403, 404].includes(error.status);

export async function fieldRequest(token: string, path: 'messages' | 'send', signal: AbortSignal, text?: string): Promise<FieldResponse> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new FieldError(404);
  if (path === 'send' && (!text?.trim() || text.length > 500)) throw new FieldError(422);
  const response = await fetch(`/api/field/${encodeURIComponent(token)}/${path}`, {
    method: path === 'send' ? 'POST' : 'GET',
    credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    ...(path === 'send' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, anonymous: false }) } : {}),
  });
  if (!response.ok) throw new FieldError(response.status);
  return response.json() as Promise<FieldResponse>;
}
