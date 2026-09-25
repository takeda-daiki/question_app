# 既存Supabaseデータ構造

Step 5で作成された構造の参照メモです。マイグレーションではありません。

- `qm_cards`: id, user_id, title, area_id, field_id, importance, effort, body, conclusion, status, created_at, updated_at, resolved_at, deleted_at。
- `qm_areas`: id, user_id, name, color, sort_order, created_at, updated_at。
- `qm_fields`: id, user_id, area_id, name, sort_order, created_at, updated_at。
- `qm_tags`: id, user_id, name, created_at, updated_at。
- `qm_card_tags`: user_id, card_id, tag_id, created_at。card_idとtag_idが複合主キー。
- `qm_card_links`: id, user_id, card_a_id, card_b_id, created_at。同じペアの逆方向を含めたユニーク制約。

カードのtitleのみ必須入力。status初期値はunresolved、importance/effort/分類はnullを許可。importanceは1〜3、effortはlow/medium/high、statusはunresolved/resolved。

`qm_touch_updated_at` が更新日時を、`qm_sync_resolution` が解決日時を管理します。カード編集・復元・削除は取得時の更新日時を条件に使い、他画面で更新されたカードを無条件に上書きしません。

認証ユーザーごとのRLSがSELECT/INSERT/UPDATE/DELETEを許可します。card_tagsとcard_linksはUPDATEせず追加・削除します。カードの分類参照には本人の領域・分野か、分野が領域に属するかのチェックが必要です。関連テーブルの複合外部キーで所有者が一致する必要があります。

UIの分類削除では参照のない分類だけを許可し、既存カードを不意に未分類にすることを防ぎます。カードの通常削除はdeleted_atへの日時設定で、関連付けを保持します。完全削除では既存DBの外部キーCASCADEにより関連行も削除されます。
