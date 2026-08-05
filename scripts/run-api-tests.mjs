import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function supportsLaravel(binary) {
  const check = spawnSync(binary, ["-r", "echo PHP_VERSION_ID;"], {
    encoding: "utf8",
    windowsHide: true,
  });
  return check.status === 0 && Number(check.stdout) >= 80300;
}

const candidates = ["php"];
if (process.platform === "win32" && process.env.LOCALAPPDATA) {
  const packages = join(
    process.env.LOCALAPPDATA,
    "Microsoft",
    "WinGet",
    "Packages",
  );
  if (existsSync(packages)) {
    for (const directory of readdirSync(packages)
      .filter((name) => name.startsWith("PHP.PHP."))
      .sort()
      .reverse()) {
      candidates.push(join(packages, directory, "php.exe"));
    }
  }
}

const php = candidates.find(supportsLaravel);
if (!php) {
  console.error("Se requiere PHP 8.3 o superior para ejecutar Pest.");
  process.exit(1);
}

const environment = { ...process.env };
if (process.argv.includes("--postgres")) {
  Object.assign(environment, {
    DB_CONNECTION: "pgsql",
    DB_HOST: "127.0.0.1",
    DB_PORT: "5432",
    DB_DATABASE: "alturagrafica_pwa_test",
    DB_USERNAME: "alturagrafica",
    DB_PASSWORD: "change-me-locally",
  });
}

const result = spawnSync(php, ["artisan", "test"], {
  cwd: resolve("apps/api"),
  stdio: "inherit",
  windowsHide: true,
  env: environment,
});
process.exit(result.status ?? 1);
