// UI step: Label ConfigMap lab-config with app=lab via OCP Console
// Called from solve.yml via ansible.builtin.script
//
// Auth approach: exchange Bearer token for an OAuth session via the
// OCP authorize endpoint (not browser flow), inject into browser context.
//
// Environment variables:
//   CONSOLE_URL   — OCP console URL
//   NAMESPACE     — student namespace
//   OCP_TOKEN     — bearer token (from oc whoami -t)
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

  if (!token) {
    console.error('FAILED: OCP_TOKEN is required');
    process.exit(1);
  }

  // Extract OAuth server base URL from console URL
  // console: https://console-openshift-console.apps.cluster.example.com
  // oauth:   https://oauth-openshift.apps.cluster.example.com
  const oauthBase = consoleUrl.replace('console-openshift-console', 'oauth-openshift');
  const consoleCallback = `${consoleUrl}/auth/callback`;
  const authorizeUrl = `${oauthBase}/oauth/authorize?client_id=console` +
    `&redirect_uri=${encodeURIComponent(consoleCallback)}` +
    `&response_type=token&scope=user%3Afull`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });

  try {
    // Step 1: Exchange Bearer token for a console OAuth access token
    // Use playwright's request context (not browser) to follow OAuth redirect
    const apiRequest = await context.request.get(authorizeUrl, {
      headers: { Authorization: `Bearer ${token}` },
      maxRedirects: 10,
    });

    // The final URL after redirects contains #access_token=<token>
    const finalUrl = apiRequest.url();
    const hashMatch = finalUrl.match(/[#&]access_token=([^&]+)/);
    let consoleToken = token; // fallback to original token

    if (hashMatch) {
      consoleToken = decodeURIComponent(hashMatch[1]);
    }

    // Step 2: Open the console page, inject token into localStorage before it loads
    const page = await context.newPage();

    // Intercept navigation to inject token
    await page.addInitScript((t) => {
      localStorage.setItem('bridge/token', t);
      localStorage.setItem('bridge/token-expiry', (Date.now() + 86400000).toString());
    }, consoleToken);

    // Navigate directly to the ConfigMap resource page
    const resourceUrl = `${consoleUrl}/k8s/ns/${namespace}/configmaps/${resourceName}`;
    await page.goto(resourceUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for the Actions button to appear (means page loaded successfully)
    const actionsBtn = page.locator(
      '[data-test-id="actions-menu-button"], button:has-text("Actions")'
    ).first();
    await actionsBtn.waitFor({ state: 'visible', timeout: 20000 });
    await actionsBtn.click();

    // Click Edit labels
    await page.locator(
      'button:has-text("Edit labels"), li:has-text("Edit labels")'
    ).first().click();

    // Wait for label dialog
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
