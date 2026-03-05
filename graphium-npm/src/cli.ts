#!/usr/bin/env node

import path from "path";
import { execSync } from "child_process";
import { platform } from "os";
import { generateDependencyGraph } from "./graphGenerator";

const targetDir = process.argv[2] || process.cwd();
const outputFile = process.argv[3] || "dependency.html";

function openInBrowser(filePath: string): void {
  const absolutePath = path.resolve(filePath);
  const fileUrl = `file://${absolutePath}`;

  try {
    if (platform() === "darwin") {
      // macOS
      execSync(`open "${absolutePath}"`);
    } else if (platform() === "win32") {
      // Windows
      execSync(`start "" "${absolutePath}"`);
    } else {
      // Linux and other Unix-like systems
      execSync(`xdg-open "${absolutePath}"`);
    }
  } catch (err) {
    // Silently fail if browser opening doesn't work
    console.log(`[INFO] View the graph at: ${fileUrl}`);
  }
}

generateDependencyGraph(targetDir, outputFile)
  .then(() => {
    openInBrowser(outputFile);
  })
  .catch((err: Error) => {
    console.error("[ERROR] Error generating graph:", err.message);
    process.exit(1);
  });
