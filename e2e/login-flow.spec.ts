import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end-tester för hela inloggningsresan.
 * Testerna är nätverksoberoende: Supabase-anrop mockas via route-interception
 * så att CI aldrig behöver riktiga konton eller nycklar.
 */

const USER_ID = "11111111-1111-4111-8111-111111111111";

type MockOptions = {
  signInStatus?: number;
  roles?: string[];
};

async function mockSupabase(page: Page, opts: MockOptions = {}) {
  const { signInStatus = 200, roles = ["saljare"] } = opts;

  await page.route("**/auth/v1/token**", async (route) => {
    if (signInStatus !== 200) {
      await route.fulfill({
        status: signInStatus,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }),
      });
      return;
    }
    await route.fulfill({
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
    });
  });

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
}

test.describe("Inloggningsflöde", () => {
  test("oinloggad besökare skickas till /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel("E-post")).toBeVisible();
    await expect(page.getByLabel("Lösenord")).toBeVisible();
    await expect(page.getByRole("button", { name: "Logga in" })).toBeVisible();
  });

  test("kan växla mellan logga in och registrera", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /Inget konto\? Registrera dig/ }).click();
    await expect(page.getByRole("button", { name: "Skapa konto" })).toBeVisible();
    await page.getByRole("button", { name: /Har redan ett konto\? Logga in/ }).click();
    await expect(page.getByRole("button", { name: "Logga in" })).toBeVisible();
  });

  test("felaktiga uppgifter visar felmeddelande och stannar kvar", async ({ page }) => {
    await mockSupabase(page, { signInStatus: 400 });
    await page.goto("/login");
    await page.getByLabel("E-post").fill("fel@vt6.se");
    await page.getByLabel("Lösenord").fill("felaktigt123");
    await page.getByRole("button", { name: "Logga in" }).click();

    await expect(page.locator("p.text-destructive")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("konto utan roll nekas åtkomst", async ({ page }) => {
    await mockSupabase(page, { roles: [] });
    await page.goto("/login");
    await page.getByLabel("E-post").fill("test@vt6.se");
    await page.getByLabel("Lösenord").fill("hemligt123");
    await page.getByRole("button", { name: "Logga in" }).click();

    await expect(page.getByText(/saknar behörighet/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("lyckad inloggning leder till panelväljaren", async ({ page }) => {
    await mockSupabase(page, { roles: ["saljare", "hantverkare"] });
    await page.goto("/login");
    await page.getByLabel("E-post").fill("test@vt6.se");
    await page.getByLabel("Lösenord").fill("hemligt123");
    await page.getByRole("button", { name: "Logga in" }).click();

    await expect(page).toHaveURL(/\/valj-panel/, { timeout: 20_000 });
  });

  test("skyddad sida kräver inloggning", async ({ page }) => {
    await page.goto("/leads");
    await expect(page).toHaveURL(/\/login/);
  });
});
