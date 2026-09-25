# 今回の修正

## 変更内容

1. 新規登録時の「疑問 / 解決済み」選択を削除
   - 新規カードは常に「疑問」として登録します。
   - 解決後にカード詳細画面から「解決済み」へ変更します。

2. 既存カード詳細でも写真を追加可能
   - 本文（問題側）に写真を追加できます。
   - 結論（解答側）にも写真を追加できます。
   - 写真追加後は「変更を保存」を押してください。

3. 新規詳細追加の写真添付は維持
   - 本文・結論の両方に写真を追加できます。

## 上書きするファイル

- src/cards/QuickAdd.tsx
- src/cards/CardDetail.tsx

## CSS

`src/notebook-image-additions.css` の内容を `src/notebook.css` の末尾に追加してください。
すでに同じ `.image-upload-*` / `.markdown-image` 定義がある場合は重複追加しなくて構いません。

## 重要

GitHub上に `src/storage.ts` がまだ残っている場合は削除してください。
正しい画像Storageファイルは `src/images/storage.ts` です。

写真機能を使うには、以前の `sql/add-image-storage.sql` をSupabase SQL Editorで一度実行している必要があります。
