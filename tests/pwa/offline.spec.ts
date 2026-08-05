import { expect, test } from "@playwright/test";

test("precachea la aplicación y conserva el arranque sin conexión", async ({
  context,
  page,
}) => {
  await page.goto("/login");
  await page.evaluate(() => navigator.serviceWorker.ready);
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
  }
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);

  await context.setOffline(true);
  await page.goto("/history");
  await expect(page).toHaveTitle("Altura Gráfica IA");
  await expect(page.locator("#root")).not.toBeEmpty();
});
