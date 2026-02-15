import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { resolveOpenClawCNPackageRoot, resolveOpenClawCNPackageRootSync } from "./openclaw-root.js";

describe("resolveOpenClawCNPackageRoot", () => {
  const fixtureRoot = path.join(os.tmpdir(), "openclawcn-root-test");
  let caseIndex = 0;

  function nextCaseDir() {
    return path.join(fixtureRoot, "case-" + caseIndex++);
  }

  afterAll(async () => {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  });

  it("finds package root when package.json has name openclawcn", async () => {
    const caseDir = nextCaseDir();
    await fs.mkdir(caseDir, { recursive: true });
    await fs.writeFile(
      path.join(caseDir, "package.json"),
      JSON.stringify({ name: "openclawcn" }),
      "utf-8",
    );
    const result = await resolveOpenClawCNPackageRoot({ cwd: caseDir });
    expect(result).toBe(path.resolve(caseDir));
  });

  it("finds package root when package.json has name openclawcn", async () => {
    const caseDir = nextCaseDir();
    await fs.mkdir(caseDir, { recursive: true });
    await fs.writeFile(
      path.join(caseDir, "package.json"),
      JSON.stringify({ name: "openclawcn" }),
      "utf-8",
    );
    const result = await resolveOpenClawCNPackageRoot({ cwd: caseDir });
    expect(result).toBe(path.resolve(caseDir));
  });

  it("returns null for unrelated package name", async () => {
    const caseDir = nextCaseDir();
    await fs.mkdir(caseDir, { recursive: true });
    await fs.writeFile(
      path.join(caseDir, "package.json"),
      JSON.stringify({ name: "some-other-package" }),
      "utf-8",
    );
    const result = await resolveOpenClawCNPackageRoot({ cwd: caseDir });
    expect(result).toBeNull();
  });

  it("walks up to parent directories to find root", async () => {
    const caseDir = nextCaseDir();
    const childDir = path.join(caseDir, "src", "agents");
    await fs.mkdir(childDir, { recursive: true });
    await fs.writeFile(
      path.join(caseDir, "package.json"),
      JSON.stringify({ name: "openclawcn" }),
      "utf-8",
    );
    const result = await resolveOpenClawCNPackageRoot({ cwd: childDir });
    expect(result).toBe(path.resolve(caseDir));
  });

  it("returns null when no package.json exists", async () => {
    const caseDir = nextCaseDir();
    await fs.mkdir(caseDir, { recursive: true });
    const result = await resolveOpenClawCNPackageRoot({ cwd: caseDir });
    expect(result).toBeNull();
  });
});

describe("resolveOpenClawCNPackageRootSync", () => {
  const fixtureRoot = path.join(os.tmpdir(), "openclawcn-root-test-sync");
  let caseIndex = 0;

  function nextCaseDir() {
    return path.join(fixtureRoot, "case-" + caseIndex++);
  }

  afterAll(async () => {
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  });

  it("sync: finds openclawcn package root", async () => {
    const caseDir = nextCaseDir();
    await fs.mkdir(caseDir, { recursive: true });
    await fs.writeFile(
      path.join(caseDir, "package.json"),
      JSON.stringify({ name: "openclawcn" }),
      "utf-8",
    );
    const result = resolveOpenClawCNPackageRootSync({ cwd: caseDir });
    expect(result).toBe(path.resolve(caseDir));
  });

  it("sync: finds openclawcn package root", async () => {
    const caseDir = nextCaseDir();
    await fs.mkdir(caseDir, { recursive: true });
    await fs.writeFile(
      path.join(caseDir, "package.json"),
      JSON.stringify({ name: "openclawcn" }),
      "utf-8",
    );
    const result = resolveOpenClawCNPackageRootSync({ cwd: caseDir });
    expect(result).toBe(path.resolve(caseDir));
  });

  it("sync: returns null for non-matching package name", async () => {
    const caseDir = nextCaseDir();
    await fs.mkdir(caseDir, { recursive: true });
    await fs.writeFile(
      path.join(caseDir, "package.json"),
      JSON.stringify({ name: "random-project" }),
      "utf-8",
    );
    const result = resolveOpenClawCNPackageRootSync({ cwd: caseDir });
    expect(result).toBeNull();
  });
});
