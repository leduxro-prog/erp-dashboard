import { readFileSync } from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../..');

function readProjectFile(relativePath: string): string {
  return readFileSync(path.join(projectRoot, relativePath), 'utf-8');
}

describe('deployment runtime policy', () => {
  it('requires production pre-deploy backup to be blocking', () => {
    const workflow = readProjectFile('.github/workflows/deploy-hetzner.yml');

    expect(workflow).toContain('systemctl start cypher-k8s-backup.service');
    expect(workflow).not.toContain('Pre-deploy DB backup failed (non-blocking)');
    expect(workflow).not.toContain('|| echo "::warning::Pre-deploy DB backup failed');
  });

  it('validates k8s overlays before applying them', () => {
    const workflow = readProjectFile('.github/workflows/deploy-hetzner.yml');
    const kustomizeIndex = workflow.indexOf('kubectl kustomize orchestration/k8s/overlays/staging');
    const applyIndex = workflow.indexOf('kubectl apply -k orchestration/k8s/overlays/staging');

    expect(kustomizeIndex).toBeGreaterThan(-1);
    expect(applyIndex).toBeGreaterThan(-1);
    expect(kustomizeIndex).toBeLessThan(applyIndex);
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
