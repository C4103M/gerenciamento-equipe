import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DIRECT_URL_KEYS = [
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
];

function stripQuotes(raw) {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readEnvFileValue(filePath, targetKeys) {
  if (!fs.existsSync(filePath)) return new Map();
  const values = new Map();
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    if (!targetKeys.includes(key) || values.has(key)) continue;
    values.set(key, stripQuotes(trimmed.slice(eqIndex + 1)));
  }
  return values;
}

function resolveMigrationUrl() {
  for (const key of DIRECT_URL_KEYS) {
    const val = process.env[key];
    if (val) return val;
  }

  const cwd = process.cwd();
  const localEnv = readEnvFileValue(path.join(cwd, ".env.local"), DIRECT_URL_KEYS);
  const baseEnv = readEnvFileValue(path.join(cwd, ".env"), DIRECT_URL_KEYS);

  for (const key of DIRECT_URL_KEYS) {
    const val = localEnv.get(key) || baseEnv.get(key);
    if (val) return val;
  }

  return "";
}

function runPrisma(prismaCli, args, env, stdio) {
  return spawnSync(process.execPath, [prismaCli, ...args], {
    env,
    stdio,
    encoding: stdio === "pipe" ? "utf8" : undefined,
  });
}

function main() {
  const force =
    process.argv.includes("--force") ||
    process.env.RUN_DB_MIGRATIONS === "1" ||
    process.env.RUN_DB_MIGRATIONS === "true";
  const vercelEnv = process.env.VERCEL_ENV || "";

  if (!force && vercelEnv !== "production") {
    const reason = vercelEnv
      ? `ambiente Vercel "${vercelEnv}" (migrations automáticas rodam apenas em "production" para proteger o banco remoto)`
      : "build local sem --force / RUN_DB_MIGRATIONS=1";
    console.log(`[db-migrate] Pulando prisma migrate deploy (${reason}).`);
    process.exit(0);
  }

  const prismaCli = path.resolve(
    process.cwd(),
    "node_modules/prisma/build/index.js"
  );
  if (!fs.existsSync(prismaCli)) {
    console.error(
      `[db-migrate] ERRO: Prisma CLI não encontrado em ${prismaCli}. Execute "npm install" primeiro.`
    );
    process.exit(1);
  }

  const migrationUrl = resolveMigrationUrl();
  if (!migrationUrl) {
    console.error(
      "[db-migrate] ERRO: Nenhuma string de conexão encontrada (DATABASE_URL_UNPOOLED, POSTGRES_URL_NON_POOLING ou DATABASE_URL)."
    );
    process.exit(1);
  }

  let hostLabel = "desconhecido";
  try {
    hostLabel = new URL(migrationUrl).host || hostLabel;
  } catch {
    // Keep fallback host label if connection URL uses a custom format
  }

  console.log(
    `[db-migrate] Aplicando migrations pendentes no banco (${hostLabel})...`
  );

  const childEnv = {
    ...process.env,
    DATABASE_URL: migrationUrl,
  };

  const deployResult = runPrisma(
    prismaCli,
    ["migrate", "deploy", "--schema=prisma/schema.prisma"],
    childEnv,
    "inherit"
  );

  if (deployResult.status !== 0) {
    if (deployResult.error) {
      console.error(
        "[db-migrate] Falha ao executar prisma migrate deploy:",
        deployResult.error.message
      );
    }
    process.exit(deployResult.status ?? 1);
  }

  if (process.env.SKIP_SCHEMA_DRIFT_CHECK === "1") {
    process.exit(0);
  }

  const diffCheck = runPrisma(
    prismaCli,
    [
      "migrate",
      "diff",
      "--from-schema-datasource",
      "prisma/schema.prisma",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--exit-code",
    ],
    childEnv,
    "pipe"
  );

  if (diffCheck.status === 0) {
    console.log(
      "[db-migrate] Schema do banco está sincronizado com prisma/schema.prisma."
    );
    process.exit(0);
  }

  if (diffCheck.status === 2) {
    console.error(
      "\n[db-migrate] ERRO: Divergência detectada entre prisma/schema.prisma e o banco de dados!"
    );
    console.error(
      "[db-migrate] Alterações no schema sem migration versionada:"
    );
    runPrisma(
      prismaCli,
      [
        "migrate",
        "diff",
        "--from-schema-datasource",
        "prisma/schema.prisma",
        "--to-schema-datamodel",
        "prisma/schema.prisma",
        "--script",
      ],
      childEnv,
      "inherit"
    );
    console.error(
      "\n[db-migrate] Para propagar sem perda de dados, gere a migration localmente antes do deploy:\n" +
        "  npm run db:migrate -- --name <descricao_da_alteracao>\n" +
        "Em seguida, faça commit dos arquivos em prisma/migrations/."
    );
    process.exit(1);
  }

  if (diffCheck.stderr) {
    process.stderr.write(diffCheck.stderr);
  }
  if (diffCheck.error) {
    console.error(
      "[db-migrate] Falha ao verificar schema drift:",
      diffCheck.error.message
    );
  }
  process.exit(diffCheck.status ?? 1);
}

main();
