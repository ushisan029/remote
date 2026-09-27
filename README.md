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
- AI学習コーチ（ローカル判定 / ブラウザ内WebLLM / OpenAI Agents API）

GitHub Pages で公開する構成です。

## AI学習コーチ

ホーム画面に「AI学習コーチ」を追加しています。

- **無料のローカルおすすめ**: API不要。正答率・苦手問題・未回答数から端末内だけで決定ルールにより今日の学習メニューを作成します。
- **端末内AI（無料）**: WebLLM + WebGPU を使い、ブラウザ内のローカルLLMで学習統計を分析します。APIキー不要・API利用料0円です。
- **AIで詳しく分析**: Cloudflare Worker 経由で OpenAI Agents API の `gpt-6-luna` に学習統計を送り、学習メニューと理由を提案します。

### 端末内AI（WebLLM）

WebLLMは `https://esm.run/@mlc-ai/web-llm@0.2.85` から必要時だけ読み込みます。ページ表示だけではモデルをダウンロードしません。

設定画面の「端末内AI（WebLLM）」で次を選べます。

- `Llama-3.2-1B-Instruct-q4f16_1-MLC` — 軽量・既定、必要VRAM目安 約879MB
- `Llama-3.2-3B-Instruct-q4f16_1-MLC` — より大きいモデル、必要VRAM目安 約2.3GB

初回実行時はWebLLM本体・モデル・WebGPU用ライブラリの取得にインターネット接続と端末ストレージが必要です。取得後の学習統計の推論はブラウザ内で行われます。端末・ブラウザがWebGPU非対応、またはメモリ不足の場合は、通常の無料ローカルおすすめへフォールバックできます。

### OpenAI版

OpenAI APIキーはGitHub Pagesやブラウザへ保存しません。`worker-ai/` のCloudflare WorkerにSecretとして設定します。

1. `worker-ai/README.md` に従ってWorkerをdry-runまたはデプロイ
2. PWAの「設定 → AI学習コーチ」にWorker URLを登録
3. 「接続確認」でWorkerの状態を確認
4. OpenAI APIキー登録後、「AIで詳しく分析」を利用

APIキー未設定・オフラインでも、従来の問題演習と無料のローカルおすすめは利用できます。WebLLMのモデルが端末側で利用可能な状態なら、端末内AIもAPIキーなしで利用できます。

## 問題画像の追加

問題画像は `assets/question-images/` に保存し、`assets/question-images/manifest.json` に問題IDとファイル名を登録する方法を推奨します。これなら既存の問題JSONを変更せずに画像を追加できます。

問題JSONへ直接 `images` / `explanationImages` を追加する方法にも対応しています。1問に複数枚登録でき、問題画像は問題文直後、解説画像は回答後の解説直後に表示されます。画像はタップで全画面表示でき、拡大・縮小にも対応します。

詳しい記述例は `assets/question-images/README.md` を参照してください。

既存の機械安全図表は従来の `assets/machine/figures/manifest.json` と `figure-viewer-v2.js` を維持しているため、現在の表示を壊さず段階的に共通画像仕様へ移行できます。

## Production

GitHub Pages への本番デプロイに加え、AI Workerは `.github/workflows/ai-worker.yml` でdry-run検証と手動デプロイに対応しています。
