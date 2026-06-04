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

    expect(workflow).toContain("--exclude 'backups'");
    expect(workflow).toContain("--exclude 'config'");
    expect(workflow).toContain("--exclude 'uploads'");
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
});
