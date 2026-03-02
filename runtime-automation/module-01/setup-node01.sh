#!/bin/bash
# =============================================================================
# Module 1 Setup — Pipeline Deployment
# Runs automatically when student navigates to module 1.
# Creates the student namespace and pre-configures it for the exercises.
# =============================================================================

set -e

STUDENT_NS="zt-test-$(oc whoami 2>/dev/null || echo ${LAB_USER:-student})"

echo "[setup][module-01] Setting up namespace: ${STUDENT_NS}"

# Create namespace if it doesn't exist
oc get namespace "${STUDENT_NS}" &>/dev/null || \
  oc new-project "${STUDENT_NS}" --description="ZT test namespace for $(oc whoami)"

# Label it
oc label namespace "${STUDENT_NS}" lab=zt-test --overwrite

echo "[setup][module-01] Namespace ${STUDENT_NS} ready"
