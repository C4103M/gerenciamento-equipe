"use client";

import { Plus, Send } from "lucide-react";
import { useState } from "react";
import { ProblemFormModal } from "@/components/ProblemFormModal";
import { ProposeProblemModal } from "@/components/ProposeProblemModal";
import type { MemberSummary, TopicItem } from "@/types";

export interface DashboardClientProps {
  topics: TopicItem[];
  teammates: MemberSummary[];
}

/** Quick action buttons and modal controllers for the team dashboard header. */
export function DashboardClient({ topics, teammates }: DashboardClientProps) {
  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [proposeModalOpen, setProposeModalOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => setProblemModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>+ Registrar Questão</span>
        </button>

        <button
          type="button"
          onClick={() => setProposeModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-100 transition-colors hover:border-indigo-500/50 hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Send className="h-4 w-4 text-indigo-400" aria-hidden="true" />
          <span>+ Propor Problema</span>
        </button>
      </div>

      <ProblemFormModal
        open={problemModalOpen}
        onClose={() => setProblemModalOpen(false)}
        topics={topics}
        initialProblem={null}
      />

      <ProposeProblemModal
        open={proposeModalOpen}
        onClose={() => setProposeModalOpen(false)}
        teammates={teammates}
        topics={topics}
      />
    </>
  );
}
