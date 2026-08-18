#!/usr/bin/env node

/**
 * Docker helper script for VitalityNutri.
 * Usage:
 *   node scripts/docker.mjs build          - Build all containers
 *   node scripts/docker.mjs build:backend  - Build only backend container
 *   node scripts/docker.mjs build:frontend - Build only frontend container
 *   node scripts/docker.mjs up             - Start containers in detached mode
 *   node scripts/docker.mjs down           - Stop and remove containers
 *   node scripts/docker.mjs logs           - Stream container logs
 *   node scripts/docker.mjs restart        - Restart containers
 *   node scripts/docker.mjs rebuild        - Clean rebuild and restart containers
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const action = process.argv[2] || "build";

// Ensure local env files exist before running compose
function checkEnvFiles() {
  const envBackend = path.join(rootDir, ".env.backend");
  const envFrontend = path.join(rootDir, ".env.frontend");
  const envBackendExample = path.join(rootDir, ".env.backend.example");
  const envFrontendExample = path.join(rootDir, ".env.frontend.example");

  if (!fs.existsSync(envBackend) && fs.existsSync(envBackendExample)) {
    console.log("ℹ️  .env.backend not found. Creating from .env.backend.example...");
    fs.copyFileSync(envBackendExample, envBackend);
  }

  if (!fs.existsSync(envFrontend) && fs.existsSync(envFrontendExample)) {
    console.log("ℹ️  .env.frontend not found. Creating from .env.frontend.example...");
    fs.copyFileSync(envFrontendExample, envFrontend);
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Executing: ${command} ${args.join(" ")}\n`);
    const proc = spawn(command, args, {
      cwd: rootDir,
      stdio: "inherit",
      shell: true
    });

    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command exited with code ${code}`));
      }
    });
  });
}

async function main() {
  checkEnvFiles();

  switch (action) {
    case "build":
      await runCommand("docker", ["compose", "build"]);
      break;

    case "build:backend":
      await runCommand("docker", ["compose", "build", "backend"]);
      break;

    case "build:frontend":
      await runCommand("docker", ["compose", "build", "frontend"]);
      break;

    case "up":
      await runCommand("docker", ["compose", "up", "-d"]);
      console.log("\n✅ VitalityNutri is running locally!");
      console.log("👉 Frontend: http://localhost:5027");
      console.log("👉 Backend API: http://localhost:5026/health");
      console.log("👉 Scalar API Docs (Dev): http://localhost:5026/scalar/v1\n");
      break;

    case "down":
      await runCommand("docker", ["compose", "down"]);
      break;

    case "logs":
      await runCommand("docker", ["compose", "logs", "-f"]);
      break;

    case "restart":
      await runCommand("docker", ["compose", "restart"]);
      break;

    case "rebuild":
      await runCommand("docker", ["compose", "build", "--no-cache"]);
      await runCommand("docker", ["compose", "up", "-d"]);
      console.log("\n✅ VitalityNutri has been rebuilt and started!");
      console.log("👉 Frontend: http://localhost:5027\n");
      break;

    case "help":
    case "--help":
    case "-h":
      console.log(`
VitalityNutri Docker Helper:
  npm run docker:build           Build all containers
  npm run docker:build:backend   Build only backend container
  npm run docker:build:frontend  Build only frontend container
  npm run docker:up              Start containers in background
  npm run docker:down            Stop and remove containers
  npm run docker:logs            Follow container logs
  npm run docker:restart         Restart containers
  npm run docker:rebuild         Clean rebuild (--no-cache) and start
`);
      break;

    default:
      console.error(`❌ Unknown command: "${action}". Valid commands: build, build:backend, build:frontend, up, down, logs, restart, rebuild`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\n❌ Error: ${err.message}`);
  process.exit(1);
});
