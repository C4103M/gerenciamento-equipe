# Nunca Foi ICPC — Painel de Estudos e Treino para Maratona / ICPC

Plataforma web full-stack para equipes de programação competitiva (como a equipe **Nunca Foi Sort()**) registrarem progresso de estudos, lista de revisão automática e problemas propostos entre membros, com **Painel de Administrador Global** e **ativação de contas com validação de e-mail**.

---

## Funcionalidades

- **Administrador Global (`/admin`) & Onboarding por E-mail:**
  - O Administrador Global cria, edita e exclui equipes e cadastra novos usuários informando nome e e-mail (sem definir a senha pelo usuário).
  - Ao cadastrar um usuário, o sistema gera um **código de verificação de 6 dígitos** e um **link único de ativação** (`/ativar?token=...`, válido por 24h) enviados por e-mail.
  - O usuário acessa o link, confirma o código recebido no e-mail e cria sua própria senha.
- **Isolamento Multi-Equipes:**
  - Cada equipe visualiza apenas suas próprias questões, revisões, membros e propostas.
- **Registro de Questões (`/questoes`):**
  - Título, link (detecção automática de Codeforces, LeetCode, AtCoder, Beecrowd, CSES ou Outro), múltiplos tópicos (20 tópicos clássicos globais + criação livre), dificuldade percebida, toggle **"Conseguiu fazer?"** e observações.
- **Lista de Revisão Automática (`/revisao`):**
  - Qualquer questão registrada com **"Conseguiu fazer?" = Não** entra automaticamente na lista de revisão da equipe.
- **Problemas Propostos e Notificações (`/propostos` e `/notificacoes`):**
  - Proposição de desafios para colegas da mesma equipe (`Pendente` → `Visualizado` → `Tentou` / `Feito` / `Descartado`), criando registro automático na lista de revisão em caso de `Tentou` e notificações in-app.

---

## Stack Tecnológica

- **Frontend & Backend:** Next.js 16 (App Router, Server Components, Server Actions) + TypeScript
- **Estilização:** Tailwind CSS v4 + Lucide Icons
- **Banco de Dados & ORM:** PostgreSQL + Prisma ORM (v6)
- **E-mail:** Resend HTTP API ou SMTP (`nodemailer`), com fallback de preview local em desenvolvimento
- **Autenticação:** Sessão HTTP-only com JWT (`jose`) e hash de senha (`bcryptjs`)

---

## Rodando Localmente (PostgreSQL Local)

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Configure `.env`:**
   ```env
   DATABASE_URL="postgresql://postgres:1234@localhost:5432/nunca_foi_sort?schema=public"
   AUTH_SECRET="uma-chave-secreta-longa"
   APP_URL="http://localhost:3000"
   ADMIN_NAME="Admin Global"
   ADMIN_EMAIL="seu-email@dominio.com"
   ADMIN_PASSWORD="sua-senha-segura"
   ```

   Para envio real de e-mails com código de verificação, configure **uma** das opções no `.env`:
   - **Resend:** `RESEND_API_KEY` e `EMAIL_FROM`
   - **SMTP (ex: Gmail com Senha de App):** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e `EMAIL_FROM`
   - *(Sem essas variáveis, o painel `/admin` exibe um preview local com o código de 6 dígitos e o link `/ativar?token=...` para testes sem precisar de SMTP).*

3. **Sincronize o banco e execute o seed:**
   ```bash
   npx prisma db push
   npm run db:seed
   ```
   O seed cria apenas os 20 tópicos clássicos e o **Administrador Global** configurado em `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse `http://localhost:3000`.

---

## Deploy na Vercel com Neon Postgres (Gratuito)

1. Suba o repositório para o GitHub (`.env` permanece ignorado no `.gitignore`).
2. Importe o projeto na Vercel e adicione **Storage → Neon (Serverless Postgres)** para obter `DATABASE_URL` automaticamente.
3. Configure nas Environment Variables da Vercel: `AUTH_SECRET`, `APP_URL` (ex: `https://seu-app.vercel.app`), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, e seu provedor de e-mail (`RESEND_API_KEY` ou `SMTP_*`).
4. Com a `DATABASE_URL` do Neon, execute uma vez:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```
5. Faça o deploy na Vercel.
