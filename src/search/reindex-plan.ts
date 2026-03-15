export interface AliasSwapParams {
  aliasRead: string;
  aliasWrite: string;
  oldIndex?: string;
  newIndex: string;
}

export interface RollbackParams {
  aliasRead: string;
  currentIndex: string;
  previousIndex: string;
}

export interface AliasAction {
  add?: { index: string; alias: string };
  remove?: { index: string; alias: string };
}

export interface AliasPlan {
  actions: AliasAction[];
}

export function buildGenerationIndexName(prefix: string, at: Date = new Date()): string {
  const value = at.toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
  return `${prefix}_v${value}`;
}

export function buildAliasSwapPlan(params: AliasSwapParams): AliasPlan {
  const { aliasRead, aliasWrite, oldIndex, newIndex } = params;

  if (!aliasRead || !aliasWrite || !newIndex) {
    throw new Error('aliasRead, aliasWrite and newIndex are required');
  }

  const actions: AliasAction[] = [];

  if (oldIndex) {
    actions.push({ remove: { index: oldIndex, alias: aliasRead } });
    actions.push({ remove: { index: oldIndex, alias: aliasWrite } });
  }
  actions.push({ add: { index: newIndex, alias: aliasRead } });
  actions.push({ add: { index: newIndex, alias: aliasWrite } });

  return { actions };
}

export function buildRollbackPlan(params: RollbackParams): AliasPlan {
  const { aliasRead, currentIndex, previousIndex } = params;

  if (!aliasRead || !currentIndex || !previousIndex) {
    throw new Error('aliasRead, currentIndex and previousIndex are required');
  }

  // Note: only aliasRead is restored here. aliasWrite is intentionally left
  // pointing at currentIndex — the caller is responsible for reassigning
  // aliasWrite after confirming the rollback is stable, to avoid a write
  // split-brain during the recovery window.
  return {
    actions: [
      { remove: { index: currentIndex, alias: aliasRead } },
      { add: { index: previousIndex, alias: aliasRead } },
    ],
  };
}
