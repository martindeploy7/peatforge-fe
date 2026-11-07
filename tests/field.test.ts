import { afterEach, describe, expect, it, vi } from 'vitest';
import { FieldError, fieldDenied, fieldRequest } from '../src/voice/fieldApi';

const token = 'f'.repeat(43);
afterEach(() => vi.unstubAllGlobals());

describe('scoped field requests', () => {
  it('uses only the field endpoint, omits cookies and suppresses referrers', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], responder: { name: 'Petugas lapangan', village_id: 'v1' } })));
    vi.stubGlobal('fetch', fetcher);
    const result = await fieldRequest(token, 'messages', new AbortController().signal);
    expect(result.responder?.name).toBe('Petugas lapangan');
    expect(fetcher).toHaveBeenCalledWith(`/api/field/${token}/messages`, expect.objectContaining({ method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', cache: 'no-store' }));
  });

  it.each([401, 403, 404])('preserves access denial %s without retry or simulation', async status => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status }));
    vi.stubGlobal('fetch', fetcher);
    const error = await fieldRequest(token, 'messages', new AbortController().signal).catch(value => value);
    expect(error).toBeInstanceOf(FieldError);
    expect(error.status).toBe(status);
    expect(fieldDenied(error)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(error.message).not.toContain(token);
  });

  it('submits only text and anonymous false; server chooses responder identity', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{"items":[],"state":"confirm"}'));
    vi.stubGlobal('fetch', fetcher);
    await fieldRequest(token, 'send', new AbortController().signal, 'AIR 61 ASAP YA');
    expect(fetcher).toHaveBeenCalledWith(`/api/field/${token}/send`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ text: 'AIR 61 ASAP YA', anonymous: false }) }));
  });

  it('rejects invalid capabilities and blank or oversized reports before requesting', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    const signal = new AbortController().signal;
    await expect(fieldRequest('invalid', 'messages', signal)).rejects.toMatchObject({ status: 404 });
    await expect(fieldRequest(token, 'send', signal, ' ')).rejects.toMatchObject({ status: 422 });
    await expect(fieldRequest(token, 'send', signal, 'x'.repeat(501))).rejects.toMatchObject({ status: 422 });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
