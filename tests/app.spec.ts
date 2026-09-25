import { test, expect, type Page } from '@playwright/test';

const userId = '11111111-1111-4111-8111-111111111111';
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'test@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const token = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', exp: 4102444800 })).toString('base64url')}.test`;
const session = { access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, user };

async function mock(page: Page, options: { failLogin?: boolean; loseResponse?: boolean; failList?: boolean } = {}) {
  const cards: { id: string; title: string; created_at: string }[] = [];
  let inserts = 0;
  let loseResponse = options.loseResponse;
  let failList = options.failList;
  await page.route('https://test-project.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith('/token')) {
      await route.fulfill({ status: options.failLogin ? 400 : 200, json: options.failLogin ? { error: 'invalid_grant', error_description: 'Invalid login credentials' } : session });
    } else if (url.pathname.endsWith('/logout')) {
      await route.fulfill({ status: 204 });
    } else if (url.pathname.endsWith('/user')) {
      await route.fulfill({ json: user });
    } else if (url.pathname.endsWith('/signup')) {
      await route.fulfill({ json: { ...user, identities: [] } });
    } else if (url.pathname.endsWith('/qm_cards')) {
      expect(request.headers().authorization).toBe(`Bearer ${token}`);
      if (request.method() === 'POST') {
        inserts++;
        const body = request.postDataJSON();
        expect(body.user_id).toBe(userId);
        expect(Object.keys(body).sort()).toEqual(['id', 'title', 'user_id']);
        if (cards.some(card => card.id === body.id)) {
          await route.fulfill({ status: 409, json: { code: '23505', message: 'duplicate key' } });
        } else {
          const card = { id: body.id, title: body.title, created_at: '2026-09-25T03:00:00Z' };
          cards.unshift(card);
          if (loseResponse) { loseResponse = false; await route.abort('failed'); }
          else await route.fulfill({ status: 201, json: card });
        }
      } else {
        expect(url.searchParams.get('user_id')).toBe(`eq.${userId}`);
        if (failList) { await route.fulfill({ status: 403, json: { message: 'test denied' } }); return; }
        if (url.searchParams.has('id')) {
          await route.fulfill({ json: cards.find(c => `eq.${c.id}` === url.searchParams.get('id')) });
        } else {
          expect(url.searchParams.get('status')).toBe('eq.unresolved');
          expect(url.searchParams.get('deleted_at')).toBe('is.null');
          await route.fulfill({ json: cards });
        }
      }
    } else { throw new Error(`Unexpected request: ${request.url()}`); }
  });
  return { cards, insertCount: () => inserts, recoverList: () => { failList = false; } };
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('メールアドレス').fill('test@example.com');
  await page.getByLabel('パスワード', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
}

test('login, create plain text title, reload and logout', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const backend = await mock(page);
  await login(page);
  await expect(page.getByText('最初の疑問を残しましょう')).toBeVisible();
  await page.getByRole('button', { name: '＋ 疑問を追加', exact: true }).click();
  await expect(page.getByLabel('疑問のタイトル')).toBeFocused();
  await page.getByLabel('疑問のタイトル').fill('   ');
  await expect(page.getByRole('button', { name: '保存する' })).toBeDisabled();
  await page.getByLabel('疑問のタイトル').fill('  ベイズ推定とは？ <script>alert(1)</script>  ');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('heading', { name: 'ベイズ推定とは？ <script>alert(1)</script>' })).toBeVisible();
  expect(backend.cards).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ベイズ推定とは？ <script>alert(1)</script>' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('cards.png'), fullPage: true });
  await page.getByRole('button', { name: 'ログアウト' }).click();
  await expect(page.getByRole('heading', { name: 'おかえりなさい' })).toBeVisible();
  await expect(page.getByText('ベイズ推定とは？ <script>alert(1)</script>', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('lost save response retains draft and retries without duplicate', async ({ page }) => {
  const backend = await mock(page, { loseResponse: true });
  await login(page);
  await page.getByRole('button', { name: '＋ 疑問を追加', exact: true }).click();
  await page.getByLabel('疑問のタイトル').fill('再試行する疑問');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('alert')).toContainText('入力は残っています');
  await expect(page.getByLabel('疑問のタイトル')).toHaveValue('再試行する疑問');
  await page.getByRole('button', { name: '保存する' }).click();
  await expect(page.getByRole('heading', { name: '再試行する疑問' })).toBeVisible();
  expect(backend.cards).toHaveLength(1);
  expect(backend.insertCount()).toBe(2);
});

test('list failure is distinct from empty and retry recovers', async ({ page }) => {
  const backend = await mock(page, { failList: true });
  await login(page);
  await expect(page.getByRole('alert')).toContainText('一覧を読み込めませんでした');
  await expect(page.getByText('最初の疑問を残しましょう')).toHaveCount(0);
  backend.recoverList();
  await page.getByRole('button', { name: '再試行', exact: true }).click();
  await expect(page.getByText('最初の疑問を残しましょう')).toBeVisible();
});

test('invalid credentials display a useful error', async ({ page }, testInfo) => {
  await mock(page, { failLogin: true });
  await login(page);
  await expect(page.getByRole('alert')).toContainText('ログインできませんでした');
  await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true });
});

test('signup requiring email confirmation does not expose card screen', async ({ page }) => {
  await mock(page);
  await page.goto('/');
  await page.getByRole('button', { name: '初めての方はこちら' }).click();
  await page.getByLabel('メールアドレス').fill('new@example.com');
  await page.getByLabel('パスワード', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'アカウントを作成', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('確認メール');
  await expect(page.getByRole('heading', { name: '疑問一覧', exact: true })).toHaveCount(0);
});
