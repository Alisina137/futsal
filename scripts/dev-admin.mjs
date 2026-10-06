import { spawn } from "node:child_process";

const port = process.env.ADMIN_WEB_PORT?.trim() || "8082";
const apiPort = process.env.API_PORT?.trim() || "4000";
const adminApiUrl = process.env.ADMIN_API_URL?.trim() || `http://localhost:${apiPort}`;

if (!/^\d+$/.test(port)) {
  console.error("ADMIN_WEB_PORT must be a numeric TCP port.");
  process.exit(1);
}

try {
  const parsed = new URL(adminApiUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
} catch {
  console.error("ADMIN_API_URL must be a valid http(s) URL.");
  process.exit(1);
}

console.log(`Starting Futsal admin panel at http://localhost:${port}/admin`);
console.log(`Admin API: ${adminApiUrl}`);
console.log("The browser admin uses the local API by default and does not use the mobile ngrok URL.");
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
      EXPO_PUBLIC_API_URL: adminApiUrl,
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
