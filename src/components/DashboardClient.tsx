"use client";

import { Plus, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PeriodFilterButton } from "@/components/PeriodFilterButton";
import { ProblemFormModal } from "@/components/ProblemFormModal";
import { ProposeProblemModal } from "@/components/ProposeProblemModal";
import { buildPeriodQueryString, type PeriodFilterValue } from "@/lib/period";
import type { MemberSummary, TopicItem } from "@/types";

export interface DashboardClientProps {
  topics: TopicItem[];
  teammates: MemberSummary[];
  periodFilter: PeriodFilterValue;
}

/** Quick action buttons and modal controllers for the team dashboard header. */
export function DashboardClient({
  topics,
  teammates,
  periodFilter,
}: DashboardClientProps) {
  const router = useRouter();
  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [proposeModalOpen, setProposeModalOpen] = useState(false);

  function handlePeriodChange(next: PeriodFilterValue) {
    const qs = buildPeriodQueryString(next);
    router.push(qs ? `/${qs}` : "/");
  }

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

        <PeriodFilterButton
          value={periodFilter}
          onChange={handlePeriodChange}
          variant="header"
          align="right"
        />

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
