# MCP Manus Server - Kubernetes Deployment

This directory contains comprehensive Kubernetes manifests for deploying the MCP Manus Server following 2025 best practices for container orchestration, security, and scalability.

## 🏗️ Architecture Overview

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Ingress     │───▶│     Service     │───▶│   Deployment    │
│  (TLS + CORS)   │    │ (Load Balance)  │    │  (3 Replicas)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ NetworkPolicy   │    │       HPA       │    │ ServiceMonitor  │
│  (Security)     │    │  (Auto-scale)   │    │ (Prometheus)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Manifest Files

| File | Description | Purpose |
|------|-------------|---------|
| `namespace.yaml` | Namespace definition | Resource isolation |
| `configmap.yaml` | Configuration data | Environment-specific configs |
| `secrets.yaml` | Sensitive data templates | Credential management |
| `deployment.yaml` | Application deployment | Pod specifications |
| `service.yaml` | Service definitions | Traffic routing |
| `ingress.yaml` | External access | SSL termination, routing |
| `hpa.yaml` | Horizontal Pod Autoscaler | Auto-scaling rules |
| `rbac.yaml` | RBAC permissions | Security policies |
| `network-policy.yaml` | Network security | Traffic restrictions |
| `servicemonitor.yaml` | Prometheus monitoring | Metrics collection |
| `pdb.yaml` | Pod Disruption Budget | Availability guarantees |

## 🚀 Quick Deployment

### Prerequisites

```bash
# Ensure kubectl is configured
kubectl cluster-info

# Create namespace first
kubectl apply -f namespace.yaml
```

### 1. Development Deployment

```bash
# Deploy development environment
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f rbac.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Check deployment status
kubectl get pods -n mcp-manus -l environment=development
```

### 2. Staging Deployment

```bash
# Update secrets for staging
kubectl apply -f secrets.yaml

# Deploy staging environment
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml

# Verify staging deployment
kubectl get all -n mcp-manus -l environment=staging
```

### 3. Production Deployment

```bash
# Complete production deployment
kubectl apply -f .

# Verify all components
kubectl get all,secrets,configmaps,networkpolicies -n mcp-manus

# Check HPA status
kubectl get hpa -n mcp-manus

# Verify ingress
kubectl get ingress -n mcp-manus
```

## 🔧 Configuration

### Environment-Specific Secrets

Before deployment, update the secrets with actual values:

```bash
# Production secrets
kubectl create secret generic mcp-manus-secrets \
  --from-literal=JWT_SECRET="your-production-jwt-secret-32-chars" \
  --from-literal=OAUTH_CLIENT_SECRET="your-oauth-client-secret" \
  --from-literal=OAUTH_CLIENT_ID="your-oauth-client-id" \
  --from-literal=MANUS_API_KEY="your-manus-api-key" \
  --namespace=mcp-manus

# Staging secrets
kubectl create secret generic mcp-manus-secrets-staging \
  --from-literal=JWT_SECRET="staging-jwt-secret-32-chars" \
  --from-literal=OAUTH_CLIENT_SECRET="staging-oauth-secret" \
  --namespace=mcp-manus
```

### ConfigMap Updates

```bash
# Update production configuration
kubectl patch configmap mcp-manus-config -n mcp-manus \
  --patch='{"data":{"BASE_URL":"https://your-domain.com"}}'

# Update CORS origins
kubectl patch configmap mcp-manus-config -n mcp-manus \
  --patch='{"data":{"CORS_ORIGIN":"https://your-frontend.com"}}'
```

### Ingress Configuration

Update ingress with your domain:

```yaml
# In ingress.yaml
spec:
  rules:
  - host: your-domain.com  # Replace with actual domain
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mcp-manus-server
            port:
              number: 80
```

## 📊 Monitoring & Observability

### Prometheus Integration

The deployment includes:
- **ServiceMonitor**: Automatic metrics discovery
- **PrometheusRule**: Custom alerting rules
- **SLO monitoring**: Availability and response time tracking

### Health Checks

Three types of health checks:
1. **Liveness Probe**: `/health` - Pod restart trigger
2. **Readiness Probe**: `/ready` - Traffic routing control
3. **Startup Probe**: `/health` - Initial startup validation

### Logging

Kubernetes logging integration:
- **Structured logs**: JSON format for log aggregation
- **Log annotations**: Elastic search configuration
- **Correlation IDs**: Request tracing across pods

## ⚡ Scaling Configuration

### Horizontal Pod Autoscaler

**Production Scaling**:
- **Min replicas**: 3 (high availability)
- **Max replicas**: 10 (burst capacity)
- **CPU target**: 70% utilization
- **Memory target**: 80% utilization
- **Custom metrics**: Request rate, connection count

**Staging Scaling**:
- **Min replicas**: 1 (cost optimization)
- **Max replicas**: 3 (limited scaling)
- **Higher thresholds**: 80% CPU, 85% memory

### Vertical Scaling

**Resource Requests/Limits**:
```yaml
resources:
  requests:
    memory: "256Mi"  # Minimum guaranteed
    cpu: "100m"      # 0.1 CPU core
  limits:
    memory: "512Mi"  # Maximum allowed
    cpu: "500m"      # 0.5 CPU core
```

## 🔒 Security Configuration

### Pod Security

**Security Context**:
- **Non-root execution**: `runAsUser: 1000`
- **Read-only filesystem**: `readOnlyRootFilesystem: true`
- **No privilege escalation**: `allowPrivilegeEscalation: false`
- **Drop all capabilities**: `capabilities.drop: ALL`

