# ビルド修正版

今回のGitHub Actionsエラーの主因は「ファイルの置き場所」です。

正しい配置:
- src/cards/QuickAdd.tsx
- src/cards/api.ts
- src/components/Markdown.tsx
- src/images/storage.ts
- src/notebook.css
- sql/add-image-storage.sql

## 必ず削除するファイル

GitHub上に以下が存在する場合は削除してください。

- src/QuickAdd.tsx
- src/Markdown.tsx

これらは誤配置です。
tsconfig.json が src 全体をコンパイルするため、アプリからimportしていなくても存在するだけでbuild対象となり、今回のような import error を起こします。

## 適用方法

1. このZIPをリポジトリのルートで展開し、同名ファイルを上書きする。
2. `src/QuickAdd.tsx` と `src/Markdown.tsx` があれば削除する。
3. 写真機能を使う場合、Supabase SQL Editorで `sql/add-image-storage.sql` を1回実行する。
4. `pnpm build` を実行する。
5. 成功したらcommit/pushする。

## 今回含まれる機能

- 詳細追加の本文（問題側）に写真を追加
- 詳細追加の結論（解答側）にも写真を追加
- 非公開Supabase Storageから署名URLで画像表示
- 疑問 / 解決済みの選択
- `$...$`, `$$...$$`, `\\[...\\]`, `align` / `align*` のプレビュー補助
- TypeScriptのimplicit any対策

※ `$a_2$` のように数式モード内に書いた場合に添え字として表示されます。

## CSS

`src/notebook-image-additions.css` の内容を `src/notebook.css` の末尾へ追加してください。
