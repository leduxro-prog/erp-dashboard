# Host Nginx Cutover Rollback

Use this when host Nginx has already been switched to proxy traffic through the k8s ingress NodePort (`https://127.0.0.1:31013`) and you need to roll back quickly.

## 1) Restore host vhost configs from backup

```bash
cp /root/nginx-backups/erp.ledux.ro.bak-20260224 /etc/nginx/sites-enabled/erp.ledux.ro
cp /root/nginx-backups/b2b.ledux.ro.bak-20260224 /etc/nginx/sites-enabled/b2b.ledux.ro
nginx -t && systemctl reload nginx
```

If backup files are not present, set `proxy_pass` back to the previous target (`http://127.0.0.1:8080`) in both files and reload Nginx.

## 2) Validate public routes after rollback

```bash
curl -fsS https://erp.ledux.ro/health
curl -fsS https://erp.ledux.ro/api/v1/health
curl -fsS -I https://b2b.ledux.ro/
```

## 3) Optional: disable ingress controller exposure

If you also want to stop ingress entry traffic during rollback:

```bash
kubectl -n ingress-nginx scale deployment ingress-nginx-controller --replicas=0
```

Re-enable later:

```bash
kubectl -n ingress-nginx scale deployment ingress-nginx-controller --replicas=1
kubectl rollout status deployment/ingress-nginx-controller -n ingress-nginx --timeout=180s
```
