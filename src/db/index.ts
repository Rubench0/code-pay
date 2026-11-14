import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

function createDb() {
  return drizzle({ client: neon(env.databaseUrl()), schema });
}

let instance: ReturnType<typeof createDb> | undefined;

export function db() {
  instance ??= createDb();
  return instance;
}
