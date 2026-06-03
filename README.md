# tdl-proxy

東京ディズニーランド／シーの待ち時間を取得する [queue-times.com](https://queue-times.com/) API の
**CORSプロキシ**。Cloudflare Workers 上で動く小さな中継サーバーです。

「パークルーター」アプリ（最短全制覇ナビ）のライブデータ取得に使います。

```
ブラウザ(アプリ)  ──→  この Worker  ──→  queue-times.com
                   ↑ CORSを付けて返す
```

ブラウザから queue-times を直接叩くと CORS で弾かれるため、この中継が必要です。

---

## 何が返るか

| URL | 対象パーク |
|-----|-----------|
| `https://<your-worker>.workers.dev/` | 東京ディズニーランド (park 274) |
| `https://<your-worker>.workers.dev/?park=275` | 東京ディズニーシー (park 275) |

レスポンスは queue-times の JSON そのまま（`lands[].rides[]` に `id / name / is_open / wait_time / last_updated`）。

---

## デプロイ方法（どちらか好きな方）

### A. GitHub連携（おすすめ・push で自動デプロイ）

1. このフォルダを GitHub リポジトリに push する。
2. Cloudflareダッシュボード → **Workers & Pages → Create → Import a repository** でこのリポジトリを選択。
   - 初回は Cloudflare の Git 連携アプリのインストール／認可を求められるので許可。
3. 初回ビルド＆デプロイが走り、`tdl-proxy.<サブドメイン>.workers.dev` で公開される。
4. 以降は **main に push するだけで自動再デプロイ**。PRごとにプレビューURLも生成される。

### B. CLI（wrangler）

```bash
npm install -g wrangler   # 初回のみ
wrangler login
wrangler deploy           # このフォルダ直下で実行
```

ローカル確認は `wrangler dev`。

---

## アプリ側との接続

デプロイで発行された URL を、アプリの `live-data-adapter.js` の `PROXY_URL` に設定：

```js
const PROXY_URL = "https://tdl-proxy.<あなたのサブドメイン>.workers.dev";
```

### ride id のマッピング（初回だけ）

queue-times の `ride.id` と、アプリ内の座標データ（`ATTR` の `id`）を対応づけます。
名前は変わりうるので **id で紐付ける**のが安全。ブラウザのコンソールで一度これを流すと一覧が出ます：

```js
fetch(PROXY_URL).then(r => r.json()).then(d => {
  d.lands.flatMap(l => l.rides).forEach(r => console.log(r.id, r.name));
});
```

出力を見て、`live-data-adapter.js` の `QT_ID_TO_LOCAL` を埋めてください。

---

## 料金

すべて無料枠で収まります。

- **queue-times API** … 無料（下記の表示が条件）
- **Cloudflare Workers** … 無料プランで 1日10万リクエスト / CPU 10ms。超過しても課金ではなく一時停止（予期せぬ請求なし）
- **Workers Builds（GitHub自動デプロイ）** … 無料プランで 月3,000ビルド分

個人利用なら上限には到底届きません。

---

## ⚠️ 利用条件（必須）

queue-times.com の無料利用には、アプリ画面に以下の表示とリンクが必要です。
アプリのフッターに既に入っています。削除しないでください。

> Powered by [Queue-Times.com](https://queue-times.com/)

---

## ファイル構成

```
tdl-proxy/
├── src/
│   └── index.js      … Worker本体（中継処理）
├── wrangler.jsonc    … Cloudflare設定
└── README.md         … このファイル
```
