import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../..');

const launchSmokePath = path.join(projectRoot, 'scripts/tests/launch-smoke.sh');
const seoSmokePath = path.join(projectRoot, 'scripts/tests/seo-smoke.sh');
const goLiveGatePath = path.join(projectRoot, 'scripts/go-live-gate.sh');
const releaseChecklistPath = path.join(projectRoot, 'docs/deployment/release-checklist.md');
const launchValidationPath = path.join(projectRoot, 'docs/LAUNCH_VALIDATION_2026-03-08.md');

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

describe('Launch surface smoke harness', () => {
  it('defines a launch smoke script that covers the ERP and B2B release matrix', () => {
    expect(fs.existsSync(launchSmokePath)).toBe(true);

    const script = readFile(launchSmokePath);

    expect(script).toContain('health');
    expect(script).toContain('public settings policy');
    expect(script).toContain('b2b visibility policy');
    expect(script).toContain('erp login shell');
    expect(script).toContain('b2b storefront shell');
    expect(script).toContain('static asset correctness');
    expect(script).toContain('seo status/config parity');

    expect(script).toContain('scripts/tests/public-surface-smoke.sh');
    expect(script).toContain('launch gate keeps public settings policy and b2b visibility policy inline');
    expect(script).toContain('scripts/tests/seo-smoke.sh');
    expect(script).toContain('scripts/tests/bundle-budget-check.sh');
  });

  it('handles unreachable targets as clean smoke failures instead of temp-file crashes', () => {
    const script = readFile(launchSmokePath);

    expect(script).toContain("touch \"$body_file\" \"$headers_file\"");
    expect(script).toContain("|| printf '000'");
  });

  it('parses multi-line request responses without collapsing header and body paths', () => {
    const script = readFile(launchSmokePath);

    expect(script).toContain('mapfile -t');
  });

  it('treats sitemap config smoke as route presence and uses a python3-capable preview runtime', () => {
    const script = readFile(seoSmokePath);

    expect(script).toContain('command -v python3');
    expect(script).toContain('PYTHON_BIN');
    expect(script).toContain('sitemap config update route presence');
    expect(script).toContain("'200|401|403'");
  });

  it('validates production bootstrap assets and separates route checks from host-identity checks', () => {
    const script = readFile(launchSmokePath);

    expect(script).toContain('assert_body_matches');
    expect(script).toContain('erp login shell production bootstrap');
    expect(script).toContain('b2b storefront shell production bootstrap');
    expect(script).toContain('b2b dedicated host catalog shell');
    expect(script).toContain('b2b dedicated host login shell');
    expect(script).toContain('/assets/');
    expect(script).toContain('.js');
    expect(script).toContain('host identity');
    expect(script).not.toContain('/src/main.tsx');
  });

  it('asserts host split with explicit Host headers and keeps ledux.ro retail out of this SPA smoke', () => {
    const script = readFile(launchSmokePath);

    expect(script).toContain('--header "Host: $host_header"');
    expect(script).toContain('B2B_HOST_HEADER');
    expect(script).toContain('ERP_HOST_HEADER');
    expect(script).toContain('/catalog');
    expect(script).toContain('/login');
    expect(script).toContain('retail ledux.ro stays outside this SPA smoke');
  });

  it('asserts host-aware initial shell metadata differs between ERP and B2B host headers', () => {
    const script = readFile(launchSmokePath);

    expect(script).toContain('erp host shell metadata title');
    expect(script).toContain('erp host shell metadata canonical');
    expect(script).toContain('erp host shell metadata manifest');
    expect(script).toContain('erp host shell metadata favicon');
    expect(script).toContain('b2b host shell metadata title');
    expect(script).toContain('b2b host shell metadata canonical');
    expect(script).toContain('b2b host shell metadata manifest');
    expect(script).toContain('b2b host shell metadata favicon');
    expect(script).toContain('Ledux ERP');
    expect(script).toContain('Ledux B2B');
    expect(script).toContain('https://erp.ledux.ro/');
    expect(script).toContain('https://b2b.ledux.ro/');
    expect(script).toContain('/erp/manifest.webmanifest');
    expect(script).toContain('/b2b/manifest.webmanifest');
    expect(script).toContain('/erp/favicon.svg');
    expect(script).toContain('/b2b/favicon.svg');
  });

  it('configures nginx to choose a host-aware shell before React hydration', () => {
    const frontendNginxConfig = readFile(path.join(projectRoot, 'frontend/nginx.conf'));
    const infraNginxConfig = readFile(path.join(projectRoot, 'infrastructure/nginx/nginx.conf'));

    expect(frontendNginxConfig).toContain('map $host $shell_title');
    expect(frontendNginxConfig).toContain('b2b.ledux.ro');
    expect(frontendNginxConfig).toContain('sub_filter_once off');
    expect(frontendNginxConfig).toContain('__LEDUX_TITLE__');
    expect(frontendNginxConfig).toContain('__LEDUX_CANONICAL__');
    expect(frontendNginxConfig).toContain('__LEDUX_MANIFEST__');
    expect(frontendNginxConfig).toContain('__LEDUX_FAVICON__');

    expect(infraNginxConfig).toContain('map $host $shell_title');
    expect(infraNginxConfig).toContain('__LEDUX_TITLE__');
    expect(infraNginxConfig).toContain('__LEDUX_CANONICAL__');
  });

  it('treats manifest smoke as production asset validation instead of requiring dev-server mime types', () => {
    const script = readFile(launchSmokePath);

    expect(script).toContain('application/octet-stream');
    expect(script).toContain('static asset correctness erp manifest body');
    expect(script).toContain('static asset correctness b2b manifest body');
  });

  it('makes the go-live gate run the launch smoke suite before final go/no-go', () => {
    const gateScript = readFile(goLiveGatePath);

    expect(gateScript).toContain('Launch Smoke');
    expect(gateScript).toContain('tests/launch-smoke.sh');
    expect(gateScript).toContain('bash "$SCRIPT_DIR/tests/launch-smoke.sh"');
  });

  it('makes the go-live gate resolve service containers instead of relying on fixed compose names', () => {
    const gateScript = readFile(goLiveGatePath);

    expect(gateScript).toContain('resolve_container_name()');
    expect(gateScript).toContain('docker ps -a --filter');
    expect(gateScript).toContain('com.docker.compose.service');
    expect(gateScript).toContain('APP_CONTAINER="$(resolve_container_name');
    expect(gateScript).toContain('FRONTEND_CONTAINER="$(resolve_container_name');
    expect(gateScript).toContain('DB_CONTAINER="$(resolve_container_name');
    expect(gateScript).toContain('REDIS_CONTAINER="$(resolve_container_name');
    expect(gateScript).toContain('RABBITMQ_CONTAINER="$(resolve_container_name');
    expect(gateScript).not.toContain('for svc in cypher-erp-frontend-1 "$APP_CONTAINER" "$REDIS_CONTAINER" cypher-erp-db cypher-rabbitmq; do');
  });

  it('documents the one-command launch gate in the release checklist', () => {
    const checklist = readFile(releaseChecklistPath);

    expect(checklist).toContain('launch-smoke.sh');
    expect(checklist).toContain('go-live-gate.sh');
    expect(checklist).toContain('ERP login shell');
    expect(checklist).toContain('B2B storefront shell');
    expect(checklist).toContain('SEO status/config parity');
  });

  it('records the launch smoke and gate policy in the launch validation log', () => {
    const validationDoc = readFile(launchValidationPath);

    expect(validationDoc).toContain('Launch smoke and gate policy');
    expect(validationDoc).toContain('scripts/tests/launch-smoke.sh');
    expect(validationDoc).toContain('scripts/go-live-gate.sh');
  });

  it('keeps checkout/configurators/hr/marketing launch routes visible in the app shell and nav', () => {
    const appSource = readFile(path.join(projectRoot, 'frontend/src/App.tsx'));
    const sidebarSource = readFile(path.join(projectRoot, 'frontend/src/components/layout/Sidebar.tsx'));

    expect(appSource).toContain('path="checkout"');
    expect(appSource).toContain('path="configurators/*"');
    expect(appSource).toContain('path="hr/*"');
    expect(appSource).toContain('path="marketing/*"');

    expect(sidebarSource).toContain("href: '/configurators'");
    expect(sidebarSource).toContain("href: '/hr'");
    expect(sidebarSource).toContain("href: '/marketing'");
  });
});
