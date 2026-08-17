import { test, expect, type Page } from "@playwright/test";

/**
 * Rolltestmatris.
 * Verifierar för varje kontotyp:
 *  1) var användaren hamnar direkt efter inloggning, och
 *  2) vilka sidor som är tillgängliga respektive nekas.
 * Supabase mockas så att testerna körs utan riktiga konton.
 */

const USER_ID = "33333333-3333-4333-8333-333333333333";

async function mockSupabase(page: Page, roles: string[]) {
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
  await page.route("**/auth/v1/logout**", (route) => route.fulfill({ status: 204, body: "" }));
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
  // Alla övriga tabellanrop svarar tomt så att sidorna kan renderas.
  await page.route("**/rest/v1/**", async (route) => {
    if (route.request().url().includes("user_roles")) return route.fallback();
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
}

async function signIn(page: Page, roles: string[]) {
  await mockSupabase(page, roles);
  await page.goto("/login");
  await page.getByLabel("E-post").fill("test@vt6.se");
  await page.getByLabel("Lösenord").fill("hemligt123");
  await page.getByRole("button", { name: "Logga in" }).click();
}

type Landing = "dashboard" | "valj-panel" | "login";

type RoleCase = {
  namn: string;
  roller: string[];
  landing: Landing;
  seo: "tillåten" | "nekad";
  ekonomi: "tillåten" | "nekad";
};

/** Rolltestmatrisen – en rad per kontotyp. */
const MATRIX: RoleCase[] = [
  { namn: "admin (alla rättigheter)", roller: ["admin"], landing: "valj-panel", seo: "tillåten", ekonomi: "tillåten" },
  { namn: "säljare (endast extern)", roller: ["saljare"], landing: "dashboard", seo: "nekad", ekonomi: "nekad" },
  { namn: "hantverkare (endast intern)", roller: ["hantverkare"], landing: "dashboard", seo: "nekad", ekonomi: "nekad" },
  { namn: "arbetsledare (endast intern)", roller: ["arbetsledare"], landing: "dashboard", seo: "nekad", ekonomi: "nekad" },
  { namn: "ekonomi (ekonomiflik men ej SEO)", roller: ["ekonomi", "saljare"], landing: "dashboard", seo: "nekad", ekonomi: "tillåten" },
  { namn: "både intern och extern", roller: ["saljare", "hantverkare"], landing: "valj-panel", seo: "nekad", ekonomi: "nekad" },
  { namn: "ingen roll", roller: [], landing: "login", seo: "nekad", ekonomi: "nekad" },
];

const LANDING_URL: Record<Landing, RegExp> = {
  dashboard: /\/dashboard/,
  "valj-panel": /\/valj-panel/,
  login: /\/login/,
};

test.describe("Rolltestmatris – inloggning och landningssida", () => {
  for (const rad of MATRIX) {
    test(`${rad.namn} landar på ${rad.landing}`, async ({ page }) => {
      await signIn(page, rad.roller);

      await expect(page).toHaveURL(LANDING_URL[rad.landing], { timeout: 20_000 });

      if (rad.landing === "login") {
        await expect(page.getByText(/saknar behörighet/i)).toBeVisible();
      }
    });
  }
});

test.describe("Rolltestmatris – sidåtkomst", () => {
  for (const rad of MATRIX.filter((r) => r.roller.length > 0)) {
    test(`${rad.namn}: SEO-panelen är ${rad.seo}`, async ({ page }) => {
      await signIn(page, rad.roller);
      await page.goto("/seo");

      if (rad.seo === "tillåten") {
        await expect(page.getByText("Endast för administratörer")).toHaveCount(0);
      } else {
        await expect(page.getByText("Endast för administratörer")).toBeVisible({ timeout: 20_000 });
      }
    });

    test(`${rad.namn}: ROT-ansökningar är ${rad.ekonomi}`, async ({ page }) => {
      await signIn(page, rad.roller);
      await page.goto("/ekonomi/rot");

      if (rad.ekonomi === "tillåten") {
        await expect(page.getByText(/Endast för ekonomiansvarig/i)).toHaveCount(0);
      } else {
        await expect(page.getByText(/Endast för ekonomiansvarig/i)).toBeVisible({ timeout: 20_000 });
      }
    });
  }

  test("ingen roll nekas skyddade sidor och skickas till /login", async ({ page }) => {
    await mockSupabase(page, []);
    for (const path of ["/seo", "/ekonomi/rot", "/leads", "/provision"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    }
  });
});
