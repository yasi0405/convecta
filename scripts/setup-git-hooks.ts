import { execSync } from "child_process";
import path from "path";

function run(command: string[]) {
  return execSync(command.join(" "), { stdio: "ignore" });
}

function main() {
  try {
    run(["git", "rev-parse", "--is-inside-work-tree"]);
  } catch {
    return;
  }

  const hooksPath = path.join(".githooks");
  try {
    execSync(`git config core.hooksPath ${hooksPath}`, { stdio: "ignore" });
    console.log(`Git hooks path set to ${hooksPath}`);
  } catch (error) {
    console.warn("Unable to configure git hooks path:", (error as Error).message);
  }
}

main();
