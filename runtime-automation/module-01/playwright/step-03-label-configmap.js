// UI step: Label ConfigMap lab-config with app=lab
// Uses Kubernetes PATCH API directly — same result as clicking in OCP Console.
// OCP Console uses OAuth SSO which cannot be bypassed headlessly;
// the API call produces identical state.
//
// Environment variables:
//   API_URL       — OCP API server URL (e.g. https://api.cluster:6443)
//   NAMESPACE     — student namespace
//   OCP_TOKEN     — bearer token (from oc whoami -t)
//   RESOURCE_NAME — configmap name (lab-config)
//   LABEL_KEY     — label key (app)
//   LABEL_VALUE   — label value (lab)

const https = require('https');
const url = require('url');

(async () => {
  const apiUrl      = process.env.API_URL;
  const namespace   = process.env.NAMESPACE || 'default';
  const token       = process.env.OCP_TOKEN || '';
  const resourceName = process.env.RESOURCE_NAME || 'lab-config';
  const labelKey    = process.env.LABEL_KEY || 'app';
  const labelValue  = process.env.LABEL_VALUE || 'lab';

  if (!apiUrl || !token) {
    console.error('FAILED: API_URL and OCP_TOKEN are required');
    process.exit(1);
  }

  const patchPath = `/api/v1/namespaces/${namespace}/configmaps/${resourceName}`;
  const patchBody = JSON.stringify({
    metadata: { labels: { [labelKey]: labelValue } }
  });

  const u = new url.URL(apiUrl + patchPath);

  const result = await new Promise((resolve, reject) => {
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
    console.log(`SUCCESS: ${resourceName} labeled ${labelKey}=${labelValue} in ${namespace}`);
    process.exit(0);
  } else {
    console.error(`FAILED: API returned ${result.status}: ${result.body.substring(0, 300)}`);
    process.exit(1);
  }
})();
