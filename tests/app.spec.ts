import { test, expect, type Page } from "@playwright/test";

const userId = "11111111-1111-4111-8111-111111111111";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};
const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: userId, role: "authenticated", exp: 4102444800 })).toString("base64url")}.test`;
const session = {
  access_token: token,
  refresh_token: "test-refresh",
  token_type: "bearer",
  expires_in: 3600,
  user,
};

async function mock(
  page: Page,
  options: {
    failLogin?: boolean;
    loseResponse?: boolean;
    failList?: boolean;
  } = {},
) {
  const cards: any[] = [];
  const tables: Record<string, any[]> = {
    qm_cards: cards,
    qm_areas: [],
    qm_fields: [],
    qm_tags: [],
    qm_card_tags: [],
    qm_card_links: [],
  };
  let inserts = 0;
  let loseResponse = options.loseResponse;
  let failList = options.failList;
  await page.route("https://test-project.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/token")) {
      await route.fulfill({
        status: options.failLogin ? 400 : 200,
        json: options.failLogin
          ? {
              error: "invalid_grant",
              error_description: "Invalid login credentials",
            }
          : session,
      });
    } else if (url.pathname.endsWith("/logout")) {
      await route.fulfill({ status: 204 });
    } else if (url.pathname.endsWith("/user")) {
      await route.fulfill({ json: user });
    } else if (url.pathname.endsWith("/signup")) {
      await route.fulfill({ json: { ...user, identities: [] } });
    } else if (url.pathname.startsWith("/rest/v1/")) {
      const table = url.pathname.split("/").pop()!;
      const rows = tables[table];
      if (!rows) throw new Error(`Unknown table: ${table}`);
      expect(request.headers().authorization).toBe(`Bearer ${token}`);
      const matches = (row: any) =>
        [...url.searchParams.entries()].every(
          ([key, value]) =>
            !value.startsWith("eq.") || String(row[key]) === value.slice(3),
        );
      if (request.method() === "POST") {
        if (table === "qm_cards") inserts++;
        const body = request.postDataJSON();
        expect(body.user_id).toBe(userId);
        if (body.id && rows.some((card) => card.id === body.id)) {
          await route.fulfill({
            status: 409,
            json: { code: "23505", message: "duplicate key" },
          });
        } else {
          const card = {
            id: body.id ?? crypto.randomUUID(),
            created_at: "2026-09-25T03:00:00Z",
            updated_at: "2026-09-25T03:00:00Z",
            ...(table === "qm_cards"
              ? {
                  body: null,
                  conclusion: null,
                  area_id: null,
                  field_id: null,
                  importance: null,
                  effort: null,
                  status: "unresolved",
                  deleted_at: null,
                  resolved_at: null,
                }
              : {}),
            ...body,
          };
          rows.unshift(card);
          if (loseResponse && table === "qm_cards") {
            loseResponse = false;
            await route.abort("failed");
          } else await route.fulfill({ status: 201, json: card });
        }
      } else if (request.method() === "PATCH") {
        expect(url.searchParams.get("user_id")).toBe(`eq.${userId}`);
        const row = rows.find(matches);
        if (row) {
          Object.assign(row, request.postDataJSON());
          row.updated_at = new Date().toISOString();
          if (table === "qm_cards")
            row.resolved_at =
              row.status === "resolved" ? new Date().toISOString() : null;
        }
        await route.fulfill({ json: row ?? null });
      } else if (request.method() === "DELETE") {
        expect(url.searchParams.get("user_id")).toBe(`eq.${userId}`);
        const removed = rows.filter(matches);
        for (let i = rows.length - 1; i >= 0; i--)
          if (matches(rows[i])) rows.splice(i, 1);
        await route.fulfill({ json: removed });
      } else {
        expect(url.searchParams.get("user_id")).toBe(`eq.${userId}`);
        if (failList && table === "qm_cards") {
          await route.fulfill({
            status: 403,
            json: { message: "test denied" },
          });
          return;
        }
        if (url.searchParams.has("id")) {
          await route.fulfill({ json: rows.find(matches) });
        } else {
          const offset = Number(url.searchParams.get("offset") || 0);
          const limit = Number(url.searchParams.get("limit") || 500);
          await route.fulfill({
            json: rows.filter(matches).slice(offset, offset + limit),
          });
        }
      }
    } else {
      throw new Error(`Unexpected request: ${request.url()}`);
    }
  });
  return {
    cards,
    tables,
    insertCount: () => inserts,
    recoverList: () => {
      failList = false;
    },
  };
}

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("メールアドレス").fill("test@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
}

test("login, create plain text title, reload and logout", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const backend = await mock(page);
  await login(page);
  await expect(page.getByText("最初の疑問を残しましょう")).toBeVisible();
  await page
    .getByRole("button", { name: "＋ 疑問を追加", exact: true })
    .click();
  await expect(page.getByLabel("疑問のタイトル")).toBeFocused();
  await page.getByLabel("疑問のタイトル").fill("   ");
  await expect(page.getByRole("button", { name: "保存する" })).toBeDisabled();
  await page
    .getByLabel("疑問のタイトル")
    .fill("  ベイズ推定とは？ <script>alert(1)</script>  ");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(
    page.getByRole("heading", {
      name: "ベイズ推定とは？ <script>alert(1)</script>",
    }),
  ).toBeVisible();
  expect(backend.cards).toHaveLength(1);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "ベイズ推定とは？ <script>alert(1)</script>",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("cards.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(
    page.getByRole("heading", { name: "おかえりなさい" }),
  ).toBeVisible();
  await expect(
    page.getByText("ベイズ推定とは？ <script>alert(1)</script>", {
      exact: true,
    }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("lost save response retains draft and retries without duplicate", async ({
  page,
}) => {
  const backend = await mock(page, { loseResponse: true });
  await login(page);
  await page
    .getByRole("button", { name: "＋ 疑問を追加", exact: true })
    .click();
  await page.getByLabel("疑問のタイトル").fill("再試行する疑問");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByRole("alert")).toContainText("入力は残っています");
  await expect(page.getByLabel("疑問のタイトル")).toHaveValue("再試行する疑問");
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(
    page.getByRole("heading", { name: "再試行する疑問" }),
  ).toBeVisible();
  expect(backend.cards).toHaveLength(1);
  expect(backend.insertCount()).toBe(2);
});

test("list failure is distinct from empty and retry recovers", async ({
  page,
}) => {
  const backend = await mock(page, { failList: true });
  await login(page);
  await expect(page.getByRole("alert")).toContainText(
    "一覧を読み込めませんでした",
  );
  await expect(page.getByText("最初の疑問を残しましょう")).toHaveCount(0);
  backend.recoverList();
  await page.getByRole("button", { name: "再試行", exact: true }).click();
  await expect(page.getByText("最初の疑問を残しましょう")).toBeVisible();
});

test("invalid credentials display a useful error", async ({
  page,
}, testInfo) => {
  await mock(page, { failLogin: true });
  await login(page);
  await expect(page.getByRole("alert")).toContainText(
    "ログインできませんでした",
  );
  await page.screenshot({
    path: testInfo.outputPath("login.png"),
    fullPage: true,
  });
});

test("signup requiring email confirmation does not expose card screen", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/");
  await page.getByRole("button", { name: "初めての方はこちら" }).click();
  await page.getByLabel("メールアドレス").fill("new@example.com");
  await page.getByLabel("パスワード", { exact: true }).fill("test-password");
  await page
    .getByRole("button", { name: "アカウントを作成", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("確認メール");
  await expect(
    page.getByRole("heading", { name: "疑問一覧", exact: true }),
  ).toHaveCount(0);
});

async function go(page: Page, name: string) {
  const sidebar = page
    .locator(".sidebar")
    .getByRole("button", { name, exact: true });
  if (await sidebar.isVisible()) await sidebar.click();
  else
    await page
      .getByRole("navigation", { name: "メインメニュー" })
      .getByRole("button", { name, exact: true })
      .click();
}
function seed(
  backend: Awaited<ReturnType<typeof mock>>,
  id: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  backend.cards.push({
    id,
    user_id: userId,
    title,
    body: "",
    conclusion: "",
    status: "unresolved",
    importance: null,
    effort: null,
    area_id: null,
    field_id: null,
    deleted_at: null,
    resolved_at: null,
    created_at: "2026-09-25T03:00:00Z",
    updated_at: "2026-09-25T03:00:00Z",
    ...extra,
  });
}

test("edit, live math preview, classification, tag, resolve, trash and restore", async ({
  page,
}, testInfo) => {
  const backend = await mock(page);
  seed(backend, "card-one", "ベイズ推定とは？");
  backend.tables.qm_areas.push({
    id: "area-one",
    user_id: userId,
    name: "学習",
    color: "#336633",
    sort_order: 0,
  });
  backend.tables.qm_fields.push({
    id: "field-one",
    user_id: userId,
    area_id: "area-one",
    name: "統計",
    sort_order: 0,
  });
  backend.tables.qm_tags.push({
    id: "tag-one",
    user_id: userId,
    name: "あとで調べる",
  });
  await login(page);
  await page
    .getByRole("button", { name: "ベイズ推定とは？", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("本文", { exact: true })
    .fill("# メモ\n\n**重要**\n\n$x^2$\n\n<script>alert(1)</script>");
  await expect(dialog.locator(".katex").first()).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "メモ", exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("結論", { exact: true })
    .fill("データから信念を更新する");
  await dialog
    .getByRole("combobox", { name: "重要度", exact: true })
    .selectOption("3");
  await dialog
    .getByRole("combobox", { name: "労力", exact: true })
    .selectOption("low");
  await dialog
    .getByRole("combobox", { name: "領域", exact: true })
    .selectOption("area-one");
  await dialog
    .getByRole("combobox", { name: "分野", exact: true })
    .selectOption("field-one");
  await dialog.getByRole("button", { name: "変更を保存" }).click();
  await expect(
    dialog.getByText("保存しました。", { exact: true }),
  ).toBeVisible();
  await dialog.getByLabel("あとで調べる", { exact: true }).click();
  await expect(dialog.getByText("タグを保存しました。")).toBeVisible();
  await expect(
    dialog.getByLabel("あとで調べる", { exact: true }),
  ).toBeChecked();
  await page.screenshot({
    path: testInfo.outputPath("detail.png"),
    fullPage: true,
  });
  await dialog
    .getByRole("combobox", { name: "状態", exact: true })
    .selectOption("resolved");
  await dialog.getByRole("button", { name: "変更を保存" }).click();
  await expect(
    dialog.getByText("保存しました。", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "ベイズ推定とは？", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "解決済み", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "ベイズ推定とは？", exact: true }),
  ).toBeVisible();
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "ゴミ箱へ", exact: true }).click();
  await go(page, "ゴミ箱");
  await expect(
    page.getByRole("button", { name: "復元", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "復元", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "復元", exact: true }),
  ).toHaveCount(0);
  await go(page, "検索");
  await page.getByLabel("キーワード").fill("信念");
  await expect(
    page.getByRole("button", { name: "ベイズ推定とは？", exact: true }),
  ).toBeVisible();
  expect(backend.cards[0]).toMatchObject({
    status: "resolved",
    importance: 3,
    effort: "low",
    field_id: "field-one",
    deleted_at: null,
  });
});

test("related cards are bidirectional, graph opens details, export includes relations", async ({
  page,
}, testInfo) => {
  const backend = await mock(page);
  seed(backend, "card-a", "事前分布とは", { area_id: "area-one" });
  seed(backend, "card-b", "尤度とは", { area_id: "area-one" });
  backend.tables.qm_areas.push({
    id: "area-one",
    user_id: userId,
    name: "統計学",
    sort_order: 0,
  });
  await login(page);
  await page.getByRole("button", { name: "事前分布とは", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("関連付けるカード").selectOption("card-b");
  await dialog.getByRole("button", { name: "関連付ける", exact: true }).click();
  await expect(dialog.getByText("関連付けました。")).toBeVisible();
  await dialog.getByRole("button", { name: "尤度とは", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("タイトル", { exact: true })).toHaveValue(
    "尤度とは",
  );
  await expect(
    dialog.getByRole("button", { name: "事前分布とは", exact: true }),
  ).toBeVisible();
  expect(backend.tables.qm_card_links).toHaveLength(1);
  await dialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await go(page, testInfo.project.name === "mobile" ? "グラフ" : "関連グラフ");
  await page
    .getByRole("combobox", { name: "領域", exact: true })
    .selectOption("area-one");
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath("graph.png"),
    fullPage: true,
  });
  await page
    .locator(".react-flow__node")
    .filter({ hasText: "尤度とは" })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("タイトル", { exact: true }),
  ).toHaveValue("尤度とは");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる", exact: true })
    .click();
  await go(page, "設定");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONをエクスポート" }).click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const json = JSON.parse(Buffer.concat(chunks).toString());
  expect(json.cards).toHaveLength(2);
  expect(json.links).toHaveLength(1);
  expect(json).not.toHaveProperty("access_token");
});

test("manage classifications and tags without deleting cards", async ({
  page,
}) => {
  const backend = await mock(page);
  await login(page);
  await go(page, "設定");
  await page.getByLabel("領域名", { exact: true }).fill("研究");
  await page.getByRole("button", { name: "領域を作成" }).click();
  await expect(page.locator(".settings-list")).toContainText("研究");
  await page.getByRole("button", { name: "分野", exact: true }).click();
  await page.getByLabel("親の領域").selectOption({ label: "研究" });
  await page.getByLabel("分野名", { exact: true }).fill("心理学");
  await page.getByRole("button", { name: "分野を作成" }).click();
  await expect(page.locator(".settings-list")).toContainText("心理学");
  await page.getByRole("button", { name: "タグ", exact: true }).click();
  await page.getByLabel("タグ名", { exact: true }).fill("論文");
  await page.getByRole("button", { name: "タグを作成" }).click();
  await expect(page.locator(".settings-list")).toContainText("論文");
  expect(backend.tables.qm_areas).toHaveLength(1);
  expect(backend.tables.qm_fields).toHaveLength(1);
  expect(backend.tables.qm_tags).toHaveLength(1);
});

test("concurrent edits are rejected and draft is preserved", async ({
  page,
}) => {
  const backend = await mock(page);
  seed(backend, "concurrent", "元のタイトル");
  await login(page);
  await page.getByRole("button", { name: "元のタイトル", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("タイトル", { exact: true })
    .fill("自分の編集");
  backend.cards[0].updated_at = "2026-09-26T00:00:00Z";
  backend.cards[0].title = "別画面の編集";
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "別の画面で変更",
  );
  await expect(
    page.getByRole("dialog").getByLabel("タイトル", { exact: true }),
  ).toHaveValue("自分の編集");
  expect(backend.cards[0].title).toBe("別画面の編集");
});

test("search and backup include rows beyond first database page", async ({
  page,
}) => {
  const backend = await mock(page);
  for (let i = 0; i < 503; i++) seed(backend, `card-${i}`, `疑問${i}`);
  await login(page);
  await page.getByLabel("キーワード").fill("疑問502");
  await expect(
    page.getByRole("button", { name: "疑問502", exact: true }),
  ).toBeVisible();
  await go(page, "設定");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONをエクスポート" }).click();
  const file = await download;
  const stream = await file.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString()).cards).toHaveLength(503);
});

test("permanent deletion requires confirmation and only targets trash", async ({
  page,
}) => {
  const backend = await mock(page);
  seed(backend, "keep", "残しておく疑問");
  seed(backend, "remove", "削除する疑問", {
    deleted_at: "2026-09-25T00:00:00Z",
  });
  await login(page);
  await expect(
    page.getByRole("button", { name: "完全に削除", exact: true }),
  ).toHaveCount(0);
  await go(page, "ゴミ箱");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("button", { name: "完全に削除", exact: true }).click();
  expect(backend.cards).toHaveLength(2);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "完全に削除", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "削除する疑問", exact: true }),
  ).toHaveCount(0);
  expect(backend.cards.map((c) => c.id)).toEqual(["keep"]);
});

test("quick add can keep draft when closing is cancelled", async ({ page }) => {
  const backend = await mock(page);
  await login(page);
  await page
    .getByRole("button", { name: "＋ 疑問を追加", exact: true })
    .click();
  await page.getByLabel("疑問のタイトル").fill("失いたくない疑問");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "閉じる", exact: true })
    .click();
  await expect(page.getByLabel("疑問のタイトル")).toHaveValue(
    "失いたくない疑問",
  );
  expect(backend.cards).toHaveLength(0);
});

test("quick add inherits the selected field and its area", async ({
  page,
}, testInfo) => {
  const backend = await mock(page);
  backend.tables.qm_areas.push({
    id: "a",
    user_id: userId,
    name: "科学",
    sort_order: 0,
  });
  backend.tables.qm_fields.push({
    id: "f",
    user_id: userId,
    area_id: "a",
    name: "物理",
    sort_order: 0,
  });
  await login(page);
  await page
    .getByRole("combobox", { name: "分野", exact: true })
    .selectOption("f");
  await page
    .getByRole("button", { name: "＋ 疑問を追加", exact: true })
    .click();
  await page.getByLabel("疑問のタイトル").fill("光はなぜ曲がる？");
  await page.getByRole("button", { name: "保存する", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "光はなぜ曲がる？", exact: true }),
  ).toBeVisible();
  expect(backend.cards[0]).toMatchObject({ area_id: "a", field_id: "f" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "光はなぜ曲がる？", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByLabel("タイトル", { exact: true })).toHaveValue("光はなぜ曲がる？");
  await page.screenshot({
    path: testInfo.outputPath("detail-top.png"),
    fullPage: true,
  });
});
