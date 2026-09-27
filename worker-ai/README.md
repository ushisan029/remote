# AI学習コーチ Worker

GitHub Pages 上のPWAから OpenAI Agents API を安全に呼び出すための Cloudflare Worker です。OpenAI APIキーはブラウザやGitHub Pagesには置かず、WorkerのSecretとして保存します。

## 現在の構成

- PWAから学習統計の要約を受信
- OpenAI Agents API で学習コーチを起動
- `environment: none` でコード実行環境を作らず分析だけを実行
- 既定モデルは低コストの `gpt-6-luna`
- `reasoning.effort: low`、`text.verbosity: low`、`service_tier: default` で日常利用のコストを抑制
- 今日の優先分野と10問前後の学習メニューをJSONで返却
- 完了ターンを確認してから結果を返却
- 可能な場合は入力・出力・推論トークン数をレスポンスへ付与
- `GET /health` でWorker到達・モデル・OpenAI APIキー設定有無を確認
- GitHubトークンやOpenAI APIキーはPWAから送信しない

PWA側にはAPIを使わない「無料のローカルおすすめ」もあり、OpenAI API未設定でも利用できます。

## 使用モデルとコスト設定

```toml
OPENAI_MODEL = "gpt-6-luna"
```

WorkerはAgents APIへ次の設定を送ります。

```json
{
  "reasoning": { "effort": "low" },
  "text": { "verbosity": "low" },
  "service_tier": "default"
}
```

将来、より複雑な分析だけ高性能モデルへ切り替えたい場合は `wrangler.toml` の `OPENAI_MODEL` を変更できます。PWA側のコード変更は不要です。

## 初回セットアップ

Node.js と npm が使える環境で `worker-ai` ディレクトリを開きます。

```bash
npm install
npm test
npm run deploy:dry-run
```

`npm test` はSSE解析、入力検証、AI出力の正規化、使用トークン変換を確認します。`deploy:dry-run` はCloudflareへ公開せず、WranglerがWorkerを正しくビルドできるか確認します。

## Cloudflareへのデプロイ

ローカルからデプロイする場合:

```bash
npx wrangler login
npm run deploy
```

デプロイ後は次でWorkerだけの疎通確認ができます。OpenAI APIキーがまだなくても `/health` は動作します。

```text
https://rouan-ai-coach.<account>.workers.dev/health
```

返却例:

```json
{
  "ok": true,
  "service": "rouan-ai-coach",
  "version": "2026-09-27.3",
  "model": "gpt-6-luna",
  "reasoningEffort": "low",
  "textVerbosity": "low",
  "serviceTier": "default",
  "openaiConfigured": false
}
```

PWAの「設定 → AI学習コーチ」にはWorkerのルートURLまたは `/coach` URLを登録できます。「接続確認」を押すと `/health` を確認します。

## GitHub Actions

`.github/workflows/ai-worker.yml` を追加しています。

- Pull Request時: `npm test` とWorkerのdry-run検証
- 手動実行時: 同じ検証後にCloudflareへデプロイ

GitHub Actionsからデプロイする場合は、リポジトリのActions secretsに次の2つを登録します。

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Cloudflare API tokenはWorkers編集権限だけに絞ることを推奨します。OpenAI APIキーはこのGitHub Actionsには渡しません。Workerへ一度Secretとして登録した値は通常の再デプロイで保持されます。

## OpenAI APIキー

OpenAI Platform のプロジェクトでアプリケーションAPIキーを作成し、Agents APIのセッション操作とモデル推論に必要な権限を付与します。

Workerへ登録するときだけ、次を実行します。

```bash
npx wrangler secret put OPENAI_API_KEY
```

その後、もう一度 `/health` を開き、`openaiConfigured` が `true` になれば準備完了です。

Secret値を `wrangler.toml`、GitHub、PWAのlocalStorageへ直接書かないでください。

## 許可Origin

初期値は次です。

```toml
ALLOWED_ORIGIN = "https://ushisan029.github.io"
```

別ドメインで公開する場合は変更してください。複数Originを許可する場合はカンマ区切りで指定できます。

## ローカル開発

`worker-ai/.dev.vars` を作成すると、ローカルだけでOpenAI接続を試せます。このファイルはGitへ追加されません。

```text
OPENAI_API_KEY=sk-...
```

```bash
npm run dev
```

## API

### GET /health

OpenAIを呼び出さず、Workerの状態を返します。

### POST /coach

入力例:

```json
{
  "action": "today_plan",
  "summary": {
    "overall": {},
    "subjects": [],
    "weakQuestions": [],
    "hardQuestions": [],
    "recent": []
  }
}
```

返却例:

```json
{
  "ok": true,
  "sessionId": "sess_...",
  "turnId": "turn_...",
  "model": "gpt-6-luna",
  "usage": {
    "inputTokens": 1000,
    "cachedInputTokens": 0,
    "outputTokens": 200,
    "reasoningTokens": 50,
    "totalTokens": 1200
  },
  "result": {
    "summary": "...",
    "priorities": [],
    "plan": [],
    "message": "..."
  }
}
```

`usage` はOpenAI側で記録できた場合のみ値が入ります。記録値はbest-effortで、最終請求額そのものではありません。

Worker側で科目・学習モード・件数を再検証し、想定外のAI出力をそのままPWAへ渡さないようにしています。

## セキュリティ上の注意

`ALLOWED_ORIGIN` はブラウザからの不用意な利用を減らしますが、単独では完全な認証ではありません。公開運用で利用量が増える場合は、Cloudflare側のRate Limitingや追加認証を設定してください。
