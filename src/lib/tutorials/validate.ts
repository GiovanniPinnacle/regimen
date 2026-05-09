// URL validation for tutorial media URLs. Used at three points:
//
//   1. Write-time gate — /api/items/enrich validates a Coach-generated
//      URL before saving it. Dead links never hit the DB.
//   2. Backfill — /api/admin/validate-urls runs through every existing
//      media_url to nuke the ones that broke after save.
//   3. Daily cron — /api/cron/validate-urls re-checks the oldest 50
//      URLs each run so videos taken down post-save get demoted within
//      a day.
//
// Strategy:
//   - YouTube → oEmbed API. Returns 401 for unavailable/private/
//     deleted videos, 200 for live. More reliable than HEAD because
//     YouTube returns 200 from HEAD even for deleted videos.
//   - Vimeo → oEmbed.
//   - Everything else → HEAD request, treating 405 as soft pass.
//
// All checks have a 4s timeout so the pipeline never hangs on a slow
// host. Failures fail closed — a timeout = "dead, drop the URL."

const TIMEOUT_MS = 4000;

const YT_RX =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{8,})/;
const VIMEO_RX = /vimeo\.com\/(?:video\/)?(\d+)/;

function isYouTube(url: string): boolean {
  return YT_RX.test(url);
}

function isVimeo(url: string): boolean {
  return VIMEO_RX.test(url);
}

/** Hit YouTube's oEmbed API. Returns 200 for live videos, 401 for
 *  private / deleted / age-restricted, 404 for invalid ID. We treat
 *  anything other than 200 as dead. */
async function checkYouTube(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: ctrl.signal },
    );
    clearTimeout(t);
    return res.status === 200;
  } catch {
    return false;
  }
}

/** Same idea for Vimeo. */
async function checkVimeo(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`,
      { signal: ctrl.signal },
    );
    clearTimeout(t);
    return res.status === 200;
  } catch {
    return false;
  }
}

/** Generic HEAD-request fallback. Some hosts return 405 for HEAD
 *  even though the page exists — treat that as a soft pass. */
async function checkGeneric(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    return res.ok || res.status === 405;
  } catch {
    return false;
  }
}

/** Single entry point — pick the right checker for the URL. Returns
 *  true if the URL points to a live, embeddable video / page. */
export async function validateMediaUrl(url: string): Promise<boolean> {
  if (!url || typeof url !== "string") return false;
  // Reject non-http(s) right away
  if (!/^https?:\/\//i.test(url)) return false;
  if (isYouTube(url)) return checkYouTube(url);
  if (isVimeo(url)) return checkVimeo(url);
  return checkGeneric(url);
}

/** Validate many URLs in parallel, capped concurrency so we don't
 *  flood the network. Returns array of {url, live} matching input. */
export async function validateMediaUrls(
  urls: string[],
  concurrency = 6,
): Promise<{ url: string; live: boolean }[]> {
  const out: { url: string; live: boolean }[] = new Array(urls.length);
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const myIdx = i++;
      const url = urls[myIdx];
      out[myIdx] = { url, live: await validateMediaUrl(url) };
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()),
  );
  return out;
}
