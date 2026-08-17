import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end-tester för utloggning.
 * Verifierar att sessionen rensas och att skyddade sidor inte går att nå
 * efter utloggning – varken via direktlänk eller webbläsarens bakåtknapp.
 * Supabase-anrop mockas så att testerna är nätverksoberoende.
 */

const USER_ID = "22222222-2222-4222-8222-222222222222";

type MockOptions = {
  roles?: string[];
};

async function mockSupabase(page: Page, opts: MockOptions = {}) {
  const { roles = ["saljare"] } = opts;

  await page.route("**/auth/v1/token**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "test-access-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "test-refresh-token",
        user: { id: USER_ID, email: "test@vt6.se", aud: "authenticated", role: "authenticated" },
      }),
    }),
  );

  await page.route("**/auth/v1/logout**", (route) =>
    route.fulfill({ status: 204, contentType: "application/json", body: "" }),
  );

  await page.route("**/auth/v1/user**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: USER_ID, email: "test@vt6.se", aud: "authenticated", role: "authenticated" }),
    }),
  );

  await page.route("**/rest/v1/user_roles**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(roles.map((role) => ({ role, user_id: USER_ID }))),
    }),
  );

  // Övriga tabellanrop svarar tomt så att skalet kan rendera utan riktig backend.
  await page.route("**/rest/v1/**", async (route) => {
    if (route.request().url().includes("user_roles")) return route.fallback();
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("E-post").fill("test@vt6.se");
  await page.getByLabel("Lösenord").fill("hemligt123");
  await page.getByRole("button", { name: "Logga in" }).click();
}

async function hasSupabaseSession(page: Page) {
  return page.evaluate(() =>
    Object.keys(window.localStorage).some((k) => k.startsWith("sb-") && k.endsWith("-auth-token")),
  );
}

test.describe("Utloggning", () => {
  test("utloggning från panelväljaren leder tillbaka till /login", async ({ page }) => {
    await mockSupabase(page, { roles: [] });
    await signIn(page);

    await page.goto("/valj-panel");
    await page.getByRole("button", { name: /Logga ut/i }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    expect(await hasSupabaseSession(page)).toBe(false);
  });

  test("utloggning från appen rensar sessionen", async ({ page }) => {
    await mockSupabase(page, { roles: ["saljare", "hantverkare"] });
    await signIn(page);
    await expect(page).toHaveURL(/\/valj-panel/, { timeout: 20_000 });

    await page.getByRole("button", { name: /Intern/i }).first().click();
    await expect(page).not.toHaveURL(/\/valj-panel/, { timeout: 20_000 });

    await page.getByRole("button", { name: /Logga ut/i }).first().click();
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    expect(await hasSupabaseSession(page)).toBe(false);
  });

  test("skyddad sida är otillgänglig efter utloggning", async ({ page }) => {
    await mockSupabase(page, { roles: ["saljare"] });
    await signIn(page);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    // Logga ut direkt via klienten och verifiera att skyddade sidor blockeras.
    await page.evaluate(() => {
      window.localStorage.clear();
    });
    await page.goto("/leads");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Logga in" })).toBeVisible();

    await page.goto("/ekonomi/rot");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });

  test("bakåtknappen återställer inte skyddad sida efter utloggning", async ({ page }) => {
    await mockSupabase(page, { roles: [] });
    await signIn(page);
    await page.goto("/valj-panel");

    await page.getByRole("button", { name: /Logga ut/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Logga in" })).toBeVisible();
  });
});
