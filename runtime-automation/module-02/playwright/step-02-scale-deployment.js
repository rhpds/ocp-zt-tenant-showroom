// UI step: Scale Deployment to N replicas via OCP Console
// Called from solve.yml via ansible.builtin.script
//
// Environment variables:
//   CONSOLE_URL   — OCP console URL
//   NAMESPACE     — student namespace
//   OCP_TOKEN     — bearer token
//   DEPLOY_NAME   — deployment name (lab-deploy)
//   REPLICAS      — number of replicas (2)

const { chromium } = require('playwright');

(async () => {
  const consoleUrl = process.env.CONSOLE_URL;
  const namespace  = process.env.NAMESPACE || 'default';
  const token      = process.env.OCP_TOKEN || '';
  const deployName = process.env.DEPLOY_NAME || 'lab-deploy';
  const replicas   = process.env.REPLICAS || '2';

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
    // Navigate to Deployment detail page
    const url = `${consoleUrl}/k8s/ns/${namespace}/deployments/${deployName}`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    if (page.url().includes('sso') || page.url().includes('login')) {
      console.error('FAILED: Authentication required');
      process.exit(1);
    }

    // Open Actions menu
    const actionsBtn = page.locator('[data-test-id="actions-menu-button"], button:has-text("Actions")').first();
    await actionsBtn.waitFor({ state: 'visible', timeout: 15000 });
    await actionsBtn.click();

    // Click Edit Pod count
    await page.locator('button:has-text("Edit Pod count"), li:has-text("Edit Pod count")').first().click();

    // Wait for dialog
    await page.waitForSelector('[aria-label*="Pod count"], input[id*="replica"], input[type="number"]', { timeout: 10000 });

    // Set replicas
    const replicaInput = page.locator('input[id*="replica"], input[aria-label*="replica"], input[type="number"]').first();
    await replicaInput.fill(replicas);

    // Save
    await page.locator('button:has-text("Save"), [data-test="confirm-action"]').first().click();
    await page.waitForTimeout(2000);

    console.log(`SUCCESS: Deployment ${deployName} scaled to ${replicas} replicas in ${namespace}`);
    process.exit(0);
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
