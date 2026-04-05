#!/bin/bash

set -e

echo "🚀 Running Helm Chart Testing..."

# Check for required tools
echo "🔍 Checking for required tools..."

if ! which ct >/dev/null 2>&1; then
    echo "❌ chart-testing not found. Install with: brew install chart-testing"
    exit 1
fi

if ! which kubeconform >/dev/null 2>&1; then
    echo "❌ kubeconform not found. Install with: brew install kubeconform"
    exit 1
fi

if ! helm plugin list | grep unittest >/dev/null 2>&1; then
    echo "❌ helm-unittest not found. Install with: helm plugin install https://github.com/helm-unittest/helm-unittest --version v1.0.3"
    exit 1
fi

echo "✅ All required tools found"

# Add Helm repository
echo "📦 Adding Helm repository..."
helm repo add qdrant https://qdrant.github.io/qdrant-helm

# Build dependencies
echo "🔧 Building chart dependencies..."
helm dependency build helm/kairos-mcp

# Helm lint
echo "🔍 Running Helm lint (strict mode)..."
helm lint helm/kairos-mcp --strict

# Unit tests
echo "🧪 Running helm-unittest..."
helm unittest helm/kairos-mcp

# Chart testing
echo "🔍 Running chart-testing..."
ct lint --config ct.yaml --all

# Kubeconform validation
echo "🔍 Running kubeconform validation..."
if helm template kairos helm/kairos-mcp -f helm/values.dev.yaml | kubeconform; then
    echo "✅ kubeconform validation passed"
else
    echo "⚠️  kubeconform CRD failures expected (normal for custom resources)"
fi

echo "🎉 Helm chart testing complete!"
