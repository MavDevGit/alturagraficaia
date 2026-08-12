import { expect, test, type Page } from "@playwright/test";

const me = {
  id: "u1",
  name: "Admin Local",
  email: "admin@local.test",
  role: "admin",
  credit_balance: 42,
  avatar_url: null,
};

async function mockApplication(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith("/me")) return route.fulfill({ json: me });
    if (path.endsWith("/admin/users/u2/credits")) {
      return route.fulfill({ json: { ok: true } });
    }
    if (path.endsWith("/admin/users/u2/role")) {
      return route.fulfill({ json: { ...me, id: "u2", role: "admin" } });
    }
    if (path.endsWith("/admin/users")) {
      return route.fulfill({
        json: {
          data: [
            me,
            {
              ...me,
              id: "u2",
              name: "Editora",
              email: "editora@local.test",
              role: "user",
              credit_balance: 8,
              last_login_at: null,
            },
          ],
        },
      });
    }
    if (path.endsWith("/admin/models")) {
      return route.fulfill({
        json: {
          data: [
            {
              id: 1,
              tool: "upscaler",
              model: "creative-upscaler",
              enabled: true,
              base_credits: 2,
            },
          ],
        },
      });
    }
    if (path.endsWith("/admin/secrets/status")) {
      return route.fulfill({
        json: {
          data: [{ name: "FAL_KEY", configured: true, rotated_at: null }],
        },
      });
    }
    if (path.endsWith("/admin/quotas")) {
      return route.fulfill({
        json: {
          data: [
            {
              id: 1,
              resource: "Procesamientos diarios",
              used: 32,
              soft_limit: 80,
              hard_limit: 100,
            },
          ],
        },
      });
    }
    if (path.endsWith("/jobs")) {
      return route.fulfill({
        json: {
          data: [],
          meta: { current_page: 1, last_page: 1, total: 0 },
        },
      });
    }
    return route.fulfill({ status: 404, json: { message: "mock missing" } });
  });
}

async function loginLocally(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Ingresar al entorno local" }).click();
  await expect(page).toHaveURL(/\/studio\/upscaler$/);
}

test("keeps the public landing separate from authentication and responsive", async ({
  page,
}) => {
  await mockApplication(page);

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Imágenes de alto impacto.*sin perder calidad/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Probar ahora" }).first(),
    ).toHaveAttribute("href", "/login");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
  }

  await page.getByRole("link", { name: "Probar ahora" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Qué bueno tenerte de vuelta" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute(
    "href",
    "/",
  );
});

test("preserves theme, keyboard focus and accessible Radix states", async ({
  page,
}) => {
  await mockApplication(page);
  await loginLocally(page);

  const accountTrigger = page.getByRole("button", { name: "Ayuda" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await accountTrigger.click();
  const lightMode = page.getByRole("menuitem", { name: "Modo claro" });
  await expect(lightMode).toBeVisible();
  await lightMode.click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("altura.theme")))
    .toBe("light");

  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await accountTrigger.click();
  await page.getByRole("menuitem", { name: "Modo oscuro" }).press("Escape");
  await expect(accountTrigger).toBeFocused();

  await accountTrigger.click();
  await page.getByRole("menuitem", { name: "Administración" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { name: "Administración" }),
  ).toBeVisible();

  const usersTab = page.getByRole("tab", { name: "Usuarios" });
  const modelsTab = page.getByRole("tab", { name: "Modelos" });
  await expect(usersTab).toHaveAttribute("aria-selected", "true");
  await modelsTab.click();
  await expect(modelsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("creative-upscaler")).toBeVisible();

  await usersTab.click();
  const creditButton = page
    .getByRole("row", { name: /Editora/ })
    .getByRole("button", { name: "Créditos" });
  await creditButton.click();
  await expect(
    page.getByRole("dialog", { name: "Ajustar créditos" }),
  ).toBeVisible();
  await page.getByRole("dialog").press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(creditButton).toBeFocused();
});

test("keeps Clean Flow responsive without horizontal overflow or small targets", async ({
  page,
}, testInfo) => {
  await mockApplication(page);

  for (const viewport of [
    { width: 1440, height: 900, suffix: "desktop" },
    { width: 390, height: 844, suffix: "mobile" },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Qué bueno tenerte de vuelta" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`login-${viewport.suffix}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width);
  }

  await loginLocally(page);
  const screens = [
    {
      id: "background-remover",
      name: "Quitar fondo",
      heading: "Sube una imagen para quitar el fondo",
    },
    {
      id: "outpainting",
      name: "Expandir lienzo",
      heading: "Sube una imagen para expandirla",
    },
    {
      id: "history",
      name: "Historial",
      heading: "Tus resultados recientes",
    },
    {
      id: "upscaler",
      name: "Escalador IA",
      heading: "Sube una imagen para ampliarla",
    },
  ];
  for (const screen of screens) {
    await page.getByRole("link", { name: screen.name }).click();
    await expect(
      page.getByRole("heading", { name: screen.heading }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`${screen.id}-mobile.png`),
      fullPage: true,
    });
  }

  const undersizedTargets = await page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>(
        "button, a, input, select, [role='tab'], [role='slider']",
      ),
    )
      .filter((element) => {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          element.getAttribute("type") !== "file" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0" &&
          box.width > 0 &&
          box.height > 0 &&
          (box.width < 44 || box.height < 44)
        );
      })
      .map((element) => ({
        name: element.getAttribute("aria-label") || element.innerText,
        width: Math.round(element.getBoundingClientRect().width),
        height: Math.round(element.getBoundingClientRect().height),
      })),
  );
  expect(undersizedTargets).toEqual([]);

  await page.setViewportSize({ width: 1440, height: 900 });
  for (const screen of screens) {
    await page.getByRole("link", { name: screen.name }).click();
    await expect(
      page.getByRole("heading", { name: screen.heading }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`${screen.id}-desktop.png`),
      fullPage: true,
    });
  }

  for (const viewport of [
    { width: 1440, height: 900, suffix: "desktop" },
    { width: 390, height: 844, suffix: "mobile" },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Administración" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`admin-${viewport.suffix}.png`),
      fullPage: true,
    });
  }
});
