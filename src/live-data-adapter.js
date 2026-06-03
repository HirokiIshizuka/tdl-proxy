// ============================================================
//  本番用データレイヤー — queue-times.com ライブ待ち時間
//  プロトタイプの simulateWaits() をこれで置き換える
// ============================================================
//
//  ■ なぜプロキシが要るのか
//  queue-times.com は CORS ヘッダを返さないため、ブラウザから
//  直接 fetch するとブロックされる。サーバーレス関数を1個だけ
//  挟んで中継すればよい（無料枠で十分）。
//
//  park id : 東京ディズニーランド=274 / 東京ディズニーシー=275
//  更新頻度: 約5分。利用条件として "Powered by Queue-Times.com" の
//           表示＋ https://queue-times.com/ へのリンクが必須。
//
// ============================================================


// ------------------------------------------------------------
// (A) Cloudflare Worker  ※ proxy.example.workers.dev などにデプロイ
// ------------------------------------------------------------
export default {
  async fetch(req) {
    const PARK = 274; // TDL
    const upstream = `https://queue-times.com/parks/${PARK}/queue_times.json`;
    const r = await fetch(upstream, { cf: { cacheTtl: 60 } });
    const body = await r.text();
    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",   // 自分のアプリだけに絞ってもよい
        "cache-control": "public, max-age=60",
      },
    });
  },
};
// Vercel/Netlify Functions でも同じ発想で書ける（fetchして転送するだけ）。


// ------------------------------------------------------------
// (B) クライアント側：ライブ待ち時間を取り込む
// ------------------------------------------------------------
const PROXY_URL = "https://tdl-proxy.isihiro-mno.workers.dev";

// queue-times の ride.id と、自前の座標データを対応づけるテーブル。
// 名前は変わりうるので「id」で紐付けるのが安全。
// 初回だけ /parks/274/queue_times.json を見て id を埋める。
const QT_ID_TO_LOCAL = {
  // 例： queue-times の ride.id : 自前ATTRのid
  // 7985: "omnibus",
  // 1234: "pooh",
  // ...   （実データを見て埋める）
};

async function fetchLiveWaits() {
  const res = await fetch(PROXY_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("待ち時間の取得に失敗: " + res.status);
  const data = await res.json();

  // data.lands[].rides[] = { id, name, is_open, wait_time, last_updated }
  const flat = data.lands.flatMap(l => l.rides);

  flat.forEach(r => {
    const localId = QT_ID_TO_LOCAL[r.id];
    const a = state.find(x => x.id === localId);
    if (!a) return;               // マッピング未登録は無視
    a.open = r.is_open;
    a.wait = r.wait_time ?? 0;
  });
}

// プロトタイプの refresh() をこう差し替える：
//
//   async function refresh() {
//     try { await fetchLiveWaits(); }
//     catch (e) { console.warn(e); /* 失敗時は前回値を維持 */ }
//     render();
//   }
//
// さらに setInterval(refresh, 5*60*1000) で自動更新ループにできる。


// ------------------------------------------------------------
// (C) 初回マッピングの作り方（コンソールで1回流すだけ）
// ------------------------------------------------------------
//   fetch(PROXY_URL).then(r=>r.json()).then(d=>{
//     d.lands.flatMap(l=>l.rides).forEach(r=>console.log(r.id, r.name));
//   });
//   → 出力を見て QT_ID_TO_LOCAL を埋める
