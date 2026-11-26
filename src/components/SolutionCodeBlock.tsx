"use client";

import { AlertCircle, Check, Code2, Copy, Loader2, RotateCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getProblemSolutionCodeAction } from "@/actions/problems";
import { cn } from "@/lib/utils";

export interface SolutionCodeBlockProps {
  problemLogId: string;
  cachedCode?: string | null;
  onCodeLoaded?: (code: string | null) => void;
  maxHeightClass?: string;
}

/**
 * Fetches and renders pasted solution source code on demand with line numbers and 1-click copy.
 */
export function SolutionCodeBlock({
  problemLogId,
  cachedCode,
  onCodeLoaded,
  maxHeightClass = "max-h-[60vh]",
}: SolutionCodeBlockProps) {
  return (
    <SolutionCodeBlockContent
      key={problemLogId}
      problemLogId={problemLogId}
      cachedCode={cachedCode}
      onCodeLoaded={onCodeLoaded}
      maxHeightClass={maxHeightClass}
    />
  );
}

function SolutionCodeBlockContent({
  problemLogId,
  cachedCode,
  onCodeLoaded,
  maxHeightClass = "max-h-[60vh]",
}: SolutionCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(() => cachedCode === undefined);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(() =>
    cachedCode !== undefined ? cachedCode : null
  );
  const copyTimerRef = useRef<number | null>(null);
  const requestSeqRef = useRef(0);
  const hasInitialCacheRef = useRef(cachedCode !== undefined);
  const onCodeLoadedRef = useRef(onCodeLoaded);

  useEffect(() => {
    onCodeLoadedRef.current = onCodeLoaded;
  }, [onCodeLoaded]);

  const loadSolutionCode = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await getProblemSolutionCodeAction(problemLogId);
      if (requestSeqRef.current !== seq) return;

      if (result.error) {
        setError(result.error);
        setCode(null);
        return;
      }

      const fetched = result.solutionCode ?? null;
      setCode(fetched);
      onCodeLoadedRef.current?.(fetched);
    } catch {
      if (requestSeqRef.current !== seq) return;
      setError("Não foi possível carregar o código da solução.");
      setCode(null);
    } finally {
      if (requestSeqRef.current === seq) {
        setIsLoading(false);
      }
    }
  }, [problemLogId]);

  useEffect(() => {
    if (hasInitialCacheRef.current) return;

    let cancelled = false;
    const seq = ++requestSeqRef.current;

    void getProblemSolutionCodeAction(problemLogId)
      .then((result) => {
        if (cancelled || requestSeqRef.current !== seq) return;
        if (result.error) {
          setError(result.error);
          setCode(null);
          return;
        }
        const fetched = result.solutionCode ?? null;
        setCode(fetched);
        onCodeLoadedRef.current?.(fetched);
      })
      .catch(() => {
        if (cancelled || requestSeqRef.current !== seq) return;
        setError("Não foi possível carregar o código da solução.");
        setCode(null);
      })
      .finally(() => {
        if (!cancelled && requestSeqRef.current === seq) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [problemLogId]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const lines = useMemo(() => (code ? code.split("\n") : []), [code]);

  async function handleCopyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 2000);
    } catch {
      // Clipboard API unavailable or denied
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      {/* Code Toolbar */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2 text-zinc-400">
          <Code2 className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
          {isLoading ? (
            <span>Carregando código salvo...</span>
          ) : code ? (
            <span>
              Solução colada ·{" "}
              <strong className="font-mono font-medium text-zinc-200">
                {lines.length}
              </strong>{" "}
              {lines.length === 1 ? "linha" : "linhas"}
            </span>
          ) : (
            <span>Código da solução</span>
          )}
        </div>

        {!isLoading && code ? (
          <button
            type="button"
            onClick={() => void handleCopyCode()}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
              copied
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800"
            )}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Copiar código</span>
              </>
            )}
          </button>
        ) : null}
      </div>

      {/* Scrollable Code Block */}
      <div
        className={cn(
          "overflow-auto bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-200",
          maxHeightClass
        )}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2.5 py-14 text-zinc-400">
            <Loader2
              className="h-6 w-6 animate-spin text-indigo-400"
              aria-hidden="true"
            />
            <span className="font-sans text-xs">
              Carregando código da solução...
            </span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center font-sans">
            <AlertCircle
              className="h-7 w-7 text-rose-400"
              aria-hidden="true"
            />
            <p className="text-sm text-rose-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadSolutionCode()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tentar novamente</span>
            </button>
          </div>
        ) : !code ? (
          <div className="py-12 text-center font-sans text-sm text-zinc-400">
            Nenhum código de solução cadastrado para esta questão.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-zinc-900/50">
                  <td className="w-10 pr-4 text-right align-top text-zinc-600 select-none">
                    {idx + 1}
                  </td>
                  <td className="whitespace-pre text-zinc-100">
                    {line.length > 0 ? line : " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
