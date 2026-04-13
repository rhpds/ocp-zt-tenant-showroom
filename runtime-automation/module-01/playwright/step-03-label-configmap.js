// UI step: Label ConfigMap lab-config with app=lab via OCP Console
// Uses "Sandbox user" login (username/password) — works headlessly with Playwright.
//
// Environment variables:
//   CONSOLE_URL   — OCP console URL
//   NAMESPACE     — student namespace
//   USERNAME      — sandbox username (user extravar)
//   PASSWORD      — sandbox password (password extravar)
//   RESOURCE_NAME — configmap name (lab-config)
//   LABEL_KEY     — label key (app)
//   LABEL_VALUE   — label value (lab)

const { chromium } = require('playwright');

(async () => {
  const consoleUrl  = process.env.CONSOLE_URL;
  const namespace   = process.env.NAMESPACE || 'default';
  const username    = process.env.USERNAME || '';
  const password    = process.env.PASSWORD || '';
  const resourceName = process.env.RESOURCE_NAME || 'lab-config';
  const labelKey    = process.env.LABEL_KEY || 'app';
  const labelValue  = process.env.LABEL_VALUE || 'lab';

  if (!consoleUrl || !username || !password) {
    console.error('FAILED: CONSOLE_URL, USERNAME and PASSWORD are required');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page    = await context.newPage();

  try {
    // Navigate to the ConfigMap page — will redirect to login
    const resourceUrl = `${consoleUrl}/k8s/ns/${namespace}/configmaps/${resourceName}`;
    await page.goto(resourceUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Click "Sandbox user" login option
    const sandboxBtn = page.locator(
      'button:has-text("Sandbox user"), a:has-text("Sandbox user")'
    ).first();
    await sandboxBtn.waitFor({ state: 'visible', timeout: 10000 });
    await sandboxBtn.click();

    // Fill username/password
    await page.fill('#inputUsername, [name="username"], input[type="text"]', username);
    await page.fill('#inputPassword, [name="password"], input[type="password"]', password);
    await page.click('button[type="submit"], input[type="submit"]');

    // Wait for console to load after login
    await page.waitForURL(`${consoleUrl}/**`, { timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 });

    // If we got redirected back to the resource page — great; if not, navigate there
    if (!page.url().includes(resourceName)) {
      await page.goto(resourceUrl, { waitUntil: 'networkidle', timeout: 20000 });
    }

    // Open Actions menu
    const actionsBtn = page.locator(
      '[data-test-id="actions-menu-button"], button:has-text("Actions")'
    ).first();
    await actionsBtn.waitFor({ state: 'visible', timeout: 15000 });
    await actionsBtn.click();

    // Click Edit labels
    await page.locator('button:has-text("Edit labels"), li:has-text("Edit labels")').first().click();
    await page.waitForSelector(
      '[aria-label="Labels"], input[placeholder*="label"], [data-test="labels-input"]',
      { timeout: 10000 }
    );

    // Add label
    const labelInput = page.locator(
      'input[placeholder*="label"], [data-test="labels-input"], [aria-label="Labels"] input'
    ).first();
    await labelInput.fill(`${labelKey}=${labelValue}`);
    await page.keyboard.press('Enter');

    // Save
    await page.locator('button:has-text("Save"), [data-test="confirm-action"]').first().click();
    await page.waitForTimeout(2000);

    console.log(`SUCCESS: ${resourceName} labeled ${labelKey}=${labelValue} in ${namespace}`);
    process.exit(0);
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
