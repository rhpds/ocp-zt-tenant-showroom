// UI step: Label ConfigMap lab-config with app=lab via OCP Console
// Login: Sandbox user → Keycloak username/password form
//
// Environment variables:
//   CONSOLE_URL  — OCP console URL
//   NAMESPACE    — student namespace
//   USERNAME     — sandbox username (user extravar, e.g. devuser-tz29g)
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
    console.error("FAILED: CONSOLE_URL, USERNAME and PASSWORD are required");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page    = await context.newPage();

  try {
    const resourceUrl = `${consoleUrl}/k8s/ns/${namespace}/configmaps/${resourceName}`;
    await page.goto(resourceUrl, { waitUntil: "networkidle", timeout: 30000 });

    // 1. Click "Sandbox user" on the identity provider selector
    const sandboxBtn = page.locator("button:has-text(\"Sandbox user\"), a:has-text(\"Sandbox user\")").first();
    await sandboxBtn.waitFor({ state: "visible", timeout: 10000 });
    await sandboxBtn.click();

    // 2. Fill Keycloak login form
    await page.waitForSelector("#username, #inputUsername, [name=\"username\"]", { timeout: 15000 });
    await page.fill("#username, #inputUsername, [name=\"username\"]", username);
    await page.fill("#password, #inputPassword, [name=\"password\"], input[type=\"password\"]", password);
    await page.click("#kc-login, button[type=\"submit\"]");

    // 3. Wait for redirect back to OCP console
    await page.waitForURL(`${consoleUrl}/**`, { timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 });

    // 4. Navigate to ConfigMap if needed
    if (!page.url().includes(resourceName)) {
      await page.goto(resourceUrl, { waitUntil: "networkidle", timeout: 20000 });
    }

    // 5. Actions → Edit labels
    await page.locator("[data-test-id=\"actions-menu-button\"], button:has-text(\"Actions\")").first().waitFor({ state: "visible", timeout: 15000 });
    await page.locator("[data-test-id=\"actions-menu-button\"], button:has-text(\"Actions\")").first().click();
    await page.locator("button:has-text(\"Edit labels\"), li:has-text(\"Edit labels\")").first().click();
    await page.waitForSelector("input[placeholder*=\"label\"], [data-test=\"labels-input\"]", { timeout: 10000 });

    // 6. Add label and save
    const input = page.locator("input[placeholder*=\"label\"], [data-test=\"labels-input\"]").first();
    await input.fill(`${labelKey}=${labelValue}`);
    await page.keyboard.press("Enter");
    await page.locator("button:has-text(\"Save\"), [data-test=\"confirm-action\"]").first().click();
    await page.waitForTimeout(2000);

    console.log(`SUCCESS: ${resourceName} labeled ${labelKey}=${labelValue} in ${namespace} via OCP Console`);
    process.exit(0);
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
