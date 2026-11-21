import { redirect } from "next/navigation";
import { RotateCcw, Send, Target } from "lucide-react";
import { LoginForm } from "@/components/AuthForms";
import { IcpcBalloonsMark, IcpcTricolorBar } from "@/components/IcpcLogo";
import { getCurrentUser } from "@/lib/auth";

const FEATURES = [
  {
    icon: Target,
    title: "Tópicos & Cobertura",
    description:
      "Mapeie o progresso individual e coletivo em grafos, DP, estruturas e teoria dos números.",
    accent: "text-blue-400 border-blue-500/25 bg-blue-500/10",
  },
  {
    icon: RotateCcw,
    title: "Revisão Automática",
    description:
      "Reforce questões críticas com repetição espaçada e não deixe nenhum clássico escapar.",
    accent: "text-amber-400 border-amber-500/25 bg-amber-500/10",
  },
  {
    icon: Send,
    title: "Problemas Propostos",
    description:
      "Compartilhe desafios entre os membros da equipe e acompanhe quem já resolveu cada problema.",
    accent: "text-red-400 border-red-500/25 bg-red-500/10",
  },
] as const;

const SUPPORTED_JUDGES = [
  "Codeforces",
  "LeetCode",
  "AtCoder",
  "CSES",
  "Beecrowd",
] as const;

export default async function LoginPage() {
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

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-zinc-950 px-4 py-12 sm:px-6 lg:px-8">
      <IcpcTricolorBar className="fixed inset-x-0 top-0 z-20" />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(59,130,246,0.13),transparent_50%),radial-gradient(ellipse_at_top,rgba(250,204,21,0.08),transparent_45%),radial-gradient(ellipse_at_bottom_right,rgba(239,68,68,0.11),transparent_50%)]"
      />

      <div className="relative z-10 grid w-full max-w-5xl grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-10">
        {/* Left Showcase Column */}
        <section className="order-2 space-y-6 lg:order-1 lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-300 shadow-sm backdrop-blur">
            <span className="flex items-center gap-1" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="h-2 w-2 rounded-full bg-red-500" />
            </span>
            <span>ICPC · International Collegiate Programming Contest</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <IcpcBalloonsMark size="lg" />
              <div>
                <h1 className="font-mono text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
                  Nunca Foi{" "}
                  <span className="bg-gradient-to-r from-blue-400 via-amber-300 to-red-400 bg-clip-text text-transparent">
                    ICPC
                  </span>
                </h1>
                <p className="mt-1 font-mono text-xs text-zinc-400">
                  equipe // Nunca Foi Sort()
                </p>
              </div>
            </div>

            <p className="max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              Centralize treinos, cobertura de tópicos, revisões espaçadas e
              desafios internos para times de programação competitiva em
              preparação para a Maratona de Programação e ICPC.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-4 backdrop-blur transition-colors hover:border-zinc-700/80"
                >
                  <div
                    className={`mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border ${feature.accent}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="text-sm font-semibold text-zinc-100">
                    {feature.title}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="mr-1 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
              Juízes suportados:
            </span>
            {SUPPORTED_JUDGES.map((judge) => (
              <span
                key={judge}
                className="rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 font-mono text-xs text-zinc-300"
              >
                {judge}
              </span>
            ))}
          </div>
        </section>

        {/* Right Login Card */}
        <section className="order-1 lg:order-2 lg:col-span-5">
          <div className="overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/85 shadow-2xl shadow-black/60 backdrop-blur">
            <IcpcTricolorBar />
            <div className="p-6 sm:p-8">
              <div className="mb-6">
                <div className="mb-4 flex items-center gap-3 lg:hidden">
                  <IcpcBalloonsMark size="md" />
                  <div>
                    <p className="font-mono text-base font-bold tracking-tight text-zinc-100">
                      Nunca Foi{" "}
                      <span className="text-amber-400">ICPC</span>
                    </p>
                    <p className="font-mono text-[11px] text-zinc-500">
                      equipe // Nunca Foi Sort()
                    </p>
                  </div>
                </div>

                <h2 className="font-mono text-xl font-bold tracking-tight text-zinc-100">
                  Entrar na plataforma
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Acesse sua equipe ou o painel administrativo
                </p>
              </div>

              <LoginForm />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
