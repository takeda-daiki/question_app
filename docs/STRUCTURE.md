# フォルダー・ファイル構成

2026年9月25日時点のローカル作業ファイルを確認した案内です。

## 作業する場所

このプロジェクトの作業用リポジトリは `question_app` です。GitHub Desktopではこのフォルダーを開きます。

```text
ChatGPTプロジェクトのフォルダー/
├─ AGENTS.md       この作業場所のルール
├─ sources/        共有資料の参照用（読み取り専用・確認時点では空）
├─ .pnpm-store/    開発ツールのキャッシュ
└─ question_app/   アプリの作業用リポジトリ（以下の構成）
```

`sources` と `question_app` は別の場所です。GitHub上のファイルや公開ページもローカルとは別で、編集だけでは反映されません。

## アプリの構成

```text
question_app/
├─ src/                         アプリのプログラム
│  ├─ main.tsx                  起動処理
│  ├─ App.tsx                   ログイン状態・ログアウト・画面の入口
│  ├─ NotebookApp.tsx           一覧・絞り込み・画面切替・ゴミ箱の操作
│  ├─ styles.css                全体の基本デザイン
│  ├─ notebook.css              一覧・詳細などのデザイン
│  ├─ auth/
│  │  └─ AuthForm.tsx           ログイン・登録フォーム
│  ├─ cards/
│  │  ├─ QuickAdd.tsx           「＋疑問を追加」の画面
│  │  ├─ CardDetail.tsx         既存の疑問の詳細・編集画面
│  │  ├─ ClassificationFields.tsx  追加・詳細画面の領域と分野の入力
│  │  ├─ filter.ts              検索・絞り込み・並べ替え
│  │  └─ api.ts                 疑問カードの新規保存
│  ├─ components/
│  │  ├─ FilterCreate.tsx       一覧の選択欄から分類を作成・選択
│  │  ├─ InlineCreate.tsx       名前入力と新規作成ボタンの共通部品
│  │  └─ Markdown.tsx           Markdown・数式の表示
│  ├─ data/
│  │  ├─ types.ts               カード・領域・分野・タグなどのデータ定義
│  │  └─ repository.ts          データ取得・更新・分類・タグ・関連の保存
│  ├─ lib/
│  │  └─ supabase.ts            Supabaseとの接続準備
│  ├─ settings/
│  │  └─ Settings.tsx           分類の管理・JSONバックアップ
│  └─ graph/
│     └─ Graph.tsx              疑問同士の関連グラフ
├─ public/
│  ├─ icon.svg                  アプリアイコン
│  └─ manifest.webmanifest      ホーム画面追加用の情報
├─ tests/
│  ├─ app.spec.ts               PC・スマホの画面操作テスト（模擬通信）
│  └─ filter.spec.ts            絞り込み・並べ替えのテスト
├─ docs/
│  ├─ STRUCTURE.md              この構成案内
│  ├─ FEATURES.md               使い方・対応機能・制限
│  ├─ DATABASE.md               既存データベースの前提
│  ├─ STEP6.md                  初期起動・接続手順
│  └─ GITHUB-PAGES.md           公開手順
├─ sql/
│  └─ check-step5.sql           既存DBの読み取り専用の確認SQL
├─ scripts/
│  └─ check-connection.mjs      接続確認用スクリプト
├─ .github/workflows/
│  └─ pages.yml                 GitHub Pagesへの自動公開処理
├─ README.md                    プロジェクトの入口・概要
├─ SPEC.md                      アプリの仕様
├─ AGENTS.md                    開発時に守るルール
├─ README_CHANGE.txt            一部ファイルの変更対象を説明するメモ
├─ index.html                   ブラウザーが最初に読むHTML
├─ package.json                 利用ライブラリ・開発コマンド
├─ pnpm-lock.yaml               ライブラリの解決済みバージョン
├─ vite.config.ts               開発・ビルド設定
├─ tsconfig.json                TypeScript設定
├─ playwright.config.ts         テスト設定
├─ .gitignore                   GitHubへ保存しないファイルの指定
└─ .env.example                 接続設定のひな形
```

`README_CHANGE.txt` は一部ファイルを抜き出したZIPについての説明を含むメモです。アプリ全体の構成はこの文書、現在の仕様は `SPEC.md` と `docs/FEATURES.md` を参照してください。

## 変更したい画面と担当ファイル

| 変更したいもの | 主な担当ファイル |
|---|---|
| 疑問一覧の領域・分野・タグ欄 | `src/NotebookApp.tsx`、`src/components/FilterCreate.tsx` |
| 「＋疑問を追加」を押した後の画面 | `src/cards/QuickAdd.tsx` |
| 疑問を開いた後の編集画面 | `src/cards/CardDetail.tsx` |
| 追加・詳細画面の領域と分野 | `src/cards/ClassificationFields.tsx` |
| 新規作成時の名前入力やボタン | `src/components/InlineCreate.tsx` |
| 表示順・検索条件 | `src/cards/filter.ts` |
| 色・余白・スマホ配置 | `src/styles.css`、`src/notebook.css` |
| データの保存方法 | `src/data/repository.ts`、新規カードは `src/cards/api.ts` |

## 自動生成されるもの・ローカル専用のもの

| 名前 | 役割 | GitHubへの保存 |
|---|---|---|
| `node_modules/` | インストール済みライブラリ | 対象外 |
| `dist/` | ビルドで生成された公開用ファイル | 対象外。公開処理で生成 |
| `test-results/`、`playwright-report/` | テスト結果・スクリーンショット | 対象外 |
| `.env.local` | 手元で使う接続設定 | 対象外 |
| `.git/` | Gitの履歴や管理情報 | 手動編集・ZIP共有は不要 |

疑問や領域などの実データはSupabaseに保存されます。GitHubに保存するのは主にプログラムと説明書です。

## 編集から公開まで

1. ローカルの `question_app` を編集する。
2. 動作確認する。
3. GitHub Desktopで変更を確認してCommitする（ローカル履歴への保存）。
4. Push originでGitHubへ送る。
5. GitHub Actionsの公開処理が成功するとGitHub Pagesへ反映される。

クローンはGitHubから別の作業フォルダーを作る操作です。既存フォルダーの未送信の変更は、新しくクローンしたフォルダーには入りません。
