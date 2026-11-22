<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Database Migrations (Prisma)

Any change to `prisma/schema.prisma` MUST include a versioned SQL migration generated locally and committed in `prisma/migrations/`:

```bash
npm run db:migrate -- --name <descricao_da_alteracao>
```

- Production builds on Vercel (`VERCEL_ENV=production`) run `scripts/db-migrate-deploy.mjs` (`prisma migrate deploy` + schema drift check) automatically before `next build`.
- Never use `prisma db push --accept-data-loss` or reset commands against production. For breaking changes (renaming/splitting columns), write additive/expand-and-contract SQL in the migration file so existing data is preserved.
