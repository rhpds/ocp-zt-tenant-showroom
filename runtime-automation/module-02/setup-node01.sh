#!/bin/bash
# =============================================================================
# Module 2 Setup — Compliance Label
# Runs automatically when student navigates to module 2.
# Ensures the namespace from module 1 still exists and is properly labeled.
# =============================================================================

set -e

STUDENT_NS="zt-test-$(oc whoami 2>/dev/null || echo ${LAB_USER:-student})"

echo "[setup][module-02] Checking namespace: ${STUDENT_NS}"

# Ensure namespace still exists (module 1 should have created it)
oc get namespace "${STUDENT_NS}" &>/dev/null || \
  oc new-project "${STUDENT_NS}" --description="ZT test namespace for $(oc whoami)"

# Ensure module-01 resources exist so module-02 has a valid baseline
oc get configmap zt-test-config -n "${STUDENT_NS}" &>/dev/null || \
  oc create configmap zt-test-config --from-literal=env=test -n "${STUDENT_NS}"

oc get deployment zt-test-app -n "${STUDENT_NS}" &>/dev/null || \
  oc create deployment zt-test-app \
    --image=registry.access.redhat.com/ubi9/nginx-122:latest \
    -n "${STUDENT_NS}"

echo "[setup][module-02] Namespace ${STUDENT_NS} ready for compliance exercise"
