今回の変更
============

1. 詳細追加フォームに「状態」を復元
   - 疑問 / 解決済み を新規作成時に選択できます。
   - 解決済みで保存すると resolved_at も保存します。

2. LaTeX / KaTeX の入力を改善
   - $a_2$ のようなインライン数式
   - $$ ... $$ の別行数式
   - \[ ... \] の別行数式
   - \begin{align} ... \end{align}
   - \begin{align*} ... \end{align*}
   をプレビューできます。

   注意: a_2 を添え字として表示する場合は $a_2$ のように数式モードで入力してください。
   数式モードなら KaTeX の通常の小さい添え字になります。

3. 写真添付
   - 「詳細を設定して疑問を追加」の本文・結論に「写真を追加」を追加。
   - JPEG / PNG / WebP / GIF、1枚10MBまで。
   - 画像本体は非公開 Supabase Storage に保存し、本文には参照だけを保存します。
   - 保存後のカード詳細でも画像は表示されます。

重要: 写真機能を使う前に
------------------------
Supabase Dashboard -> SQL Editor で
  sql/add-image-storage.sql
を1回だけ実行してください。

その後、ZIP内の src 以下を同じパスへ上書きしてください。

この版で画像アップロードUIがあるのは「詳細を設定して新規追加」です。
既に保存済みのカード詳細画面では添付画像の表示はできますが、後から新しい画像を追加するボタンはまだ追加していません。

置き換えるファイル
------------------
src/NotebookApp.tsx
src/cards/QuickAdd.tsx
src/cards/api.ts
src/components/Markdown.tsx
src/images/storage.ts
src/notebook.css

追加SQL
-------
sql/add-image-storage.sql
