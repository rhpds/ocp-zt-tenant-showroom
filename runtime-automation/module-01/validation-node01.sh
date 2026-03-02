#!/bin/bash
# =============================================================================
# Module 1 Validation — Pipeline Deployment
# Runs when student clicks Next / Validate.
# Checks that the student created the ConfigMap and Deployment.
# =============================================================================

STUDENT_NS="zt-test-$(oc whoami 2>/dev/null || echo ${LAB_USER:-student})"

echo "[validation][module-01] Checking namespace: ${STUDENT_NS}"

# Check ConfigMap
if ! oc get configmap zt-test-config -n "${STUDENT_NS}" &>/dev/null; then
  fail_validation - <<'EOF'
**ConfigMap not found.**

Create the ConfigMap in your namespace:
```
oc create configmap zt-test-config \
  --from-literal=env=test \
  -n NAMESPACE
```
EOF
fi

# Check Deployment
if ! oc get deployment zt-test-app -n "${STUDENT_NS}" &>/dev/null; then
  fail_validation - <<'EOF'
**Deployment zt-test-app not found.**

Create the deployment in your namespace:
```
oc create deployment zt-test-app \
  --image=registry.access.redhat.com/ubi9/nginx-122:latest \
  -n NAMESPACE
```
EOF
fi

# Check pod running
RUNNING=$(oc get pods -n "${STUDENT_NS}" \
  -l app=zt-test-app \
  --field-selector=status.phase=Running \
  --no-headers 2>/dev/null | wc -l)

if [ "${RUNNING}" -lt 1 ]; then
  fail_validation - <<'EOF'
**Deployment exists but pod is not Running yet.**

Check pod status:
```
oc get pods -n NAMESPACE -l app=zt-test-app
```
Wait for the pod to reach Running state, then click Validate again.
EOF
fi

echo "[validation][module-01] All checks passed"
