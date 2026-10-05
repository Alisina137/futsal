import { spawn } from "node:child_process";

const port = process.env.ADMIN_WEB_PORT?.trim() || "8082";
if (!/^\d+$/.test(port)) {
  console.error("ADMIN_WEB_PORT must be a numeric TCP port.");
  process.exit(1);
}

console.log(`Starting Futsal admin panel at http://localhost:${port}/admin`);
console.log("The browser will open automatically. Sign in with a PLATFORM_ADMIN account.");

const child = spawn(
  "pnpm",
  [
    "--filter",
    "@leaguekick/mobile",
    "exec",
    "expo",
    "start",
    "--web",
    "--clear",
    "--port",
    port,
  ],
  {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      EXPO_PUBLIC_ADMIN_MODE: "true",
    },
  },
);

child.on("error", (error) => {
  console.error("Failed to start the admin panel:", error.message);
  process.exit(1);
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
