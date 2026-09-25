今回の変更

- 「詳細を設定して疑問を追加」の本文・結論に、既存カード詳細と同じMarkdown/LaTeX即時プレビューを追加。
- $...$ と $$...$$ の数式を保存前に確認可能。
- 既存のクイック追加、検索分離、詳細追加の仕様はそのまま。

置き換えるファイル
- src/NotebookApp.tsx
- src/cards/QuickAdd.tsx
- src/cards/api.ts
- src/notebook.css

DB/SQL変更は不要です。
