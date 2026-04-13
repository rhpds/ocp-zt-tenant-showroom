// UI step: Create Deployment via OCP Console Developer perspective
// Called from solve.yml via ansible.builtin.script
//
// Environment variables:
//   CONSOLE_URL   — OCP console URL
//   NAMESPACE     — student namespace
//   OCP_TOKEN     — bearer token
//   APP_NAME      — application name (lab-app)
//   DEPLOY_NAME   — deployment name (lab-deploy)
//   IMAGE         — container image

const { chromium } = require('playwright');

(async () => {
  const consoleUrl = process.env.CONSOLE_URL;
  const namespace  = process.env.NAMESPACE || 'default';
  const token      = process.env.OCP_TOKEN || '';
  const appName    = process.env.APP_NAME || 'lab-app';
  const deployName = process.env.DEPLOY_NAME || 'lab-deploy';
  const image      = process.env.IMAGE || 'registry.access.redhat.com/ubi9/nginx-120';

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
    // Navigate to Developer perspective +Add
    await page.goto(`${consoleUrl}/add/ns/${namespace}`, { waitUntil: 'networkidle', timeout: 30000 });

    if (page.url().includes('sso') || page.url().includes('login')) {
      console.error('FAILED: Authentication required');
      process.exit(1);
    }

    // Click Container images tile
    await page.locator('text=Container images, [data-test~="container-image"]').first().click();
    await page.waitForURL(`**/import*`, { timeout: 10000 });

    // Fill image field
    const imageInput = page.locator('input[id="image-name"], input[placeholder*="image"], input[name*="image"]').first();
    await imageInput.waitFor({ state: 'visible', timeout: 10000 });
    await imageInput.fill(image);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000); // wait for image validation

    // Set Application name
    const appInput = page.locator('input[id*="application"], input[name*="application"]').first();
    if (await appInput.count() > 0) {
      await appInput.fill(appName);
    }

    // Set Name (deployment name)
    const nameInput = page.locator('input[id="name"], input[name="name"]').first();
    if (await nameInput.count() > 0) {
      await nameInput.fill(deployName);
    }

    // Click Create
    await page.locator('button:has-text("Create"), button[type="submit"]:has-text("Create")').first().click();
    await page.waitForURL(`**/${deployName}**`, { timeout: 20000 });

    console.log(`SUCCESS: Deployment ${deployName} created in ${namespace}`);
    process.exit(0);
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
