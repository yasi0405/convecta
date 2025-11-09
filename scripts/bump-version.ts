import { execSync } from "child_process";
import fs from "fs";
import path from "path";

type Replacement = {
  pattern: RegExp;
  replacement: string | ((substring: string, ...args: any[]) => string);
};

const repoRoot = path.resolve(__dirname, "..");
const pkgPath = path.join(repoRoot, "package.json");
const lockPath = path.join(repoRoot, "package-lock.json");
const gitDir = path.join(repoRoot, ".git");
const statePath = path.join(gitDir, "auto-version-state.json");

const args = new Set(process.argv.slice(2));
const runForHook = args.has("--for-hook");
const amendCommit = args.has("--amend");
const forceRun = args.has("--force");

function bumpPatch(version: string): string {
  const parts = version.split(".").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid semver format: "${version}"`);
  }
  parts[2] += 1;
  return parts.join(".");
}

function isGitRepo(): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function runGit(argsList: string[]): string {
  return execSync(`git ${argsList.join(" ")}`, {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath: string, data: any) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function updateTextFile(relativePath: string, replacements: Replacement[], touched: Set<string>) {
  const targetPath = path.join(repoRoot, relativePath);
  let content = fs.readFileSync(targetPath, "utf8");
  let updated = content;

  for (const { pattern, replacement } of replacements) {
    const next = updated.replace(pattern, replacement as any);
    if (next === updated) {
      throw new Error(`Pattern ${pattern} not found in ${relativePath}`);
    }
    updated = next;
  }

  if (updated !== content) {
    fs.writeFileSync(targetPath, updated);
    touched.add(relativePath);
  }
}

function output(message: string) {
  if (runForHook) {
    console.log(message);
  } else {
    console.log(message);
  }
}

function saveState(commitHash: string, version: string) {
  if (!gitDir || !fs.existsSync(gitDir)) return;
  const payload = {
    lastBumpedCommit: commitHash,
    lastVersion: version,
    bumpedAt: new Date().toISOString(),
  };
  fs.writeFileSync(statePath, JSON.stringify(payload, null, 2));
}

const gitAvailable = isGitRepo();
const headHash = gitAvailable ? runGit(["rev-parse", "HEAD"]) : null;
const existingState =
  gitAvailable && fs.existsSync(statePath)
    ? (readJson(statePath) as { lastBumpedCommit?: string })
    : {};

const pkg = readJson(pkgPath);
const currentVersion = String(pkg.version);
const nextVersion = bumpPatch(currentVersion);

const alreadyBumped =
  amendCommit && gitAvailable && !forceRun && existingState.lastBumpedCommit === headHash;

if (alreadyBumped) {
  output(runForHook ? `SKIP ${currentVersion}` : `Version already bumped for current commit (${headHash}).`);
  process.exit(0);
}

pkg.version = nextVersion;
writeJson(pkgPath, pkg);

const touchedFiles = new Set<string>(["package.json"]);

if (fs.existsSync(lockPath)) {
  const lock = readJson(lockPath);
  if (lock.version) lock.version = nextVersion;
  if (lock.packages && lock.packages[""]) {
    lock.packages[""].version = nextVersion;
  }
  writeJson(lockPath, lock);
  touchedFiles.add("package-lock.json");
}

updateTextFile(
  "app.config.js",
  [
    { pattern: /(version:\s*")(\d+\.\d+\.\d+)(")/, replacement: `$1${nextVersion}$3` },
    { pattern: /(runtimeVersion:\s*")(\d+\.\d+\.\d+)(")/, replacement: `$1${nextVersion}$3` },
  ],
  touchedFiles
);

updateTextFile(
  "ios/convecta/Info.plist",
  [
    {
      pattern: /(<key>CFBundleShortVersionString<\/key>\s*<string>)([^<]+)(<\/string>)/,
      replacement: `$1${nextVersion}$3`,
    },
  ],
  touchedFiles
);

updateTextFile(
  "ios/convecta/Supporting/Expo.plist",
  [
    {
      pattern: /(<key>EXUpdatesRuntimeVersion<\/key>\s*<string>)([^<]+)(<\/string>)/,
      replacement: `$1${nextVersion}$3`,
    },
  ],
  touchedFiles
);

updateTextFile(
  "android/app/build.gradle",
  [{ pattern: /(versionName\s*")(\d+\.\d+\.\d+)(")/, replacement: `$1${nextVersion}$3` }],
  touchedFiles
);

updateTextFile(
  "android/app/src/main/res/values/strings.xml",
  [
    {
      pattern: /(<string name="expo_runtime_version">)([^<]+)(<\/string>)/,
      replacement: `$1${nextVersion}$3`,
    },
  ],
  touchedFiles
);

const bumpedMessage = `Version bumped: ${currentVersion} → ${nextVersion}`;

if (amendCommit && gitAvailable) {
  const filesArg = Array.from(touchedFiles)
    .map((file) => `"${file}"`)
    .join(" ");
  execSync(`git add ${filesArg}`, { stdio: "inherit", cwd: repoRoot });
  execSync("git commit --amend --no-edit", { stdio: "inherit", cwd: repoRoot });
  const newHead = runGit(["rev-parse", "HEAD"]);
  saveState(newHead, nextVersion);
}

if (!amendCommit && gitAvailable) {
  // Clear state so next hook still bumps (since we didn't amend)
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
}

if (runForHook) {
  output(`BUMPED ${nextVersion}`);
} else {
  output(bumpedMessage);
}
