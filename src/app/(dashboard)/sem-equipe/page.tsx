import { LogOut, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { logoutAction } from "@/actions/auth";
import { requireUser } from "@/lib/auth";

export default async function SemEquipePage() {
  const user = await requireUser();

  if (user.teamId) {
    redirect("/");
  }

  if (user.role === "GLOBAL_ADMIN") {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl shadow-black/30 sm:p-8">
        <div className="mb-5 flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
            <Users className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="font-mono text-xl font-bold tracking-tight text-zinc-100">
              Conta sem equipe vinculada
            </h1>
            <p className="text-xs text-zinc-400">
              Acesso aguardando vinculação
            </p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-zinc-300">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <p className="text-xs text-zinc-400">Conta conectada</p>
            <p className="mt-1 font-medium text-zinc-100">{user.name}</p>
            <p className="text-xs text-zinc-400">{user.email}</p>
          </div>

          <p className="leading-relaxed text-zinc-300">
            Sua conta não está vinculada a nenhuma equipe no momento. Para
            acessar o painel, registrar questões e colaborar com seus colegas,
            entre em contato com o{" "}
            <span className="font-semibold text-zinc-100">
              Administrador Global do Sistema
            </span>{" "}
            e solicite a vinculação da sua conta a uma equipe.
          </p>
        </div>

        <form action={logoutAction} className="mt-6">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-4 py-2.5 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-600 hover:bg-zinc-800"
          >
            <LogOut className="h-4 w-4 text-zinc-400" aria-hidden="true" />
            <span>Sair da conta</span>
          </button>
        </form>
      </div>
    </div>
  );
}
