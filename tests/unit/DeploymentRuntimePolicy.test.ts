import { readFileSync } from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf-8');
}

describe('deployment runtime policy', () => {
  it('uses Docker Compose deployment commands for the Hetzner VPS runtime', () => {
    const workflow = readProjectFile('.github/workflows/deploy-hetzner.yml');

    expect(workflow).toContain('COMPOSE=(docker compose --env-file .env)');
    expect(workflow).toContain('done < .env');
    expect(workflow).toContain('export "$key=$value"');
    expect(workflow).toContain('docker ps --filter label=com.docker.compose.service=app --filter status=running -q');
    expect(workflow).toContain("docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}'");
    expect(workflow).toContain('"${COMPOSE[@]}" build app frontend');
    expect(workflow).toContain('"${COMPOSE[@]}" up -d app frontend');
    expect(workflow).toContain('Pre-deploy backup completed');
    expect(workflow).not.toContain('Pre-deploy DB backup failed (non-blocking)');
    expect(workflow).not.toContain('|| echo "::warning::Pre-deploy DB backup failed');
    expect(workflow).not.toContain('cypher-k8s-backup.service');
    expect(workflow).not.toContain('k3s ctr');
    expect(workflow).not.toContain('kubectl');
  });

  it('preserves server-only runtime directories during rsync deploys', () => {
    const workflow = readProjectFile('.github/workflows/deploy-hetzner.yml');

    expect(workflow).toContain("--exclude '/backups'");
    expect(workflow).toContain("--exclude '/config'");
    expect(workflow).toContain("--exclude '/uploads'");
    expect(workflow).not.toContain("--exclude 'config'");
  });

  it('selects only running containers for pre-deploy rollback image capture', () => {
    const workflow = readProjectFile('.github/workflows/deploy-hetzner.yml');

    expect(workflow).toContain('docker ps --filter label=com.docker.compose.service=app --filter status=running -q');
    expect(workflow).toContain('docker ps --filter label=com.docker.compose.service=frontend --filter status=running -q');
    expect(workflow).not.toContain('app_container="$("${COMPOSE[@]}" ps -q app)"');
    expect(workflow).not.toContain('frontend_container="$("${COMPOSE[@]}" ps -q frontend)"');
  });

  it('runs pre-deploy database dumps against Compose db or the app runtime database connection', () => {
    const workflow = readProjectFile('.github/workflows/deploy-hetzner.yml');

    expect(workflow).toContain('docker ps --filter label=com.docker.compose.service=db --filter status=running -q');
    expect(workflow).toContain('db_container="${db_containers[0]:-}"');
    expect(workflow).toContain('docker exec "$db_container" pg_dump -Fc -U cypher_user -d cypher_erp');
    expect(workflow).toContain('docker run --rm --network "container:$runtime_env_container"');
    expect(workflow).toContain('postgres:15-alpine pg_dump -Fc');
    expect(workflow).toContain('-h "${DB_HOST:-db}"');
    expect(workflow).toContain('-p "${DB_PORT:-5432}"');
    expect(workflow).not.toContain('docker exec cypher-erp-db pg_dump');
    expect(workflow).not.toContain('No running Compose db container found for pre-deploy backup.');
  });

  it('runs post-deploy VAT guards against Compose db or the app runtime database connection', () => {
    const workflow = readProjectFile('.github/workflows/deploy-hetzner.yml');

    expect(workflow).toContain('docker exec -i "$db_container" psql -X -qAt -F');
    expect(workflow).toContain('postgres:15-alpine psql -X -qAt -F');
    expect(workflow).toContain('--network "container:$runtime_env_container"');
    expect(workflow).not.toContain('docker exec -i cypher-erp-db psql');
    expect(workflow).not.toContain('No running Compose db container found for VAT guard.');
  });

  it('does not expose internal production ports on all interfaces', () => {
    const prodCompose = readProjectFile('docker-compose.prod.yml');

    expect(prodCompose).not.toContain('"5672:5672"');
    expect(prodCompose).not.toContain('"15672:15672"');
    expect(prodCompose).not.toContain('"15692:15692"');
    expect(prodCompose).not.toContain('"8080:8080"');
    expect(prodCompose).toContain('"127.0.0.1:5672:5672"');
    expect(prodCompose).toContain('"127.0.0.1:15672:15672"');
    expect(prodCompose).toContain('"127.0.0.1:15692:15692"');
    expect(prodCompose).toContain('"127.0.0.1:8080:8080"');
  });

  it('defaults go-live gate to read-only checks unless smoke mode is explicit', () => {
    const gate = readProjectFile('scripts/go-live-gate.sh');

    expect(gate).toContain('GATE_MODE="${GATE_MODE:-readiness}"');
    expect(gate).toContain('launch-smoke');
    expect(gate).toMatch(/case "\$GATE_MODE" in[\s\S]*launch-smoke/);
  });

  it('checks the registered root health endpoint in Hetzner smoke tests', () => {
    const smokeScript = readProjectFile('scripts/test/smoke-hetzner.sh');

    expect(smokeScript).toContain('"$BASE_URL/health"');
    expect(smokeScript).not.toContain('$BASE_URL/api/v1/health');
  });
});
