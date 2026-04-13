// UI step: Label ConfigMap lab-config with app=lab via OCP Console
// Called from solve.yml via ansible.builtin.script
//
// Environment variables:
//   CONSOLE_URL   — OCP console URL
//   NAMESPACE     — student namespace
//   OCP_TOKEN     — bearer token
//   RESOURCE_NAME — configmap name (lab-config)
//   LABEL_KEY     — label key (app)
//   LABEL_VALUE   — label value (lab)

const { chromium } = require('playwright');

(async () => {
  const consoleUrl  = process.env.CONSOLE_URL;
  const namespace   = process.env.NAMESPACE || 'default';
  const token       = process.env.OCP_TOKEN || '';
  const resourceName = process.env.RESOURCE_NAME || 'lab-config';
  const labelKey    = process.env.LABEL_KEY || 'app';
  const labelValue  = process.env.LABEL_VALUE || 'lab';

  if (!consoleUrl) {
    console.error('FAILED: CONSOLE_URL is required');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const page = await context.newPage();

  try {
    // Navigate directly to the ConfigMap detail page
    const resourceUrl = `${consoleUrl}/k8s/ns/${namespace}/configmaps/${resourceName}`;
    await page.goto(resourceUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Handle SSO redirect if needed
    if (page.url().includes('sso') || page.url().includes('login')) {
      console.error('FAILED: Authentication required — token may be invalid or expired');
      process.exit(1);
    }

    // Open Actions menu
    const actionsBtn = page.locator('[data-test-id="actions-menu-button"], button:has-text("Actions")').first();
    await actionsBtn.waitFor({ state: 'visible', timeout: 15000 });
    await actionsBtn.click();

    // Click Edit labels
    await page.locator('button:has-text("Edit labels"), li:has-text("Edit labels")').first().click();
    await page.waitForSelector('[aria-label="Labels"], input[placeholder*="label"], [data-test="labels-input"]', { timeout: 10000 });

    // Add label
    const labelInput = page.locator('input[placeholder*="label"], [data-test="labels-input"], [aria-label="Labels"] input').first();
    await labelInput.fill(`${labelKey}=${labelValue}`);
    await page.keyboard.press('Enter');

    // Save
    await page.locator('button:has-text("Save"), [data-test="confirm-action"]').first().click();

    // Wait for success (toast or page reload)
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
