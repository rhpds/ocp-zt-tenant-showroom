// UI step: Label ConfigMap lab-config with app=lab via OCP Console
// Login: "Sandbox user" (htpasswd) — NOT "Sandbox user (RHBK)"
// The has-text selector matches both; use exact match to pick htpasswd.
//
// Environment variables:
//   CONSOLE_URL  — OCP console URL
//   NAMESPACE    — student namespace
//   USERNAME     — sandbox username (user extravar)
//   PASSWORD     — sandbox password (password extravar)
//   RESOURCE_NAME, LABEL_KEY, LABEL_VALUE

const { chromium } = require("playwright");

(async () => {
  const consoleUrl   = process.env.CONSOLE_URL;
  const namespace    = process.env.NAMESPACE || "default";
  const username     = process.env.USERNAME || "";
  const password     = process.env.PASSWORD || "";
  const resourceName = process.env.RESOURCE_NAME || "lab-config";
  const labelKey     = process.env.LABEL_KEY || "app";
  const labelValue   = process.env.LABEL_VALUE || "lab";

  if (!consoleUrl || !username || !password) {
    console.error("FAILED: CONSOLE_URL, USERNAME and PASSWORD required");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page    = await context.newPage();

  page.on("framenavigated", f => {
    if (f === page.mainFrame())
      process.stderr.write("[nav] " + f.url().substring(0, 80) + "\n");
  });

  try {
    await page.goto(`${consoleUrl}/k8s/ns/${namespace}/configmaps/${resourceName}`,
      { waitUntil: "networkidle", timeout: 30000 });

    // Click "Sandbox user" — exact match to avoid picking "Sandbox user (RHBK)"
    const sandboxBtn = page.getByRole("link", { name: /^Sandbox user$/, exact: true })
      .or(page.getByRole("button", { name: /^Sandbox user$/, exact: true }));
    await sandboxBtn.waitFor({ state: "visible", timeout: 10000 });
    process.stderr.write("[click] Sandbox user (exact)\n");
    await sandboxBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    process.stderr.write("[after-click] " + page.url().substring(0, 80) + "\n");

    // Fill htpasswd login form
    const userField = page.locator("#inputUsername, [name=\"username\"], #username").first();
    await userField.waitFor({ state: "visible", timeout: 10000 });
    await userField.fill(username);
    await page.locator("#inputPassword, [name=\"password\"], input[type=\"password\"]").first().fill(password);
    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }),
      page.locator("button[type=\"submit\"], input[type=\"submit\"]").first().click(),
    ]);
    process.stderr.write("[after-login] " + page.url().substring(0, 80) + "\n");

    // Wait for console
    if (!page.url().startsWith(consoleUrl)) {
      await page.waitForURL(`${consoleUrl}/**`, { timeout: 20000 });
    }

    // Navigate to ConfigMap
    if (!page.url().includes(resourceName)) {
      await page.goto(`${consoleUrl}/k8s/ns/${namespace}/configmaps/${resourceName}`,
        { waitUntil: "networkidle", timeout: 20000 });
    }

    // Actions → Edit labels → add label → Save
    await page.locator("[data-test-id=\"actions-menu-button\"], button:has-text(\"Actions\")").first()
      .waitFor({ state: "visible", timeout: 15000 });
    await page.locator("[data-test-id=\"actions-menu-button\"], button:has-text(\"Actions\")").first().click();
    await page.locator("li:has-text(\"Edit labels\"), button:has-text(\"Edit labels\")").first().click();
    await page.waitForSelector("input[placeholder*=\"label\"], [data-test=\"labels-input\"]", { timeout: 10000 });
    await page.locator("input[placeholder*=\"label\"], [data-test=\"labels-input\"]").first().fill(`${labelKey}=${labelValue}`);
    await page.keyboard.press("Enter");
    await page.locator("button:has-text(\"Save\"), [data-test=\"confirm-action\"]").first().click();
    await page.waitForTimeout(2000);

    console.log(`SUCCESS: ${resourceName} labeled ${labelKey}=${labelValue} in ${namespace}`);
    process.exit(0);
  } catch (err) {
    process.stderr.write("[error] " + page.url() + "\n");
    console.error(`FAILED: ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
