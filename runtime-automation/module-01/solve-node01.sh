#!/bin/bash
# =============================================================================
# Module 1 Solve — Pipeline Deployment
# Runs when student clicks Solve or Skip.
# Creates everything the student should have done in module 1.
# =============================================================================

set -e

STUDENT_NS="zt-test-$(oc whoami 2>/dev/null || echo ${LAB_USER:-student})"

echo "[solve][module-01] Solving module 1 for namespace: ${STUDENT_NS}"

# Ensure namespace exists
oc get namespace "${STUDENT_NS}" &>/dev/null || \
  oc new-project "${STUDENT_NS}"

# Create ConfigMap (idempotent)
oc apply -n "${STUDENT_NS}" -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: zt-test-config
  labels:
    lab: zt-test
data:
  env: test
  solved-by: zerotouch-automation
EOF

# Create Deployment (idempotent)
oc apply -n "${STUDENT_NS}" -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zt-test-app
  labels:
    lab: zt-test
spec:
  replicas: 1
  selector:
    matchLabels:
      app: zt-test-app
  template:
    metadata:
      labels:
        app: zt-test-app
    spec:
      containers:
        - name: app
          image: registry.access.redhat.com/ubi9/nginx-122:latest
          ports:
            - containerPort: 8080
EOF

# Wait for pod
echo "[solve][module-01] Waiting for pod to be Running..."
oc rollout status deployment/zt-test-app -n "${STUDENT_NS}" --timeout=120s

echo "[solve][module-01] Module 1 solved successfully"
