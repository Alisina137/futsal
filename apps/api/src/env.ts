import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { parseRuntimeEnv } from "./runtime-config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env") });

export const env = parseRuntimeEnv(process.env);
