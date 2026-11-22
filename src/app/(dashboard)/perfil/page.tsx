import { UserCog } from "lucide-react";
import type { Metadata } from "next";
import { ProfileClient, type ProfileUserData } from "@/components/ProfileClient";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Meu Perfil — Nunca Foi ICPC",
};

export default async function PerfilPage() {
  const currentUser = await requireUser();

  const userData: ProfileUserData = {
    id: currentUser.id,
    name: currentUser.name,
    email: currentUser.email,
    role: currentUser.role,
    cfHandle: currentUser.cfHandle,
    lcHandle: currentUser.lcHandle,
    avatarColor: currentUser.avatarColor,
    createdAt: currentUser.createdAt.toISOString(),
    teamName: currentUser.team?.name ?? null,
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2 border-b border-zinc-800/80 pb-6">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-400">
            <UserCog className="h-4 w-4" aria-hidden="true" />
          </span>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-zinc-100">
            Meu Perfil
          </h1>
        </div>
        <p className="text-sm text-zinc-400">
          Gerencie suas informações pessoais, handles de programação competitiva e
          credenciais de acesso.
        </p>
      </header>

      <ProfileClient user={userData} />
    </div>
  );
}
