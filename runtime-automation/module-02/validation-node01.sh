#!/bin/bash
# Module 2 Validation — Compliance and Security
STUDENT_NS="zt-test-$(oc whoami 2>/dev/null || echo ${LAB_USER:-student})"

echo "[validation][module-02] Checking compliance label on namespace: ${STUDENT_NS}"

LABEL=$(oc get namespace "${STUDENT_NS}" \
  -o jsonpath='{.metadata.labels.compliance}' 2>/dev/null)

if [ "${LABEL}" != "passed" ]; then
  fail_validation - <<'EOF'
**Compliance label not set on namespace.**

Apply the compliance label:
```
oc label namespace NAMESPACE compliance=passed --overwrite
```
EOF
fi

echo "[validation][module-02] Compliance check passed"
