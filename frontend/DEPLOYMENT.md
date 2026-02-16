# CYPHER ERP Frontend - Deployment Guide

## Development Environment Setup

### Prerequisites
- Node.js 16+ and npm 8+
- Modern code editor (VS Code recommended)

### Initial Setup
```bash
# Clone/navigate to project
cd /path/to/cypher/frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Configure API endpoint
# Edit .env and set VITE_API_URL=http://your-api:8000/api/v1
```

### Development Server
```bash
npm run dev
```
Application runs at `http://localhost:3000`

## Build & Deployment

### Production Build
```bash
npm run build
```
Creates optimized `dist/` folder ready for deployment.

### Build Preview
```bash
npm run preview
```
Serves production build locally for testing.

### Docker Deployment

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

Build and run:
```bash
docker build -t cypher-erp-frontend .
docker run -p 3000:3000 \
  -e VITE_API_URL=http://api:8000/api/v1 \
  cypher-erp-frontend
```

### Nginx Configuration

Create `nginx.conf`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()";
}
```

### Environment Variables

**Development** (.env.local):
```
VITE_API_URL=http://localhost:8000/api/v1
VITE_APP_NAME=CYPHER ERP
VITE_APP_VERSION=1.0.0
```

**Production** (.env.production):
```
VITE_API_URL=https://api.yourdomain.com/api/v1
VITE_APP_NAME=CYPHER ERP
VITE_APP_VERSION=1.0.0
```

### Performance Optimization

1. **Bundle Analysis**
```bash
npm install --save-dev rollup-plugin-visualizer
# Add to vite.config.ts for analysis
```

2. **Code Splitting**
- Routes are already optimized
- Lazy load components for large features

3. **Caching**
- Set proper cache headers in web server
- Browser cache for static assets

4. **Monitoring**
- Setup error tracking (Sentry, LogRocket)
- Monitor API performance
- Track user interactions

## Testing

### Unit Tests
```bash
npm install --save-dev vitest @testing-library/react
```

### E2E Tests
```bash
npm install --save-dev playwright
```

## CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy Frontend

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run type check
        run: npm run type-check
      
      - name: Run lint
        run: npm run lint
      
      - name: Build
        run: npm run build
      
      - name: Deploy to production
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        run: |
          # Your deployment script here
```

## Security Checklist

- [ ] HTTPS enabled in production
- [ ] CORS properly configured on backend
- [ ] Content Security Policy headers set
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented
- [ ] API keys not hardcoded
- [ ] Environment secrets in CI/CD
- [ ] Regular dependency updates
- [ ] Security headers configured
- [ ] Input validation on all forms
- [ ] Error messages don't leak sensitive data

## Monitoring & Logging

### Error Tracking
```typescript
// Example: Sentry integration
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});
```

### Performance Monitoring
- Monitor API response times
- Track component render times
- Monitor bundle size
- Track user interactions

### Logging
```typescript
// Centralized logging
const logger = {
  info: (msg: string, data?: any) => console.log(msg, data),
  error: (msg: string, error?: Error) => console.error(msg, error),
  warn: (msg: string, data?: any) => console.warn(msg, data),
};
```

## Troubleshooting

### Build Failures
1. Clear node_modules and reinstall
```bash
rm -rf node_modules package-lock.json
npm install
```

2. Check TypeScript errors
```bash
npm run type-check
```

3. Check linting
```bash
npm run lint
```

### Runtime Errors
1. Check browser console for errors
2. Check network tab for API failures
3. Verify API endpoint in .env
4. Check API CORS configuration

### Performance Issues
1. Use DevTools Performance tab
2. Analyze bundle with `npm run build --analyze`
3. Check API response times
4. Profile with React DevTools

## Maintenance

### Regular Tasks
- Update dependencies monthly
```bash
npm update
npm audit fix
```

- Monitor error logs
- Review performance metrics
- Update documentation

### Version Management
- Use semantic versioning
- Tag releases in git
- Maintain changelog

## Rollback Procedure

1. Identify issue in production
2. Revert to previous version
```bash
git revert <commit-hash>
npm run build
```
3. Deploy reverted version
4. Investigate issue in staging
5. Fix and redeploy

## Support & Documentation

- Component guide: `COMPONENTS.md`
- Architecture: `ARCHITECTURE.md`
- API services: `README.md`
- Quick reference: `QUICK_REFERENCE.md`

## Useful Commands

```bash
# Development
npm run dev          # Start dev server

# Building
npm run build        # Build for production
npm run preview      # Preview production build

# Code Quality
npm run type-check   # TypeScript check
npm run lint        # ESLint check

# Utilities
npm install         # Install dependencies
npm update          # Update dependencies
npm audit           # Security audit
npm audit fix       # Fix vulnerabilities
```

## Support Contacts

For issues or questions:
- Frontend Issues: Check COMPONENTS.md and README.md
- API Integration: Refer to services documentation
- Deployment Help: See Docker section above
- Performance: Check monitoring tools

---

Last Updated: 2024
