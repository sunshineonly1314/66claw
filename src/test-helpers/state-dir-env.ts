type StateDirEnvSnapshot = {
  openclawcnStateDir: string | undefined;
};

export function snapshotStateDirEnv(): StateDirEnvSnapshot {
  return {
    openclawcnStateDir: process.env.OPENCLAWCN_STATE_DIR,
  };
}

export function restoreStateDirEnv(snapshot: StateDirEnvSnapshot): void {
  if (snapshot.openclawcnStateDir === undefined) {
    delete process.env.OPENCLAWCN_STATE_DIR;
  } else {
    process.env.OPENCLAWCN_STATE_DIR = snapshot.openclawcnStateDir;
  }
}

export function setStateDirEnv(stateDir: string): void {
  process.env.OPENCLAWCN_STATE_DIR = stateDir;
}
