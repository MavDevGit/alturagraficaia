import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const detailedTile = readFileSync("apps/web/public/pwa-512x512.png");

test("loads only visible tiles and keeps wheel zoom available", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      browserErrors.push(`${response.status()} ${response.url()}`);
  });
  const tileRequests: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/tiles/")) {
      tileRequests.push(url);
      return route.fulfill({
        status: 200,
        contentType: "image/png",
        body: url.includes("/assets/r1/") ? detailedTile : pixel,
      });
    }
    if (url.endsWith("/me"))
      return route.fulfill({
        json: {
          id: "u1",
          name: "Local",
          email: "local@test",
          role: "admin",
          credit_balance: 20,
          avatar_url: null,
        },
      });
    if (url.endsWith("/uploads"))
      return route.fulfill({
        status: 201,
        json: asset("a1", "original", 572, 1024),
      });
    if (url.endsWith("/jobs") && route.request().method() === "POST")
      return route.fulfill({ status: 201, json: job("queued") });
    if (url.endsWith("/jobs/j1"))
      return route.fulfill({ json: job("completed") });
    if (url.includes("/assets/a1/viewer"))
      return route.fulfill({ json: viewer("a1", 572, 1024, 10) });
    if (url.includes("/assets/r1/viewer"))
      return route.fulfill({ json: viewer("r1", 2288, 4096, 12) });
    return route.fulfill({ status: 404, json: { message: "mock missing" } });
  });
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Qué bueno tenerte de vuelta" }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("login.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Administrador local" }).click();
  await expect(
    page.getByRole("heading", { name: "Sube una imagen para ampliarla" }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("empty-studio.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Quitar fondo" }).click();
  await expect(
    page.getByRole("heading", { name: "Sube una imagen para quitar el fondo" }),
  ).toBeVisible();
  await expect(page.getByText("PNG transparente")).toBeVisible();
  await page.getByRole("link", { name: "Expandir lienzo" }).click();
  await expect(
    page.getByRole("heading", { name: "Sube una imagen para expandirla" }),
  ).toBeVisible();
  await expect(page.getByText("Calidad de procesamiento")).toBeVisible();
  await page.getByRole("link", { name: "Escalador IA" }).click();
  await expect(
    page.getByRole("heading", { name: "Sube una imagen para ampliarla" }),
  ).toBeVisible();
  await page.setInputFiles("input[type=file]", {
    name: "source.png",
    mimeType: "image/png",
    buffer: pixel,
  });
  await page.getByRole("button", { name: /Procesar imagen/ }).click();
  await expect(page.getByRole("button", { name: "Slider" })).toBeVisible();
  await expect.poll(() => tileRequests.length).toBeGreaterThan(0);
  expect(tileRequests.some((url) => url.includes("/content"))).toBeFalsy();
  const stage = page.locator(".compare-stage");
  await stage.hover();
  const initialZoom = await page.locator(".zoom-readout").textContent();
  await page.mouse.wheel(0, -500);
  await expect
    .poll(() => page.locator(".zoom-readout").textContent())
    .not.toBe(initialZoom);
  await page
    .getByRole("button", { name: /Ver archivo procesado al 100%/ })
    .click();
  await expect(page.locator(".zoom-readout")).toContainText("100");
  await page.screenshot({
    path: test.info().outputPath("studio.png"),
    fullPage: true,
  });
  expect(browserErrors).toEqual([]);
});

function asset(
  id: string,
  kind: "original" | "result",
  width: number,
  height: number,
) {
  return {
    id,
    kind,
    status: "ready",
    width,
    height,
    mime_type: "image/png",
    byte_size: 1000,
    viewer_url: "",
    download_url: "",
  };
}
function job(status: "queued" | "completed") {
  return {
    id: "j1",
    tool: "upscaler",
    status,
    credits: 2,
    settings: { scale: 4 },
    error: null,
    created_at: new Date().toISOString(),
    source_asset: asset("a1", "original", 572, 1024),
    result_asset:
      status === "completed" ? asset("r1", "result", 2288, 4096) : null,
  };
}
function viewer(id: string, width: number, height: number, max: number) {
  return {
    id,
    width,
    height,
    tile_size: 512,
    overlap: 1,
    format: "webp",
    max_level: max,
    ready: true,
    tile_url: `http://localhost:8000/api/v1/assets/${id}/tiles/{level}/{x}_{y}.webp?token=test`,
  };
}
