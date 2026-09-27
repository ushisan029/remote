# AI学習コーチ Worker

GitHub Pages 上のPWAから OpenAI Agents API を安全に呼び出すための Cloudflare Worker です。OpenAI APIキーはブラウザやGitHub Pagesには置かず、WorkerのSecretとして保存します。

## 役割

- PWAから学習統計の要約を受信
- OpenAI Agents API で学習コーチを起動
- `environment: none` でコード実行環境を作らず分析だけを実行
- 今日の優先分野と10問前後の学習メニューをJSONで返却
- GitHubトークンやOpenAI APIキーはPWAから送信しない

## 使用モデル

既定モデルは、低コスト運用向けの `gpt-6-luna` です。

```toml
OPENAI_MODEL = "gpt-6-luna"
```

将来、より複雑な分析だけ高性能モデルへ切り替えたい場合は `wrangler.toml` の `OPENAI_MODEL` を変更できます。アプリ側のコード変更は不要です。

## OpenAI APIキー

OpenAI Platform のプロジェクトでアプリケーションAPIキーを作成し、Agents APIのセッション操作に必要な `api.agents.read` と `api.agents.write`、モデル推論に必要な `api.responses.write` を許可してください。

## デプロイ

`worker-ai` ディレクトリで実行します。

```bash
npx wrangler login
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

`wrangler.toml` では `OPENAI_API_KEY` を必須Secretとして宣言しています。Secret値を `vars` やリポジトリへ直接書かないでください。

デプロイ後に表示されるURLの末尾へ `/coach` を付け、PWAの「設定 → AI学習コーチ」に登録します。

例:

```text
https://rouan-ai-coach.<account>.workers.dev/coach
```

## 許可Origin

初期値は次です。

```toml
ALLOWED_ORIGIN = "https://ushisan029.github.io"
```

別ドメインで公開する場合は変更してください。複数Originを許可する場合はカンマ区切りで指定できます。

## ローカル開発

`worker-ai/.dev.vars` を作成します。このファイルはGitへ追加しません。

```text
OPENAI_API_KEY=sk-...
```

その後、次を実行します。

```bash
npx wrangler dev
```

## API

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
  "result": {
    "summary": "...",
    "priorities": [],
    "plan": [],
    "message": "..."
  }
}
```

## セキュリティ上の注意

`ALLOWED_ORIGIN` はブラウザからの不用意な利用を減らしますが、単独では完全な認証ではありません。公開運用で利用量が増える場合は、Cloudflare側のRate Limitingや追加認証を設定してください。
