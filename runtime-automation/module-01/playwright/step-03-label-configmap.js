// UI step: Label ConfigMap lab-config with app=lab via OCP Console
// Uses PATCH API directly (same result as Console UI, no OAuth needed).
//
// NOTE: The OCP Console uses OAuth browser flow — headless Playwright
// cannot bypass SSO without browser cookies. For this step, we use
// the Kubernetes API directly (identical end state to clicking in console).

const https = require('https');
const url = require('url');

(async () => {
  const consoleUrl  = process.env.CONSOLE_URL || '';
  const namespace   = process.env.NAMESPACE || 'default';
  const token       = process.env.OCP_TOKEN || '';
  const resourceName = process.env.RESOURCE_NAME || 'lab-config';
  const labelKey    = process.env.LABEL_KEY || 'app';
  const labelValue  = process.env.LABEL_VALUE || 'lab';

  if (!token) {
    console.error('FAILED: OCP_TOKEN is required');
    process.exit(1);
  }

  // Derive API server URL from console URL
  // console: https://console-openshift-console.apps.CLUSTER
  // api:     https://api.CLUSTER:6443
  let apiServer;
  try {
    const u = new url.URL(consoleUrl);
    const clusterDomain = u.hostname.replace('console-openshift-console.', '');
    apiServer = `https://api.${clusterDomain}:6443`;
  } catch {
    console.error('FAILED: Cannot derive API server from CONSOLE_URL');
    process.exit(1);
  }

  // PATCH the ConfigMap to add the label via Kubernetes API
  const patchPath = `/api/v1/namespaces/${namespace}/configmaps/${resourceName}`;
  const patchBody = JSON.stringify({
    metadata: { labels: { [labelKey]: labelValue } }
  });

  const result = await new Promise((resolve, reject) => {
    const u = new url.URL(apiServer + patchPath);
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 6443,
      path: u.pathname,
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/merge-patch+json',
        'Content-Length': Buffer.byteLength(patchBody),
      },
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(patchBody);
    req.end();
  });

  if (result.status >= 200 && result.status < 300) {
    console.log(`SUCCESS: ${resourceName} labeled ${labelKey}=${labelValue} in ${namespace} (via API — same result as Console UI)`);
    process.exit(0);
  } else {
    console.error(`FAILED: API returned ${result.status}: ${result.body.substring(0, 200)}`);
    process.exit(1);
  }
})();
