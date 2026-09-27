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

GitHub Pages で公開する構成です。

## 問題画像の追加

問題画像は `assets/question-images/` に保存し、`assets/question-images/manifest.json` に問題IDとファイル名を登録する方法を推奨します。これなら既存の問題JSONを変更せずに画像を追加できます。

問題JSONへ直接 `images` / `explanationImages` を追加する方法にも対応しています。1問に複数枚登録でき、問題画像は問題文直後、解説画像は回答後の解説直後に表示されます。画像はタップで全画面表示でき、拡大・縮小にも対応します。

詳しい記述例は `assets/question-images/README.md` を参照してください。

既存の機械安全図表は従来の `assets/machine/figures/manifest.json` と `figure-viewer-v2.js` を維持しているため、現在の表示を壊さず段階的に共通画像仕様へ移行できます。

## Production
GitHub Pages への本番デプロイは GitHub Actions から実行します。