### Network Security

**Network Policies**:
- **Default deny**: Block all traffic by default
- **Selective allow**: Only required connections
- **Ingress filtering**: NGINX + rate limiting
- **Egress control**: External API access only

### RBAC Configuration

**Service Account Permissions**:
- **ConfigMap read**: Configuration access
- **Secret read**: Credential access
- **Pod read**: Self-discovery
- **Event create**: Audit logging

## 🚀 Production Deployment Guide

### 1. Pre-deployment Checklist

```bash
# Verify cluster readiness
kubectl get nodes
kubectl get storageclass

# Check NGINX Ingress Controller
kubectl get pods -n ingress-nginx

# Verify Prometheus Operator (if using)
kubectl get pods -n monitoring
```

### 2. Secrets Management

```bash
# Create production secrets (use external secret management)
kubectl create secret generic mcp-manus-secrets \
  --from-env-file=production.env \
  --namespace=mcp-manus

# Verify secrets
kubectl get secrets -n mcp-manus
```

### 3. Certificate Management

```bash
# If using cert-manager
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: mcp-manus-tls
  namespace: mcp-manus
spec:
  secretName: mcp-manus-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - mcp-manus.example.com
EOF
```

### 4. Deploy Application

```bash
# Deploy in order
kubectl apply -f namespace.yaml
kubectl apply -f rbac.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
kubectl apply -f hpa.yaml
kubectl apply -f network-policy.yaml
kubectl apply -f servicemonitor.yaml
kubectl apply -f pdb.yaml

# Verify deployment
kubectl rollout status deployment/mcp-manus-server -n mcp-manus
```

### 5. Post-deployment Validation

```bash
# Check all resources
kubectl get all -n mcp-manus

# Test endpoints
curl -k https://mcp-manus.example.com/health
curl -k https://mcp-manus.example.com/ready
curl -k https://mcp-manus.example.com/metrics

# Check logs
kubectl logs -f deployment/mcp-manus-server -n mcp-manus

# Verify HPA
kubectl get hpa -n mcp-manus -w
```

## 🔄 Management Operations

### Rolling Updates

```bash
# Update image
kubectl set image deployment/mcp-manus-server \
  mcp-manus-server=mcp-manus-server:v1.1.0 \
  -n mcp-manus

# Monitor rollout
kubectl rollout status deployment/mcp-manus-server -n mcp-manus

# Rollback if needed
kubectl rollout undo deployment/mcp-manus-server -n mcp-manus
```

### Scaling Operations

```bash
# Manual scaling
kubectl scale deployment mcp-manus-server --replicas=5 -n mcp-manus

# Update HPA
kubectl patch hpa mcp-manus-server -n mcp-manus \
  --patch='{"spec":{"maxReplicas":15}}'
```

### Configuration Updates

```bash
# Update ConfigMap
kubectl patch configmap mcp-manus-config -n mcp-manus \
  --patch='{"data":{"LOG_LEVEL":"debug"}}'

# Restart deployment to pick up changes
kubectl rollout restart deployment/mcp-manus-server -n mcp-manus
```

## 🔍 Troubleshooting

### Common Issues

#### Pods Not Starting
```bash
# Check pod status
kubectl describe pod -l app.kubernetes.io/name=mcp-manus-server -n mcp-manus

# Check events
kubectl get events -n mcp-manus --sort-by='.lastTimestamp'

# Check resource usage
kubectl top pods -n mcp-manus
```

#### Service Discovery Issues
```bash
# Check service endpoints
kubectl get endpoints -n mcp-manus

# Test service connectivity
kubectl run test-pod --image=curlimages/curl -i --rm -- \
  curl http://mcp-manus-server.mcp-manus.svc.cluster.local/health
```

#### Ingress Issues
```bash
# Check ingress status
kubectl describe ingress mcp-manus-server -n mcp-manus

# Check NGINX controller logs
kubectl logs -f deployment/ingress-nginx-controller -n ingress-nginx

# Test SSL certificate
openssl s_client -connect mcp-manus.example.com:443 -servername mcp-manus.example.com
```

#### HPA Not Scaling
```bash
# Check HPA status
kubectl describe hpa mcp-manus-server -n mcp-manus

# Verify metrics server
kubectl get pods -n kube-system -l k8s-app=metrics-server

# Check custom metrics (if using)
kubectl get --raw "/apis/custom.metrics.k8s.io/v1beta1" | jq .
```

### Monitoring Commands

```bash
# Real-time pod monitoring
watch kubectl get pods -n mcp-manus

# Resource usage monitoring
watch kubectl top pods -n mcp-manus

# Event monitoring
kubectl get events -n mcp-manus -w

# Log streaming
kubectl logs -f deployment/mcp-manus-server -n mcp-manus --all-containers=true
```

## 🛡️ Security Best Practices

### Secret Management
- **External secrets**: Use tools like External Secrets Operator
- **Secret rotation**: Implement automated rotation
- **Least privilege**: Minimal RBAC permissions
- **Encryption**: Enable etcd encryption at rest

### Network Security
- **Network policies**: Enforce micro-segmentation
- **TLS everywhere**: End-to-end encryption
- **Ingress filtering**: WAF-like protections
- **Private registries**: Secure container images

### Compliance
- **Pod Security Standards**: Enforce restricted policies
- **Admission controllers**: Validate resource policies
- **Audit logging**: Complete audit trail
- **Vulnerability scanning**: Regular container scanning

This Kubernetes deployment provides enterprise-grade orchestration for the MCP Manus Server with high availability, security, and observability built-in.