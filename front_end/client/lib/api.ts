export async function apiFetch(path: string, opts?: RequestInit) {
  const candidates = [
    '',
    window.location.origin,
    `${window.location.protocol}//localhost:8080`,
    `${window.location.protocol}//127.0.0.1:8080`,
    `${window.location.protocol}//${window.location.hostname}:8080`,
  ];
  let lastErr: any = null;
  const attempts: string[] = [];
  for (const c of candidates) {
    const url = c ? `${c}${path}` : path;
    attempts.push(url);
    try {
      const r = await fetch(url, opts ?? undefined);
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        lastErr = new Error(`fetch ${url} failed: ${r.status} ${r.statusText} ${body}`.trim());
        continue;
      }
      return r.json();
    } catch (err: any) {
      lastErr = new Error(`fetch ${url} failed: ${err?.message || err}`);
      continue;
    }
  }
  const errObj: any = {
    message: lastErr?.message ?? 'apiFetch: all attempts failed',
    attempts,
    candidates,
  };
  try { console.error("apiFetch failed", errObj); } catch (e) {}
  throw errObj;
}
