// UI step: Label ConfigMap lab-config with app=lab
// Uses oc CLI with k8s_kubeconfig — same result as clicking in OCP Console.
//
// Environment variables:
//   KUBECONFIG    — path to kubeconfig file (k8s_kubeconfig extravar)
//   NAMESPACE     — student namespace
//   RESOURCE_NAME — configmap name (lab-config)
//   LABEL_KEY     — label key (app)
//   LABEL_VALUE   — label value (lab)

const { execSync } = require('child_process');

try {
  const ns     = process.env.NAMESPACE || 'default';
  const name   = process.env.RESOURCE_NAME || 'lab-config';
  const key    = process.env.LABEL_KEY || 'app';
  const value  = process.env.LABEL_VALUE || 'lab';
  const kube   = process.env.KUBECONFIG || '';

  const kubeFlag = kube ? `--kubeconfig=${kube}` : '';
  const cmd = `oc label configmap ${name} ${key}=${value} -n ${ns} ${kubeFlag} --overwrite --insecure-skip-tls-verify 2>&1`;

  const output = execSync(cmd, { encoding: 'utf8' });
  console.log(`SUCCESS: ${name} labeled ${key}=${value} in ${ns}`);
  console.log(output.trim());
  process.exit(0);
} catch (err) {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
}
