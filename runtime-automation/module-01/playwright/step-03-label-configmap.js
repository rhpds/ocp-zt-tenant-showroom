// UI step: Label ConfigMap lab-config with app=lab via OCP Console
// Login: Sandbox user → Keycloak (username/password)

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

  // Log URL changes for debugging
  page.on("framenavigated", frame => {
    if (frame === page.mainFrame()) {
      process.stderr.write("[nav] " + frame.url() + "\n");
    }
  });

  try {
    const resourceUrl = `${consoleUrl}/k8s/ns/${namespace}/configmaps/${resourceName}`;
    await page.goto(resourceUrl, { waitUntil: "networkidle", timeout: 30000 });
    process.stderr.write("[step1] at: " + page.url() + "\n");

    // Click Sandbox user
    const sandboxBtn = page.locator("a:has-text(\"Sandbox user\"), button:has-text(\"Sandbox user\")").first();
    await sandboxBtn.waitFor({ state: "visible", timeout: 10000 });
    await sandboxBtn.click();
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    process.stderr.write("[step2] at: " + page.url() + "\n");

    // Fill Keycloak form
    const usernameField = page.locator("#username, [name=\"username\"], #inputUsername").first();
    await usernameField.waitFor({ state: "visible", timeout: 10000 });
    process.stderr.write("[step3] filling username: " + username + "\n");
    await usernameField.fill(username);
    await page.locator("#password, [name=\"password\"], input[type=\"password\"]").first().fill(password);

    // Submit and wait for any navigation away from keycloak
    await Promise.all([
      page.waitForNavigation({ timeout: 30000 }),
      page.locator("#kc-login, button[type=\"submit\"]").first().click(),
    ]);
    process.stderr.write("[step4] after submit: " + page.url() + "\n");

    // Wait until we are on the console
    if (!page.url().startsWith(consoleUrl)) {
      await page.waitForURL(`${consoleUrl}/**`, { timeout: 20000 });
    }
    process.stderr.write("[step5] on console: " + page.url() + "\n");

    // Navigate to ConfigMap
    if (!page.url().includes(resourceName)) {
      await page.goto(resourceUrl, { waitUntil: "networkidle", timeout: 20000 });
    }

    // Actions → Edit labels
    const actionsBtn = page.locator("[data-test-id=\"actions-menu-button\"], button:has-text(\"Actions\")").first();
    await actionsBtn.waitFor({ state: "visible", timeout: 15000 });
    await actionsBtn.click();
    await page.locator("li:has-text(\"Edit labels\"), button:has-text(\"Edit labels\")").first().click();
    await page.waitForSelector("input[placeholder*=\"label\"], [data-test=\"labels-input\"]", { timeout: 10000 });
    await page.locator("input[placeholder*=\"label\"], [data-test=\"labels-input\"]").first().fill(`${labelKey}=${labelValue}`);
    await page.keyboard.press("Enter");
    await page.locator("button:has-text(\"Save\"), [data-test=\"confirm-action\"]").first().click();
    await page.waitForTimeout(2000);

    console.log(`SUCCESS: ${resourceName} labeled ${labelKey}=${labelValue} in ${namespace}`);
    process.exit(0);
  } catch (err) {
    process.stderr.write("[error] at: " + page.url() + "\n");
    console.error(`FAILED: ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
