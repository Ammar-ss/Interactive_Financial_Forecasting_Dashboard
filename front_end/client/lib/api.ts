export async function apiFetch(path: string, opts?: RequestInit) {
  const candidates = [
    "",
    window.location.origin,
    `${window.location.protocol}//localhost:8080`,
    `${window.location.protocol}//127.0.0.1:8080`,
    `${window.location.protocol}//${window.location.hostname}:8080`,
  ];
  let lastErr: any = null;
  const attempts: string[] = [];

  // small helper to perform fetch with timeout and sensible defaults
  async function doFetch(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s
    try {
      const r = await fetch(url, {
        ...opts,
        mode: "cors",
        credentials: "same-origin",
        signal: controller.signal,
      } as RequestInit);
      clearTimeout(timeout);
      return r;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  for (const c of candidates) {
    const url = c ? `${c}${path}` : path;
    attempts.push(url);
    try {
      // console debug to aid in debugging remote failures
      // eslint-disable-next-line no-console
      console.debug("apiFetch trying", url);
      const r = await doFetch(url);
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        lastErr = new Error(
          `fetch ${url} failed: ${r.status} ${r.statusText} ${body}`.trim(),
        );
        continue;
      }
      const ct = r.headers.get("content-type") || "";
      if (ct.includes("application/json")) return r.json();
      // try to parse text fallback
      const txt = await r.text().catch(() => "");
      try {
        return JSON.parse(txt);
      } catch (e) {
        return txt;
      }
    } catch (err: any) {
      // Distinguish network errors and CORS/abort
      if (err && err.name === "AbortError") {
        lastErr = new Error(`fetch ${url} aborted (timeout)`);
      } else if (err && err.message) {
        lastErr = new Error(`fetch ${url} failed: ${err.message}`);
      } else {
        lastErr = new Error(`fetch ${url} failed`);
      }
      // eslint-disable-next-line no-console
      console.warn("apiFetch attempt failed", url, lastErr.message);
      continue;
    }
  }
  const errObj: any = {
    message: lastErr?.message ?? "apiFetch: all attempts failed",
    attempts,
    candidates,
  };
  try {
    // eslint-disable-next-line no-console
    console.error("apiFetch failed", errObj);
  } catch (e) {}
  throw errObj;
}
