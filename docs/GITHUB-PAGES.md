# GitHub Pagesで公開する

このアプリはViteでビルドした `dist` を公開します。リポジトリのmainをそのまま配信する設定では動作しません。

## 最初にGitHubで設定する

1. リポジトリの Settings → Pages → Build and deployment → Source を **GitHub Actions** にする。
2. Settings → Secrets and variables → Actions → **Variables** を開く。
3. **New repository variable** から以下の2項目を作る。値はローカルの `.env.local` と同じ公開用設定。

| Name | Value |
| --- | --- |
| VITE_SUPABASE_URL | SupabaseのProject URL |
| VITE_SUPABASE_PUBLISHABLE_KEY | sb_publishable_で始まるPublishable key |

Secret keyやservice_roleは使わない。`.env.local` 自体をGitHubへ送らない。この2値は最終的にブラウザーへ配信される公開用設定。

## ファイルをGitHubへ送る

```sh
git add .github/workflows/pages.yml docs/GITHUB-PAGES.md README.md
git commit -m "Configure Vite deployment to GitHub Pages"
git push origin main
```

Actionsの **Deploy app to GitHub Pages** を開き、buildとdeployが両方成功するまで待つ。

公開先： https://takeda-daiki.github.io/question_app/

Variablesを後で変更した場合はActionsからこのワークフローをRun workflowで再実行する。設定はビルド時に埋め込まれる。

## 公開後の確認

ログイン → 疑問を追加 → 再読み込み → カードが残ることを確認する。PCで保存した既存カードは、同じアカウントでログインすればスマートフォンからも読み込める。

メール確認のリダイレクト先は既存Supabaseの設定に従う。この手順は共用プロジェクトのSite URLを書き換えない。

表示できない場合は、Actionsの失敗したステップを確認する。build成功だけでは公開完了ではなく、deployの成功も必要。

公式手順： https://vite.dev/guide/static-deploy.html#github-pages
