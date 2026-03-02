#!/bin/bash
# Module 2 Solve — Compliance and Security
set -e
STUDENT_NS="zt-test-$(oc whoami 2>/dev/null || echo ${LAB_USER:-student})"
echo "[solve][module-02] Applying compliance label to ${STUDENT_NS}"
oc label namespace "${STUDENT_NS}" compliance=passed --overwrite
echo "[solve][module-02] Done"
