# 労働安全コンサル道場

個人用の労働安全コンサルタント試験対策PWAです。

- 産業安全一般
- 産業安全関係法令
- 機械安全
- 過去問・予想問題
- 解説・学習ポイント・根拠法令
- 科目別進捗
- 苦手問題の自動ストック
- 学習履歴の端末内保存とバックアップ/復元
- 問題画像・解説画像の後付け表示
- AI学習コーチ（Agents API 接続）

GitHub Pages で公開する構成です。

## AI学習コーチ

ホーム画面に「AI学習コーチ」を追加しています。正答率、苦手問題、直近の解答履歴などを要約し、Cloudflare Worker 経由で OpenAI Agents API に送信して、今日の学習メニューを提案します。

OpenAI APIキーはGitHub Pagesやブラウザへ保存しません。`worker-ai/` のCloudflare WorkerにSecretとして設定します。

1. `worker-ai/README.md` に従ってWorkerをデプロイ
2. PWAの「設定 → AI学習コーチ」に `/coach` のURLを登録
3. ホームの「今日のおすすめを作る」を押す

AI機能が未設定・オフラインでも、従来の問題演習機能はそのまま利用できます。

## 問題画像の追加

問題画像は `assets/question-images/` に保存し、`assets/question-images/manifest.json` に問題IDとファイル名を登録する方法を推奨します。これなら既存の問題JSONを変更せずに画像を追加できます。

問題JSONへ直接 `images` / `explanationImages` を追加する方法にも対応しています。1問に複数枚登録でき、問題画像は問題文直後、解説画像は回答後の解説直後に表示されます。画像はタップで全画面表示でき、拡大・縮小にも対応します。

詳しい記述例は `assets/question-images/README.md` を参照してください。

既存の機械安全図表は従来の `assets/machine/figures/manifest.json` と `figure-viewer-v2.js` を維持しているため、現在の表示を壊さず段階的に共通画像仕様へ移行できます。

## Production
GitHub Pages への本番デプロイは GitHub Actions から実行します。
