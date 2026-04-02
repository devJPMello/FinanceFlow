import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import type {
  TaxVisionSummary,
  AiInsightResult,
  TaxChecklistItem,
  TaxClassificationSuggestion,
  TaxDocumentTimelineItem,
  OcrAttachmentResult,
  WeeklySummaryResult,
  RecurringHint,
} from '../types';
import { formatCurrency, formatDate } from '../utils/format';
import {
  Sparkles,
  Landmark,
  AlertCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  Download,
  ExternalLink,
  Repeat,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getApiErrorWithRequestId } from '../lib/apiErrors';
import { TaxVisionSummarySkeleton } from '../components/LoadingSkeletons';

export default function TaxVision() {
  const [summary, setSummary] = useState<TaxVisionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [taxAiLoading, setTaxAiLoading] = useState(false);
  const [taxAi, setTaxAi] = useState<AiInsightResult | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [classification, setClassification] = useState<TaxClassificationSuggestion[]>([]);
  const [classificationLoading, setClassificationLoading] = useState(false);
  const [checklist, setChecklist] = useState<TaxChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [timeline, setTimeline] = useState<TaxDocumentTimelineItem[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [ocrAttachmentId, setOcrAttachmentId] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrAttachmentResult | null>(null);
  const [reportBusy, setReportBusy] = useState<'csv' | 'pdf' | null>(null);
  const [weekly, setWeekly] = useState<WeeklySummaryResult | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [recurring, setRecurring] = useState<RecurringHint[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<TaxVisionSummary>('/tax-insights/summary');
        if (!cancelled) setSummary(data);
      } catch (e: unknown) {
        if (!cancelled) toast.error(getApiErrorWithRequestId(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTaxAiInsight = async () => {
    if (!summary) return;
    try {
      setTaxAiLoading(true);
      setTaxAi(null);
      const { data } = await api.post<AiInsightResult>(
        '/ai-insights/tax-commentary',
        {},
        { params: { year: summary.year } },
      );
      setTaxAi(data);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      toast.error(
        typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(', ') : 'Erro ao gerar comentário IA',
      );
    } finally {
      setTaxAiLoading(false);
    }
  };

  const loadChecklist = useCallback(async () => {
    try {
      setChecklistLoading(true);
      const { data } = await api.get<{ year: number; items: TaxChecklistItem[] }>(
        '/ai-insights/taxvision/checklist',
        { params: { year } },
      );
      setChecklist(Array.isArray(data?.items) ? data.items : []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao carregar checklist');
    } finally {
      setChecklistLoading(false);
    }
  }, [year]);

  const loadClassification = useCallback(async () => {
    try {
      setClassificationLoading(true);
      const { data } = await api.get<{
        suggestions: TaxClassificationSuggestion[];
      }>('/ai-insights/taxvision/classification-suggestions', {
        params: { year, limit: 25 },
      });
      setClassification(Array.isArray(data?.suggestions) ? data.suggestions : []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao gerar sugestões');
    } finally {
      setClassificationLoading(false);
    }
  }, [year]);

  const loadTimeline = useCallback(async () => {
    try {
      setTimelineLoading(true);
      const { data } = await api.get<{ timeline: TaxDocumentTimelineItem[] }>(
        '/ai-insights/taxvision/document-timeline',
        { params: { year } },
      );
      setTimeline(Array.isArray(data?.timeline) ? data.timeline : []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao carregar timeline');
    } finally {
      setTimelineLoading(false);
    }
  }, [year]);

  const dismissClassification = async (transactionId: string) => {
    try {
      await api.post('/ai-insights/taxvision/suggestion-dismiss', {
        key: `tax-classify:${transactionId}`,
      });
      setClassification((prev) => prev.filter((s) => s.transactionId !== transactionId));
      toast.success('Sugestão oculta para este lançamento');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao ocultar sugestão');
    }
  };

  const downloadAccountantPackage = async () => {
    try {
      const { data } = await api.get('/accountant/package.zip', {
        params: { year },
        responseType: 'blob',
      });
      const blob = new Blob([data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financeflow-contador-${year}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Pacote ZIP gerado');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao gerar pacote');
    }
  };

  const applyDecision = async (
    transactionId: string,
    decision: 'accept' | 'reject',
  ) => {
    try {
      await api.post('/ai-insights/taxvision/classification-decision', {
        transactionId,
        decision,
      });
      setClassification((prev) =>
        prev.filter((s) => s.transactionId !== transactionId),
      );
      toast.success(decision === 'accept' ? 'Marcado como potencial IR' : 'Sugestão rejeitada');
      const { data } = await api.get<TaxVisionSummary>('/tax-insights/summary', {
        params: { year },
      });
      setSummary(data);
      loadChecklist();
      loadTimeline();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao aplicar decisão');
    }
  };

  const runOcr = async () => {
    if (!ocrAttachmentId.trim()) {
      toast.error('Informe um attachmentId para OCR');
      return;
    }
    try {
      setOcrLoading(true);
      setOcrResult(null);
      const { data } = await api.post<OcrAttachmentResult>(
        `/ai-insights/taxvision/ocr/${ocrAttachmentId.trim()}`,
      );
      setOcrResult(data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro no OCR');
    } finally {
      setOcrLoading(false);
    }
  };

  const openSuggestedTransaction = (transactionId: string) => {
    window.location.href = `/transactions#tx=${transactionId}`;
  };

  const downloadAudit = async (kind: 'csv' | 'pdf') => {
    try {
      setReportBusy(kind);
      const { data } = await api.get(`/ai-insights/taxvision/audit-report.${kind}`, {
        params: { year },
        responseType: 'blob',
      });
      const blob = new Blob([data], {
        type: kind === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taxvision-auditoria-${year}.${kind}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Relatório ${kind.toUpperCase()} gerado`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || `Erro ao gerar ${kind.toUpperCase()}`);
    } finally {
      setReportBusy(null);
    }
  };

  const loadWeeklySummary = async () => {
    try {
      setWeeklyLoading(true);
      const { data } = await api.get<WeeklySummaryResult>('/ai-insights/taxvision/weekly-summary');
      setWeekly(data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao gerar resumo semanal');
    } finally {
      setWeeklyLoading(false);
    }
  };

  const loadRecurring = async () => {
    try {
      setRecurringLoading(true);
      const { data } = await api.post<{ hints: RecurringHint[] }>('/ai-insights/taxvision/recurring-detect');
      setRecurring(Array.isArray(data?.hints) ? data.hints : []);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao detectar recorrências');
    } finally {
      setRecurringLoading(false);
    }
  };

  const markSubscription = async (transactionId: string) => {
    try {
      await api.post('/ai-insights/taxvision/mark-subscription', { transactionId, enabled: true });
      toast.success('Marcado como assinatura');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao marcar assinatura');
    }
  };

  const timelineCounts = useMemo(
    () =>
      timeline.reduce(
        (acc, t) => {
          acc[t.status] += 1;
          return acc;
        },
        { ok: 0, missing: 0, duplicate: 0, illegible: 0 } as Record<
          TaxDocumentTimelineItem['status'],
          number
        >,
      ),
    [timeline],
  );

  useEffect(() => {
    if (!loading) {
      void loadChecklist();
      void loadClassification();
      void loadTimeline();
    }
  }, [year, loading, loadChecklist, loadClassification, loadTimeline]);

  return (
    <div className="max-w-5xl rounded-2xl border border-amber-200/50 bg-gradient-to-b from-amber-50/40 via-white to-white px-3 py-5 sm:px-5 sm:py-7 shadow-[0_1px_2px_rgba(180,83,9,0.06)]">
    <div className="space-y-8 animate-fade-in">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-200/80">
            <Sparkles className="w-7 h-7 text-amber-700" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900">TaxVision</h1>
            <p className="text-gray-600 text-lg">Organização fiscal assistida por IA</p>
          </div>
        </div>
      </div>

      <div className="card-gradient border border-amber-100/80 bg-gradient-to-br from-white to-amber-50/30">
        <div className="flex items-start gap-3 mb-6">
          <Landmark className="w-6 h-6 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Check-up dedutível (ano atual)</h2>
            <p className="text-sm text-gray-600 mt-1">Total marcado como potencial dedução no IR.</p>
          </div>
        </div>

        {loading ? (
          <TaxVisionSummarySkeleton />
        ) : summary ? (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-white/90 border border-gray-100 shadow-sm">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Total marcado ({summary.year})
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2 tabular-nums">
                  {formatCurrency(summary.totalPotentialDeductibleExpenses)}
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-white/90 border border-gray-100 shadow-sm">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Lançamentos
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2 tabular-nums">
                  {summary.flaggedExpenseCount}
                </p>
              </div>
            </div>
            <div className="mt-5 flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-950">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{summary.disclaimer}</p>
            </div>
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <button
                type="button"
                onClick={loadTaxAiInsight}
                disabled={taxAiLoading}
                className="btn-secondary inline-flex items-center justify-center gap-2 text-sm py-2.5 px-4 border-violet-200 text-violet-900 hover:bg-violet-50 disabled:opacity-50 w-fit"
                title="Dicas gerais de organização; não é aconselhamento fiscal"
              >
                {taxAiLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-violet-600" />
                )}
                Dicas de organização com IA (Gemini)
              </button>
              <span className="text-xs text-gray-500">
                Usa apenas totais e contagem.
              </span>
            </div>
            {taxAi && (
              <div className="mt-4 p-4 rounded-xl bg-violet-50/80 border border-violet-100">
                <p className="text-xs font-medium text-violet-800 uppercase tracking-wide mb-2">
                  Comentário gerado · {taxAi.model}
                </p>
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{taxAi.text}</div>
                <p className="text-xs text-violet-700/80 mt-3">
                  Conteúdo gerado por IA — orientação geral. Não substitui contador, Receita Federal nem legislação.
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500">Sem dados para exibir.</p>
        )}
      </div>

      <div className="card-gradient">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Operações TaxVision / IA</h2>
            <p className="text-sm text-gray-600">Classificação, checklist e timeline.</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Ano</label>
            <input
              type="number"
              className="input-field w-28 py-2"
              value={year}
              onChange={(e) => setYear(Number(e.target.value || new Date().getFullYear()))}
            />
          </div>
        </div>

        <div className="grid xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Classificação fiscal assistida</h3>
              <button className="btn-secondary text-sm py-2 px-3" onClick={loadClassification}>
                Atualizar
              </button>
            </div>
            {classificationLoading ? (
              <p className="text-sm text-gray-500">A analisar transações…</p>
            ) : classification.length === 0 ? (
              <p className="text-sm text-gray-500">Sem sugestões pendentes.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-auto custom-scrollbar pr-1">
                {classification.map((s) => (
                  <div key={s.transactionId} className="rounded-lg border border-gray-100 bg-white p-3">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {s.description || 'Sem descrição'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {s.categoryName} · {formatDate(s.date)} · {formatCurrency(s.amount)}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Confiança: {Math.round((s.confidence || 0) * 100)}% · {s.reason}
                        </p>
                        {s.explainWhy ? (
                          <p className="text-xs text-gray-500 mt-1 border-l-2 border-amber-200 pl-2">
                            Por quê: {s.explainWhy}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          className="btn-secondary text-xs py-1.5 px-2"
                          onClick={() => applyDecision(s.transactionId, 'accept')}
                        >
                          Aceitar
                        </button>
                        <button
                          className="btn-secondary text-xs py-1.5 px-2"
                          onClick={() => applyDecision(s.transactionId, 'reject')}
                        >
                          Rejeitar
                        </button>
                        <button
                          type="button"
                          className="text-xs text-gray-500 hover:text-gray-800 py-1 px-2 text-left"
                          title="Não sugerir mais para este lançamento"
                          onClick={() => dismissClassification(s.transactionId)}
                        >
                          Não mostrar de novo
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Checklist fiscal anual</h3>
              <button className="btn-secondary text-sm py-2 px-3" onClick={loadChecklist}>
                Atualizar
              </button>
            </div>
            {checklistLoading ? (
              <p className="text-sm text-gray-500">A carregar checklist…</p>
            ) : (
              <div className="space-y-2">
                {checklist.map((item) => (
                  <div key={item.key} className="rounded-lg border border-gray-100 bg-white p-3 flex gap-3">
                    {item.status === 'ok' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-600">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Timeline de documentos</h3>
              <button className="btn-secondary text-sm py-2 px-3" onClick={loadTimeline}>
                Atualizar
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2">
              OK: {timelineCounts.ok} · Faltando: {timelineCounts.missing} · Duplicado: {timelineCounts.duplicate} · Ilegível: {timelineCounts.illegible}
            </p>
            {timelineLoading ? (
              <p className="text-sm text-gray-500">A carregar timeline…</p>
            ) : timeline.length === 0 ? (
              <p className="text-sm text-gray-500">Sem movimentos no período.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-auto custom-scrollbar pr-1">
                {timeline.slice(0, 40).map((t) => (
                  <div key={t.transactionId} className="rounded-lg border border-gray-100 bg-white p-3">
                    <div className="flex justify-between items-center gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{t.description}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(t.transactionDate)} · {t.categoryName} · {formatCurrency(t.amount)}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded border border-gray-200 bg-gray-100 text-gray-700 uppercase">
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <details className="rounded-xl border border-gray-100 bg-gray-50 p-4 group">
            <summary className="list-none cursor-pointer flex items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-900">Ver mais: OCR e relatórios</h3>
              <span className="text-xs text-gray-500 group-open:hidden">Expandir</span>
            </summary>
            <div className="mt-3">
            <div className="flex gap-2">
              <select
                className="input-field py-2"
                value={ocrAttachmentId}
                onChange={(e) => setOcrAttachmentId(e.target.value)}
              >
                <option value="">Selecione um anexo do baú fiscal…</option>
                {timeline
                  .filter((t) => t.attachments?.length)
                  .flatMap((t) =>
                    t.attachments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {formatDate(t.transactionDate)} · {t.description.slice(0, 40)} · {a.fileName}
                      </option>
                    )),
                  )}
              </select>
              <button className="btn-secondary text-sm py-2 px-3" onClick={runOcr} disabled={ocrLoading}>
                {ocrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}
              </button>
            </div>
            {ocrResult && (
              <div className="mt-3 rounded-lg border border-gray-100 bg-white p-3 text-sm">
                <p><strong>Documento:</strong> {ocrResult.ocr.documentType}</p>
                <p><strong>Estabelecimento:</strong> {ocrResult.ocr.merchant || '—'}</p>
                <p><strong>Valor:</strong> {ocrResult.ocr.amount != null ? formatCurrency(ocrResult.ocr.amount) : '—'}</p>
                <p><strong>Data:</strong> {ocrResult.ocr.date || '—'}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Sugestões de vínculo: {ocrResult.suggestedMatches.length}
                </p>
                {ocrResult.suggestedMatches.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {ocrResult.suggestedMatches.map((m) => (
                      <div key={m.transactionId} className="flex items-center justify-between gap-2">
                        <p className="text-xs text-gray-600 truncate">
                          {formatDate(m.date)} · {formatCurrency(m.amount)} · score {m.score}
                        </p>
                        <button
                          type="button"
                          className="btn-secondary text-xs py-1 px-2 inline-flex items-center gap-1"
                          onClick={() => openSuggestedTransaction(m.transactionId)}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Abrir transação
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="btn-secondary text-sm py-2 px-3 flex items-center gap-2"
                onClick={() => downloadAudit('csv')}
                disabled={reportBusy !== null}
              >
                <Download className="w-4 h-4" />
                {reportBusy === 'csv' ? 'Gerando...' : 'Relatório CSV'}
              </button>
              <button
                className="btn-secondary text-sm py-2 px-3 flex items-center gap-2"
                onClick={() => downloadAudit('pdf')}
                disabled={reportBusy !== null}
              >
                <Download className="w-4 h-4" />
                {reportBusy === 'pdf' ? 'Gerando...' : 'Relatório PDF'}
              </button>
              <button
                type="button"
                className="btn-primary text-sm py-2 px-3 flex items-center gap-2"
                onClick={() => void downloadAccountantPackage()}
                title="ZIP: CSV, PDF resumo, checklist e anexos por categoria (ano selecionado acima)"
              >
                <Download className="w-4 h-4" />
                Pacote contador (ZIP)
              </button>
            </div>
            </div>
          </details>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Resumo semanal IA</h3>
              <button className="btn-secondary text-sm py-2 px-3" onClick={loadWeeklySummary}>
                {weeklyLoading ? 'Gerando...' : 'Gerar'}
              </button>
            </div>
            {weekly ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Insights</p>
                  <ul className="text-sm text-gray-700 list-disc pl-4">
                    {weekly.insights.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Ações</p>
                  <ul className="text-sm text-gray-700 list-disc pl-4">
                    {weekly.actions.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Gere para receber 3 insights + 3 ações.</p>
            )}
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Recorrências / assinaturas</h3>
              <button className="btn-secondary text-sm py-2 px-3" onClick={loadRecurring}>
                {recurringLoading ? 'Analisando...' : 'Detectar'}
              </button>
            </div>
            {recurring.length === 0 ? (
              <p className="text-sm text-gray-500">Sem sugestões no momento.</p>
            ) : (
              <div className="space-y-2">
                {recurring.slice(0, 8).map((r) => (
                  <div key={r.transactionId} className="rounded-lg border border-gray-100 bg-white p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.description || r.signature}</p>
                      <p className="text-xs text-gray-500">Intervalo ~{r.intervalDays} dias · confiança {Math.round(r.score * 100)}%</p>
                    </div>
                    <button className="btn-secondary text-xs py-1.5 px-2 inline-flex items-center gap-1" onClick={() => markSubscription(r.transactionId)}>
                      <Repeat className="w-3.5 h-3.5" />
                      Marcar assinatura
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
