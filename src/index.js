/**
 * tdl-proxy — queue-times.com 待ち時間APIのCORSプロキシ
 * ------------------------------------------------------------
 * ブラウザから queue-times.com を直接叩くと CORS で弾かれるため、
 * この Worker を中継させる。やることは「取得して、CORSヘッダを
 * 付けて、そのまま返す」だけ。
 *
 *   park id : 東京ディズニーランド = 274 / 東京ディズニーシー = 275
 *   使い方  : https://<your-worker>.workers.dev/          → TDL(274)
 *             https://<your-worker>.workers.dev/?park=275 → TDS
 *
 * 利用条件: アプリ側に "Powered by Queue-Times.com" の表示＋
 *           https://queue-times.com/ へのリンクを必ず入れること。
 * ------------------------------------------------------------
 */

const ALLOWED_PARKS = new Set([274, 275]); // 増やすならここに追加
const DEFAULT_PARK = 274;
const CACHE_SECONDS = 60; // queue-timesは約5分更新。叩きすぎ防止に短時間キャッシュ

// 本番で自分のアプリだけに絞るならここを "https://your-app.example.com" に。
// 個人利用・検証中は "*" で問題ない。
const ALLOW_ORIGIN = "*";

const corsHeaders = {
  "access-control-allow-origin": ALLOW_ORIGIN,
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "Content-Type",
};

export default {
  async fetch(request) {
    // プリフライト対応
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== "GET") {
      return json({ error: "Method Not Allowed" }, 405);
    }

    // park の決定（?park=275 で切替、未指定はTDL）
    const url = new URL(request.url);
    const parkParam = Number(url.searchParams.get("park")) || DEFAULT_PARK;
    const park = ALLOWED_PARKS.has(parkParam) ? parkParam : DEFAULT_PARK;

    const upstream = `https://queue-times.com/parks/${park}/queue_times.json`;

    try {
      const res = await fetch(upstream, {
        headers: { "user-agent": "tdl-proxy (personal use)" },
        cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
      });

      if (!res.ok) {
        return json({ error: "upstream error", status: res.status }, 502);
      }

      const body = await res.text();
      return new Response(body, {
        headers: {
          ...corsHeaders,
          "content-type": "application/json; charset=utf-8",
          "cache-control": `public, max-age=${CACHE_SECONDS}`,
        },
      });
    } catch (err) {
      return json({ error: "fetch failed", detail: String(err) }, 500);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" },
  });
}
