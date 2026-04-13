// UI step: Label ConfigMap via OCP Console
// Login: Sandbox user (RHBK) → Keycloak
// Anti-detection: hide webdriver flag so Keycloak doesn't block headless browser

const { chromium } = require("playwright");

(async () => {
  const consoleUrl   = process.env.CONSOLE_URL;
  const namespace    = process.env.NAMESPACE || "default";
  const username     = process.env.USERNAME || "";
  const password     = process.env.PASSWORD || "";
  const resourceName = process.env.RESOURCE_NAME || "lab-config";
  const labelKey     = process.env.LABEL_KEY || "app";
  const labelValue   = process.env.LABEL_VALUE || "lab";

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  // Hide webdriver flag — Keycloak and other auth systems check this
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    delete navigator.__proto__.webdriver;
  });

  const page = await context.newPage();

  page.on("framenavigated", f => {
    if (f === page.mainFrame())
      process.stderr.write("[nav] " + f.url().substring(0, 100) + "\n");
  });

  try {
    await page.goto(`${consoleUrl}/k8s/ns/${namespace}/configmaps/${resourceName}`,
      { waitUntil: "networkidle", timeout: 30000 });

    // Click "Sandbox user (RHBK)" — exact match
    const rhbkBtn = page.getByRole("link", { name: /Sandbox user.*RHBK/i })
      .or(page.getByRole("button", { name: /Sandbox user.*RHBK/i }))
      .or(page.locator("a, button").filter({ hasText: /Sandbox user.*RHBK/i }));
    await rhbkBtn.first().waitFor({ state: "visible", timeout: 10000 });
    process.stderr.write("[click] Sandbox user (RHBK)\n");
    await rhbkBtn.first().click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });

    // Fill Keycloak form with a small delay (mimic human typing)
    const userField = page.locator("#username, [name=\"username\"]").first();
    await userField.waitFor({ state: "visible", timeout: 10000 });
    await userField.click();
    await page.waitForTimeout(200);
    await userField.type(username, { delay: 50 });

    const passField = page.locator("#password, [name=\"password\"], input[type=\"password\"]").first();
    await passField.click();
    await page.waitForTimeout(200);
    await passField.type(password, { delay: 50 });

    await page.waitForTimeout(300);
    process.stderr.write("[submit] clicking kc-login\n");
    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }),
      page.locator("#kc-login, button[type=\"submit\"]").first().click(),
    ]);
    process.stderr.write("[after-login] " + page.url().substring(0, 100) + "\n");

    // Wait for console
    if (!page.url().startsWith(consoleUrl)) {
      await page.waitForURL(`${consoleUrl}/**`, { timeout: 20000 });
    }

    // Navigate to ConfigMap
    if (!page.url().includes(resourceName)) {
      await page.goto(`${consoleUrl}/k8s/ns/${namespace}/configmaps/${resourceName}`,
        { waitUntil: "networkidle", timeout: 20000 });
    }

    // Actions → Edit labels → Save
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
