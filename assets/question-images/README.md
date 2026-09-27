# 問題画像フォルダ

問題文や解説に後から追加する画像を置くフォルダです。

## 推奨ファイル名

`<question-id>-01.png` のように、問題IDを先頭に付けます。

例: `r04-general-01-01.png`

## 登録方法1: manifest.json（推奨）

同じフォルダの `manifest.json` に問題IDと画像を登録します。元の問題JSONを編集せずに画像だけ追加できます。

```json
{
  "version": "2026-09-27-1",
  "basePath": "./assets/question-images/",
  "questions": {
    "r04-general-01": {
      "question": [
        {"src": "r04-general-01-01.png", "caption": "問題図1", "alt": "問題図1の説明"}
      ],
      "explanation": [
        {"src": "r04-general-01-answer-01.png", "caption": "解説図1", "alt": "解説図1の説明"}
      ]
    }
  }
}
```

`question` と `explanation` はそれぞれ複数枚登録できます。文字列だけの簡易記法も使えます。

```json
"r04-general-01": {
  "question": ["r04-general-01-01.png", "r04-general-01-02.png"]
}
```

## 登録方法2: 問題JSONへ直接追加

問題オブジェクトに `images` / `explanationImages` を追加できます。こちらが指定されている場合は manifest より優先されます。

```json
"images": [
  {"src": "./assets/question-images/r04-general-01-01.png", "caption": "問題図1", "alt": "問題図1の説明"}
],
"explanationImages": [
  {"src": "./assets/question-images/r04-general-01-answer-01.png", "caption": "解説図1"}
]
```

1枚だけの場合は互換用の簡易項目 `image` / `imageCaption`、`explanationImage` / `explanationImageCaption` も使用できます。

## 表示仕様

- 画像なしの問題は従来どおり表示します。
- 問題画像は問題文の直後に表示します。
- 解説画像は回答表示後、解説の直後に表示します。
- 複数画像は縦に並びます。
- 画像タップまたは「大きく表示」で全画面表示します。
- 全画面では拡大・縮小・100%復帰ができます。
- 「画像だけ開く」からブラウザ標準の画像表示も利用できます。
- 画像読込に失敗しても問題演習自体は継続できます。

既存の機械安全図表は `assets/machine/figures/manifest.json` と `figure-viewer-v2.js` を引き続き使用します。段階的にこの共通仕様へ移行できます。
