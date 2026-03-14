import { readFile, writeFile } from "node:fs/promises";
import { getStatePath, ensureDataDirs } from "./paths.js";

export interface ServerState {
  version: string;
  source: string;
  installPath: string;
  binPath: string;
  installedAt: string;
  healthStatus: "ok" | "error" | "unknown";
}

export interface LspforgeState {
  servers: Record<string, ServerState>;
}

function emptyState(): LspforgeState {
  return { servers: {} };
}

export async function loadState(): Promise<LspforgeState> {
  try {
    const content = await readFile(getStatePath(), "utf-8");
    return JSON.parse(content) as LspforgeState;
  } catch {
    return emptyState();
  }
}

export async function saveState(state: LspforgeState): Promise<void> {
  await ensureDataDirs();
  await writeFile(getStatePath(), JSON.stringify(state, null, 2) + "\n", "utf-8");
}

export async function addServer(
  name: string,
  server: ServerState,
): Promise<void> {
  const state = await loadState();
  state.servers[name] = server;
  await saveState(state);
}

export async function removeServer(name: string): Promise<void> {
  const state = await loadState();
  delete state.servers[name];
  await saveState(state);
}

export async function getServer(
  name: string,
): Promise<ServerState | undefined> {
  const state = await loadState();
  return state.servers[name];
}
