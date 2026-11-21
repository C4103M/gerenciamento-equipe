import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { ActivateAccountForm } from "@/components/ActivateAccountForm";
import { IcpcBalloonsMark, IcpcTricolorBar } from "@/components/IcpcLogo";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface AtivarPageProps {
  searchParams: Promise<{ token?: string }>;
}

async function loadActivationRecord(token: string) {
  const record = await prisma.verificationToken.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          team: { select: { name: true } },
        },
      },
    },
  });

  if (!record) {
    return { status: "invalid" as const, record: null };
  }
  if (record.usedAt) {
    return { status: "used" as const, record };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return { status: "expired" as const, record };
  }
  return { status: "valid" as const, record };
}

export default async function AtivarPage({ searchParams }: AtivarPageProps) {
  const currentUser = await getCurrentUser();
  if (currentUser) {
    if (currentUser.role === "GLOBAL_ADMIN" && !currentUser.teamId) {
      redirect("/admin");
    }
    if (!currentUser.teamId) {
      redirect("/sem-equipe");
    }
    redirect("/");
  }

  const { token: rawToken } = await searchParams;
  const token = rawToken?.trim() || undefined;

  const activation = token ? await loadActivationRecord(token) : null;
  const isInvalidToken = activation?.status === "invalid";
  const isUsedToken = activation?.status === "used";
  const isExpiredToken = activation?.status === "expired";
  const record = activation?.status === "valid" ? activation.record : null;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.14),transparent_60%)]"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/80 shadow-2xl shadow-black/50 backdrop-blur">
        <IcpcTricolorBar />
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 flex flex-col items-center">
              <IcpcBalloonsMark size="md" />
            </div>
            <h1 className="font-mono text-xl font-bold tracking-tight text-zinc-100">
              Nunca Foi <span className="text-amber-400">ICPC</span>
            </h1>
            <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
              International Collegiate Programming Contest
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Ative sua conta com o código de 6 dígitos enviado para o seu e-mail e defina sua senha de acesso.
            </p>
          </div>

          {isInvalidToken ? (
            <div className="space-y-4">
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>Link de ativação inválido.</span>
              </div>
              <div className="flex flex-col gap-2.5">
                <Link
                  href="/ativar"
                  className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  Informar e-mail e código manualmente
                </Link>
                <Link
                  href="/login"
                  className="text-center text-sm font-medium text-zinc-400 transition hover:text-zinc-200"
                >
                  Voltar para o login
                </Link>
              </div>
            </div>
          ) : isUsedToken ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  Este link já foi utilizado. Você já pode entrar com sua senha.
                </span>
              </div>
              <Link
                href="/login"
                className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Ir para o login
              </Link>
            </div>
          ) : isExpiredToken ? (
            <div className="space-y-4">
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300"
              >
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  Este código de verificação expirou. Peça ao Administrador Global para reenviar um novo código.
                </span>
              </div>
              <Link
                href="/login"
                className="flex w-full items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-900"
              >
                Voltar para o login
              </Link>
            </div>
          ) : (
            <ActivateAccountForm
              token={token}
              presetUser={
                record
                  ? {
                      name: record.user.name,
                      email: record.user.email,
                      teamName: record.user.team?.name ?? null,
                      cfHandle: record.user.cfHandle,
                      lcHandle: record.user.lcHandle,
                    }
                  : null
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
