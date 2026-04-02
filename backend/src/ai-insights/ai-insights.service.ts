import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createHash, randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';
import PDFDocument = require('pdfkit');
import { CategoriesService } from '../categories/categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { TaxInsightsService } from '../tax-insights/tax-insights.service';
import { AuditService } from '../common/services/audit.service';

export interface AiInsightResult {
  text: string;
  model: string;
}

/** Movimento extraído por IA (PDF, imagem ou CSV) antes de gravar na BD */
export interface StatementMovementExtract {
  date: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  description: string;
  /** Nome livre sugerido para alinhar às categorias do utilizador */
  suggestedCategory?: string;
  /** Sugestão de potencial dedução IR (despesas); não é assessoria fiscal */
  suggestedDeductibleIrrf?: boolean;
}

/** @deprecated use StatementMovementExtract */
export type PdfStatementMovement = StatementMovementExtract;

export interface TaxClassificationSuggestion {
  transactionId: string;
  date: string;
  amount: number;
  description: string;
  categoryName: string;
  suggestedDeductible: boolean;
  confidence: number;
  reason: string;
  /** Texto curto: regras/heurísticas que sustentam a sugestão */
  explainWhy?: string;
}

export interface TaxChecklistItem {
  key: string;
  title: string;
  status: 'ok' | 'attention';
  detail: string;
  count?: number;
}

export interface TaxDocumentTimelineItem {
  transactionId: string;
  transactionDate: string;
  description: string;
  amount: number;
  categoryName: string;
  deductiblePotential: boolean;
  attachmentCount: number;
  attachments: Array<{ id: string; fileName: string }>;
  status: 'ok' | 'missing' | 'duplicate' | 'illegible';
}

export interface OcrReceiptData {
  documentType: string;
  merchant: string;
  amount: number | null;
  date: string | null;
  confidence: number;
}

export interface OcrTransactionMatch {
  transactionId: string;
  date: string;
  amount: number;
  description: string;
  score: number;
}

const STATEMENT_EXTRACT_JSON_PROMPT = `Analisa este documento: pode ser PDF de extrato bancário, imagem (foto ou captura de extrato, PIX, comprovativo) ou tabela CSV de movimentos.

Extrai cada linha de movimento (débito ou crédito) para um array JSON.

Regras estritas:
- Responde APENAS com um array JSON válido. Sem markdown, sem \`\`\`, sem texto antes ou depois.
- Cada objeto:
  {"date":"YYYY-MM-DD","amount": número positivo (valor absoluto),"type":"EXPENSE" ou "INCOME","description":"texto curto","suggestedCategory":"opcional — nome curto em português","suggestedDeductibleIrrf": opcional, só em EXPENSE no Brasil: true se puder ser dedução típica IRPF (saúde, educação formal, previdência privada qualificada, etc.), false se claramente não dedutível; omitir se incerto}
- EXPENSE = saída, débito, pagamento, compra, tarifa, PIX enviado. INCOME = entrada, crédito, depósito, salário, PIX recebido.
- amount é sempre positivo; o tipo indica despesa vs receita.
- Datas em ISO YYYY-MM-DD. Se só houver dia/mês, infere o ano pelo documento ou ano atual.
- description: até 200 caracteres, sem quebras de linha; se faltar texto, usa o resumo do estabelecimento ou da linha.
- Não incluas saldos ou totais agregados se já listas linhas detalhadas.
- Se não houver movimentos legíveis, devolve [].

Exemplo: [{"date":"2026-03-01","amount":49.9,"type":"EXPENSE","description":"Supermercado","suggestedCategory":"Alimentação","suggestedDeductibleIrrf":false}]`;

const RECEIPT_OCR_PROMPT = `Extrai campos de um comprovante/fatura/nota.

Responde APENAS com JSON válido no formato:
{
  "documentType": "recibo|nota fiscal|fatura|comprovante|outro",
  "merchant": "nome do estabelecimento (ou vazio)",
  "amount": number|null,
  "date": "YYYY-MM-DD"|null,
  "confidence": number (0 a 1)
}

Regras:
- Não inventar dados.
- amount deve ser número positivo quando existir.
- confidence reflete qualidade da leitura geral.
- Sem markdown, sem texto fora do JSON.
`;

@Injectable()
export class AiInsightsService {
  private readonly logger = new Logger(AiInsightsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
    private readonly taxInsightsService: TaxInsightsService,
    private readonly auditService: AuditService,
  ) {}

  private getGeminiModel(): {
    model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
    modelName: string;
  } {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key?.trim()) {
      throw new BadRequestException(
        'IA não configurada no servidor. Defina a variável GEMINI_API_KEY.',
      );
    }
    const modelName =
      this.config.get<string>('GEMINI_MODEL')?.trim() || 'gemini-2.5-flash';
    const genAI = new GoogleGenerativeAI(key.trim());
    return {
      model: genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.45,
        },
      }),
      modelName,
    };
  }

  /** Modelo com mais tokens para listas longas de movimentos em PDF */
  private getGeminiModelForPdfStatement(): {
    model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;
    modelName: string;
  } {
    const key = this.config.get<string>('GEMINI_API_KEY');
    if (!key?.trim()) {
      throw new BadRequestException(
        'IA não configurada no servidor. Defina GEMINI_API_KEY para importar PDF.',
      );
    }
    const modelName =
      this.config.get<string>('GEMINI_MODEL')?.trim() || 'gemini-2.5-flash';
    const genAI = new GoogleGenerativeAI(key.trim());
    return {
      model: genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.12,
        },
      }),
      modelName,
    };
  }

  private parseGeminiJson<T>(raw: string): T {
    let text = raw.trim();
    const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/im);
    if (fence) {
      text = fence[1].trim();
    }
    return JSON.parse(text) as T;
  }

  private yearRange(year?: number) {
    const y = year ?? new Date().getFullYear();
    const start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
    return { y, start, end };
  }

  private uploadsRoot() {
    return join(process.cwd(), 'uploads');
  }

  private dayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  private aiDailyLimit() {
    return Number(this.config.get<string>('AI_DAILY_LIMIT_PER_USER') || 60);
  }

  private aiBurstPerMinute() {
    return Number(this.config.get<string>('AI_BURST_PER_MINUTE_PER_ROUTE') || 12);
  }

  private async checkBurstOrThrow(userId: string, route: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(*)::int as c FROM ai_usage
       WHERE "userId" = $1 AND route = $2 AND "createdAt" > NOW() - INTERVAL '1 minute'`,
      userId,
      route,
    );
    if ((rows[0]?.c || 0) >= this.aiBurstPerMinute()) {
      throw new BadRequestException(
        'Muitas chamadas de IA por minuto nesta rota. Aguarde e tente de novo.',
      );
    }
  }

  async registerSuggestionDismissal(userId: string, key: string) {
    const k = key.trim().slice(0, 200);
    if (!k) throw new BadRequestException('Chave inválida');
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO user_suggestion_dismissals ("id","userId","key","createdAt")
       VALUES ($1,$2,$3,NOW())
       ON CONFLICT ("userId","key") DO NOTHING`,
      randomUUID(),
      userId,
      k,
    );
    return { ok: true };
  }

  private hashCacheKey(parts: unknown[]) {
    return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
  }

  private async checkQuotaOrThrow(userId: string, route: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(*)::int as c FROM ai_usage WHERE "userId" = $1 AND route = $2 AND "periodDay" = $3`,
      userId,
      route,
      this.dayKey(),
    );
    if ((rows[0]?.c || 0) >= this.aiDailyLimit()) {
      throw new BadRequestException('Limite diário de IA atingido para este usuário.');
    }
    await this.checkBurstOrThrow(userId, route);
  }

  private async readCached<T>(userId: string, route: string, cacheKey: string): Promise<T | null> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ responseJson: unknown }>>(
      `SELECT "responseJson"
       FROM ai_cached_responses
       WHERE "userId" = $1 AND route = $2 AND "cacheKey" = $3 AND "expiresAt" > NOW()
       LIMIT 1`,
      userId,
      route,
      cacheKey,
    );
    return (rows[0]?.responseJson as T) ?? null;
  }

  private async writeCached(userId: string, route: string, cacheKey: string, payload: unknown, ttlSec = 3600) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO ai_cached_responses
      ("id","userId","cacheKey","route","responseJson","expiresAt","createdAt")
      VALUES ($1,$2,$3,$4,$5::jsonb,NOW() + ($6 || ' seconds')::interval,NOW())
      ON CONFLICT ("userId","cacheKey","route")
      DO UPDATE SET "responseJson" = EXCLUDED."responseJson", "expiresAt" = EXCLUDED."expiresAt"`,
      randomUUID(),
      userId,
      cacheKey,
      route,
      JSON.stringify(payload),
      String(ttlSec),
    );
  }

  private async trackAiUsage(userId: string, route: string, model: string, textIn: string, textOut: string) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO ai_usage
      ("id","userId","route","model","tokensIn","tokensOut","costUsd","periodDay","createdAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      randomUUID(),
      userId,
      route,
      model,
      Math.ceil(textIn.length / 4),
      Math.ceil(textOut.length / 4),
      0,
      this.dayKey(),
    );
  }

  private normalizeExtractedMovement(item: unknown): StatementMovementExtract | null {
    if (!item || typeof item !== 'object') {
      return null;
    }
    const r = item as Record<string, unknown>;
    const dateStr = String(r.date ?? '').trim();
    const amount = Number(r.amount);
    const t = r.type;
    const type =
      t === 'INCOME' || t === 'EXPENSE'
        ? t
        : String(t).toUpperCase() === 'INCOME'
          ? 'INCOME'
          : String(t).toUpperCase() === 'EXPENSE'
            ? 'EXPENSE'
            : null;
    const suggestedRaw = r.suggestedCategory ?? r.categoryName;
    const suggestedCategory =
      suggestedRaw != null && String(suggestedRaw).trim()
        ? String(suggestedRaw).replace(/\s+/g, ' ').trim().slice(0, 120)
        : undefined;
    const dIr = r.suggestedDeductibleIrrf;
    let suggestedDeductibleIrrf: boolean | undefined;
    if (dIr === true || dIr === 'true') {
      suggestedDeductibleIrrf = true;
    } else if (dIr === false || dIr === 'false') {
      suggestedDeductibleIrrf = false;
    }
    let description = String(r.description ?? '').replace(/\s+/g, ' ').trim();
    if (!description && suggestedCategory) {
      description = suggestedCategory;
    }
    if (!description) {
      description = 'Movimento importado';
    }
    description = description.slice(0, 255);
    if (!type || !dateStr || !Number.isFinite(amount) || amount <= 0) {
      return null;
    }
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) {
      return null;
    }
    const iso = dateStr.match(/^\d{4}-\d{2}-\d{2}/)
      ? dateStr.slice(0, 10)
      : d.toISOString().slice(0, 10);
    return {
      date: iso,
      amount,
      type,
      description,
      suggestedCategory,
      suggestedDeductibleIrrf,
    };
  }

  private parseGeminiJsonMovementArray(raw: string): StatementMovementExtract[] {
    let t = raw.trim();
    const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/im);
    if (fence) {
      t = fence[1].trim();
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(t);
    } catch {
      throw new BadRequestException(
        'O modelo não devolveu JSON válido. Tente outro ficheiro ou verifique se o extrato é legível.',
      );
    }
    if (!Array.isArray(parsed)) {
      throw new BadRequestException(
        'Resposta da IA não é uma lista de movimentos. Confirme que o ficheiro contém linhas de transação.',
      );
    }
    const out: StatementMovementExtract[] = [];
    for (const item of parsed) {
      const row = this.normalizeExtractedMovement(item);
      if (row) {
        out.push(row);
      }
    }
    return out;
  }

  /**
   * PDF, imagem (JPEG/PNG/WebP/GIF) ou CSV (texto) via Gemini.
   */
  async extractBankTransactionsFromMedia(
    buffer: Buffer,
    mimeType: string,
    originalName: string,
  ): Promise<StatementMovementExtract[]> {
    if (!buffer?.length) {
      throw new BadRequestException('Ficheiro vazio');
    }

    const mime = (mimeType || '').toLowerCase();
    const name = (originalName || '').toLowerCase();
    const { model } = this.getGeminiModelForPdfStatement();

    const isCsv =
      mime === 'text/csv' ||
      mime === 'application/csv' ||
      (mime === 'text/plain' && name.endsWith('.csv')) ||
      (mime === 'application/vnd.ms-excel' && name.endsWith('.csv'));

    if (isCsv) {
      const maxCsv = 5 * 1024 * 1024;
      if (buffer.length > maxCsv) {
        throw new BadRequestException('CSV demasiado grande (máx. 5 MB)');
      }
      const text = buffer.toString('utf-8');
      const maxChars = 400_000;
      const slice = text.length > maxChars ? `${text.slice(0, maxChars)}\n...[truncado]` : text;
      try {
        const result = await model.generateContent([
          {
            text: `${STATEMENT_EXTRACT_JSON_PROMPT}\n\n---\nConteúdo CSV:\n${slice}`,
          },
        ]);
        const raw = result.response.text()?.trim();
        if (!raw) {
          throw new Error('Resposta vazia do modelo');
        }
        return this.parseGeminiJsonMovementArray(raw);
      } catch (err) {
        if (err instanceof HttpException) {
          throw err;
        }
        this.logger.warn(`Gemini CSV import: ${err instanceof Error ? err.message : err}`);
        throw new BadGatewayException(
          'Falha ao ler o CSV com o Gemini. Verifique GEMINI_API_KEY e quotas.',
        );
      }
    }

    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      const maxPdf = 12 * 1024 * 1024;
      if (buffer.length > maxPdf) {
        throw new BadRequestException('PDF demasiado grande (máx. 12 MB)');
      }
      const base64 = buffer.toString('base64');
      try {
        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: base64,
            },
          },
          { text: STATEMENT_EXTRACT_JSON_PROMPT },
        ]);
        const raw = result.response.text()?.trim();
        if (!raw) {
          throw new Error('Resposta vazia do modelo');
        }
        return this.parseGeminiJsonMovementArray(raw);
      } catch (err) {
        if (err instanceof HttpException) {
          throw err;
        }
        this.logger.warn(`Gemini PDF import: ${err instanceof Error ? err.message : err}`);
        throw new BadGatewayException(
          'Falha ao ler o PDF com o Gemini. Verifique GEMINI_API_KEY, quotas e se o ficheiro é válido.',
        );
      }
    }

    const allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const imageMime = allowedImages.includes(mime) ? mime : null;
    if (imageMime) {
      const maxImg = 8 * 1024 * 1024;
      if (buffer.length > maxImg) {
        throw new BadRequestException('Imagem demasiado grande (máx. 8 MB)');
      }
      try {
        const result = await model.generateContent([
          {
            inlineData: {
              mimeType: imageMime,
              data: buffer.toString('base64'),
            },
          },
          { text: STATEMENT_EXTRACT_JSON_PROMPT },
        ]);
        const raw = result.response.text()?.trim();
        if (!raw) {
          throw new Error('Resposta vazia do modelo');
        }
        return this.parseGeminiJsonMovementArray(raw);
      } catch (err) {
        if (err instanceof HttpException) {
          throw err;
        }
        this.logger.warn(`Gemini image import: ${err instanceof Error ? err.message : err}`);
        throw new BadGatewayException(
          'Falha ao ler a imagem com o Gemini. Verifique GEMINI_API_KEY e se a foto é nítida.',
        );
      }
    }

    throw new BadRequestException(
      'Formato não suportado. Envie CSV, PDF ou imagem (JPEG, PNG, WebP ou GIF).',
    );
  }

  async getTaxClassificationSuggestions(
    userId: string,
    year?: number,
    limit = 30,
  ): Promise<{ year: number; suggestions: TaxClassificationSuggestion[]; source: 'gemini' | 'heuristic' }> {
    const routeKey = 'taxvision.classification-suggestions';
    const { y, start, end } = this.yearRange(year);
    const take = Math.min(Math.max(limit || 30, 5), 100);
    const dismissedRows = await this.prisma.$queryRawUnsafe<Array<{ key: string }>>(
      `SELECT key FROM user_suggestion_dismissals WHERE "userId" = $1 AND key LIKE 'tax-classify:%'`,
      userId,
    );
    const dismissed = new Set(dismissedRows.map((r) => r.key));

    const txsAll = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: start, lte: end },
      },
      include: {
        category: { select: { name: true, suggestTaxDeductible: true } },
      },
      orderBy: { date: 'desc' },
      take: 250,
    });

    const txs = txsAll
      .filter((t) => !dismissed.has(`tax-classify:${t.id}`))
      .slice(0, take);

    if (txs.length === 0) {
      return { year: y, suggestions: [], source: 'heuristic' };
    }

    const rows = txs.map((t) => ({
      transactionId: t.id,
      date: t.date.toISOString().slice(0, 10),
      amount: Number(t.amount),
      description: t.description || '',
      categoryName: t.category?.name || '',
      currentlyFlagged: !!t.deductiblePotential,
      categorySuggests: !!t.category?.suggestTaxDeductible,
    }));

    const byCategory = new Map<
      string,
      { total: number; count: number; categorySuggestsDeductible: boolean }
    >();
    for (const r of rows) {
      const name = r.categoryName || '—';
      const prev = byCategory.get(name) || {
        total: 0,
        count: 0,
        categorySuggestsDeductible: false,
      };
      prev.total += r.amount;
      prev.count += 1;
      prev.categorySuggestsDeductible =
        prev.categorySuggestsDeductible || r.categorySuggests;
      byCategory.set(name, prev);
    }
    const categoryAggregates = Array.from(byCategory.entries())
      .map(([categoryName, v]) => ({
        categoryName,
        totalExpenses: Number(v.total.toFixed(2)),
        transactionCount: v.count,
        categoryFlaggedTaxVision: v.categorySuggestsDeductible,
      }))
      .sort((a, b) => b.totalExpenses - a.totalExpenses)
      .slice(0, 24);

    const topDetail = [...rows]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 15)
      .map((r) => ({
        transactionId: r.transactionId,
        date: r.date,
        amount: r.amount,
        category: r.categoryName,
        desc: r.description.slice(0, 80),
        alreadyFlagged: r.currentlyFlagged,
      }));

    const { model } = this.getGeminiModel();
    const prompt = [
      'Triagem assistida de despesas (Brasil): indica se cada transactionId PODE parecer potencial dedução de IR.',
      'Não és contador. Sem linguagem legal conclusiva.',
      'Contexto agregado por categoria (só totais — minimiza dados enviados):',
      JSON.stringify(categoryAggregates, null, 2),
      'Amostra das maiores despesas (use só estes IDs no JSON de saída):',
      JSON.stringify(topDetail, null, 2),
      'Responde APENAS JSON array:',
      '[{"transactionId":"...","suggestedDeductible":true|false,"confidence":0..1,"reason":"curto"}]',
      'Inclui só transactionId que aparecem na amostra acima.',
    ].join('\n');

    const cacheKey = this.hashCacheKey([routeKey, y, take, categoryAggregates, topDetail]);
    const cached = await this.readCached<{ year: number; suggestions: TaxClassificationSuggestion[]; source: 'gemini' | 'heuristic' }>(userId, routeKey, cacheKey);
    if (cached) return cached;

    const mapSuggestion = (
      r: (typeof rows)[0],
      ai?: { suggestedDeductible: boolean; confidence: number; reason: string },
    ): TaxClassificationSuggestion => {
      const fallback = this.heuristicTaxClassify(r.description, r.categoryName, r.amount);
      const reason = (ai?.reason || fallback.reason || '').slice(0, 220);
      const baseExplain = [
        r.categorySuggests ? 'A categoria está marcada como “revisão fiscal” na app.' : null,
        `Valor R$ ${r.amount.toFixed(2)} em ${r.date}.`,
        fallback.reason !== reason ? `Heurística local: ${fallback.reason}` : null,
      ]
        .filter(Boolean)
        .join(' ');
      return {
        transactionId: r.transactionId,
        date: r.date,
        amount: r.amount,
        description: r.description,
        categoryName: r.categoryName,
        suggestedDeductible: ai?.suggestedDeductible ?? fallback.suggestedDeductible,
        confidence: Math.max(
          0,
          Math.min(1, Number(ai?.confidence ?? fallback.confidence)),
        ),
        reason,
        explainWhy: baseExplain.slice(0, 400),
      };
    };

    try {
      await this.checkQuotaOrThrow(userId, routeKey);
      const result = await model.generateContent(prompt);
      const raw = result.response.text()?.trim();
      if (!raw) throw new Error('Resposta vazia');
      const parsed = this.parseGeminiJson<
        Array<{
          transactionId: string;
          suggestedDeductible: boolean;
          confidence: number;
          reason: string;
        }>
      >(raw);
      const map = new Map(parsed.map((p) => [p.transactionId, p]));
      const suggestions: TaxClassificationSuggestion[] = rows.map((r) =>
        mapSuggestion(r, map.get(r.transactionId)),
      );
      const out = { year: y, suggestions, source: 'gemini' as const };
      await this.writeCached(userId, routeKey, cacheKey, out, 1800);
      await this.trackAiUsage(userId, routeKey, this.config.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash', prompt, raw);
      return out;
    } catch (err) {
      this.logger.warn(
        `Gemini tax classify fallback: ${err instanceof Error ? err.message : err}`,
      );
      const suggestions: TaxClassificationSuggestion[] = rows.map((r) =>
        mapSuggestion(r),
      );
      return { year: y, suggestions, source: 'heuristic' };
    }
  }

  private heuristicTaxClassify(description: string, categoryName: string, amount: number) {
    const text = `${description} ${categoryName}`.toLowerCase();
    const deductibleKeywords = [
      'saude',
      'médico',
      'medico',
      'hospital',
      'clinica',
      'dentista',
      'educa',
      'escola',
      'faculdade',
      'curso',
      'dependente',
      'previdencia',
      'pensão',
      'pensao',
    ];
    const nonDeductibleKeywords = [
      'mercado',
      'supermercado',
      'restaurante',
      'lazer',
      'streaming',
      'uber',
      'combust',
      'ifood',
      'delivery',
    ];
    const hitDed = deductibleKeywords.some((k) => text.includes(k));
    const hitNonDed = nonDeductibleKeywords.some((k) => text.includes(k));
    if (hitDed && !hitNonDed) {
      return {
        suggestedDeductible: true,
        confidence: 0.78,
        reason: 'Descrição/categoria compatível com despesas potencialmente dedutíveis.',
      };
    }
    if (hitNonDed && !hitDed) {
      return {
        suggestedDeductible: false,
        confidence: 0.74,
        reason: 'Despesa de consumo comum, normalmente não usada como dedução.',
      };
    }
    return {
      suggestedDeductible: amount > 500 && hitDed,
      confidence: 0.52,
      reason: 'Pouco sinal textual; recomenda-se revisão manual.',
    };
  }

  async applyTaxClassificationDecision(
    userId: string,
    transactionId: string,
    decision: 'accept' | 'reject',
  ) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, userId, type: 'EXPENSE' },
      select: { id: true },
    });
    if (!tx) {
      throw new NotFoundException('Transação de despesa não encontrada');
    }
    const deductiblePotential = decision === 'accept';
    const prev = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { deductiblePotential: true },
    });
    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { deductiblePotential },
    });
    await this.auditService.log({
      userId,
      actorUserId: userId,
      entity: 'transaction',
      entityId: transactionId,
      action: 'tax-classification-decision',
      beforeJson: { deductiblePotential: prev?.deductiblePotential },
      afterJson: { deductiblePotential, decision },
    });
    return { transactionId, deductiblePotential };
  }

  async suggestCategoryWithLearning(
    userId: string,
    input: { description: string; type: 'INCOME' | 'EXPENSE' },
  ) {
    const pattern = input.description.trim().toLowerCase().slice(0, 80);
    if (!pattern) {
      throw new BadRequestException('Descrição em falta para sugestão');
    }
    const feedbacks = await this.prisma.$queryRawUnsafe<
      Array<{ categoryId: string; categoryName: string; acceptedCount: number }>
    >(
      `SELECT f."categoryId", c."name" as "categoryName", f."acceptedCount"
       FROM category_suggestion_feedbacks f
       JOIN categories c ON c."id" = f."categoryId"
       WHERE f."userId" = $1 AND f."type" = $2::"TransactionType" AND f."inputPattern" = $3
       ORDER BY f."acceptedCount" DESC
       LIMIT 5`,
      userId,
      input.type,
      pattern,
    );
    if (feedbacks.length > 0) {
      const best = feedbacks[0] as any;
      return {
        source: 'learning',
        categoryId: best.categoryId,
        categoryName: best.categoryName ?? best.category?.name,
        confidence: Math.min(0.98, 0.6 + Number(best.acceptedCount || 0) * 0.08),
      };
    }
    const category = await this.prisma.category.findFirst({
      where: { userId, type: input.type, name: { contains: pattern.split(' ')[0], mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (!category) return { source: 'heuristic', categoryId: null, categoryName: null, confidence: 0 };
    return {
      source: 'heuristic',
      categoryId: category.id,
      categoryName: category.name,
      confidence: 0.45,
    };
  }

  async registerCategorySuggestionFeedback(
    userId: string,
    payload: {
      description: string;
      type: 'INCOME' | 'EXPENSE';
      categoryId: string;
      decision: 'accept' | 'reject';
    },
  ) {
    const inputPattern = payload.description.trim().toLowerCase().slice(0, 80);
    if (!inputPattern) throw new BadRequestException('Descrição inválida');
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO category_suggestion_feedbacks
      ("id","userId","type","inputPattern","categoryId","acceptedCount","rejectedCount","lastUsedAt","createdAt","updatedAt")
      VALUES ($1,$2,$3::"TransactionType",$4,$5,$6,$7,NOW(),NOW(),NOW())
      ON CONFLICT ("userId","type","inputPattern","categoryId")
      DO UPDATE SET
        "acceptedCount" = category_suggestion_feedbacks."acceptedCount" + EXCLUDED."acceptedCount",
        "rejectedCount" = category_suggestion_feedbacks."rejectedCount" + EXCLUDED."rejectedCount",
        "lastUsedAt" = NOW(),
        "updatedAt" = NOW()`,
      randomUUID(),
      userId,
      payload.type,
      inputPattern,
      payload.categoryId,
      payload.decision === 'accept' ? 1 : 0,
      payload.decision === 'reject' ? 1 : 0,
    );
    return { ok: true };
  }

  async getWeeklyFinancialSummary(userId: string, weekStart?: string) {
    const routeKey = 'taxvision.weekly-summary';
    const start = weekStart ? new Date(`${weekStart}T00:00:00.000Z`) : new Date(Date.now() - 6 * 86400000);
    if (Number.isNaN(start.getTime())) throw new BadRequestException('weekStart inválido');
    const end = new Date(start.getTime() + 7 * 86400000);
    const txs = await this.prisma.transaction.findMany({
      where: { userId, date: { gte: start, lt: end } },
      include: { category: { select: { name: true } } },
      orderBy: { date: 'asc' },
    });
    const income = txs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
    const expense = txs.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);
    const byCategory = new Map<string, number>();
    txs.filter((t) => t.type === 'EXPENSE').forEach((t) => {
      const key = t.category?.name || 'Sem categoria';
      byCategory.set(key, (byCategory.get(key) || 0) + Number(t.amount));
    });
    const top = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const prompt = [
      'Com base nestes dados semanais, devolve JSON com exatamente 3 insights e 3 ações práticas.',
      'Formato: {"insights":["...","...","..."],"actions":["...","...","..."]}',
      JSON.stringify({ income, expense, net: income - expense, topCategories: top }, null, 2),
    ].join('\n');
    const cacheKey = this.hashCacheKey([routeKey, userId, start.toISOString().slice(0, 10), income, expense, top]);
    const cached = await this.readCached<{ weekStart: string; weekEnd: string; insights: string[]; actions: string[] }>(userId, routeKey, cacheKey);
    if (cached) return cached;
    const { model } = this.getGeminiModel();
    try {
      await this.checkQuotaOrThrow(userId, routeKey);
      const result = await model.generateContent(prompt);
      const raw = result.response.text()?.trim() || '';
      const parsed = this.parseGeminiJson<{ insights: string[]; actions: string[] }>(raw);
      const out = {
        weekStart: start.toISOString().slice(0, 10),
        weekEnd: end.toISOString().slice(0, 10),
        insights: (parsed.insights || []).slice(0, 3),
        actions: (parsed.actions || []).slice(0, 3),
      };
      await this.writeCached(userId, routeKey, cacheKey, out, 86400);
      await this.trackAiUsage(userId, routeKey, this.config.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash', prompt, raw);
      return out;
    } catch {
      return {
        weekStart: start.toISOString().slice(0, 10),
        weekEnd: end.toISOString().slice(0, 10),
        insights: [
          `Receitas ${income.toFixed(2)} e despesas ${expense.toFixed(2)} na semana.`,
          `Saldo semanal ${ (income - expense).toFixed(2)}.`,
          `Maior categoria de gasto: ${top[0]?.[0] || 'sem dados'}.`,
        ],
        actions: [
          'Revisar as 5 maiores despesas e confirmar categoria.',
          'Definir teto semanal para a categoria de maior gasto.',
          'Anexar comprovantes pendentes de despesas relevantes.',
        ],
      };
    }
  }

  async detectRecurringSubscriptions(userId: string) {
    const start = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    const txs = await this.prisma.transaction.findMany({
      where: { userId, type: 'EXPENSE', date: { gte: start } },
      orderBy: { date: 'asc' },
    });
    const groups = new Map<string, Array<{ id: string; date: Date; amount: number; description: string }>>();
    for (const t of txs) {
      const desc = (t.description || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 50);
      const amountBand = Math.round(Number(t.amount) * 2) / 2;
      const key = `${desc}:${amountBand}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push({ id: t.id, date: t.date, amount: Number(t.amount), description: t.description || '' });
    }
    const hints: Array<{ transactionId: string; signature: string; score: number; intervalDays: number; description: string }> = [];
    groups.forEach((arr, key) => {
      if (arr.length < 3) return;
      const intervals: number[] = [];
      for (let i = 1; i < arr.length; i++) {
        intervals.push(Math.abs(arr[i].date.getTime() - arr[i - 1].date.getTime()) / 86400000);
      }
      const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
      if (avg < 20 || avg > 40) return;
      const variance = intervals.reduce((s, v) => s + Math.abs(v - avg), 0) / intervals.length;
      const score = Math.max(0, 1 - variance / 10);
      hints.push({
        transactionId: arr[arr.length - 1].id,
        signature: key,
        score: Number(score.toFixed(2)),
        intervalDays: Math.round(avg),
        description: arr[arr.length - 1].description,
      });
    });
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM recurring_transaction_hints WHERE "userId" = $1`,
      userId,
    );
    if (hints.length) {
      for (const h of hints) {
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO recurring_transaction_hints
          ("id","userId","transactionId","signature","score","intervalDays","createdAt")
          VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
          randomUUID(),
          userId,
          h.transactionId,
          h.signature,
          h.score,
          h.intervalDays,
        );
      }
    }
    return { count: hints.length, hints };
  }

  async markAsSubscription(userId: string, transactionId: string, enabled = true) {
    const tx = await this.prisma.transaction.findFirst({ where: { id: transactionId, userId } });
    if (!tx) throw new NotFoundException('Transação não encontrada');
    await this.prisma.$executeRawUnsafe(
      `UPDATE transactions SET "isSubscription" = $1, "updatedAt" = NOW() WHERE id = $2`,
      enabled,
      transactionId,
    );
    return { transactionId, isSubscription: enabled };
  }

  async getTaxChecklist(userId: string, year?: number) {
    const { y, start, end } = this.yearRange(year);
    const txs = await this.prisma.transaction.findMany({
      where: { userId, type: 'EXPENSE', date: { gte: start, lte: end } },
      include: {
        category: { select: { id: true, name: true, suggestTaxDeductible: true } },
        attachments: { select: { id: true, fileName: true, fileSize: true } },
      },
    });

    const deductible = txs.filter((t) => t.deductiblePotential);
    const missingDocs = deductible.filter((t) => t.attachments.length === 0).length;
    const duplicateDocs = deductible.filter((t) => {
      const seen = new Set<string>();
      for (const a of t.attachments) {
        const key = `${a.fileName.toLowerCase()}::${a.fileSize}`;
        if (seen.has(key)) return true;
        seen.add(key);
      }
      return false;
    }).length;
    const illegeableDocs = deductible.filter((t) =>
      t.attachments.some((a) => a.fileSize < 15 * 1024),
    ).length;

    const categoriesWithExpenses = new Map<string, { name: string; reviewed: boolean }>();
    txs.forEach((t) => {
      if (t.category) {
        categoriesWithExpenses.set(t.category.id, {
          name: t.category.name,
          reviewed: !!t.category.suggestTaxDeductible,
        });
      }
    });
    const unreviewedCategories = Array.from(categoriesWithExpenses.values()).filter(
      (c) => !c.reviewed,
    ).length;

    const items: TaxChecklistItem[] = [
      {
        key: 'flagged-expenses',
        title: 'Despesas marcadas como potencial dedução',
        status: deductible.length > 0 ? 'ok' : 'attention',
        detail:
          deductible.length > 0
            ? `${deductible.length} lançamento(s) sinalizado(s)`
            : 'Nenhuma despesa marcada para revisão fiscal',
        count: deductible.length,
      },
      {
        key: 'missing-docs',
        title: 'Comprovantes faltando',
        status: missingDocs > 0 ? 'attention' : 'ok',
        detail:
          missingDocs > 0
            ? `${missingDocs} lançamento(s) marcados sem anexo`
            : 'Todos os lançamentos marcados têm anexo',
        count: missingDocs,
      },
      {
        key: 'duplicate-docs',
        title: 'Possíveis anexos duplicados',
        status: duplicateDocs > 0 ? 'attention' : 'ok',
        detail:
          duplicateDocs > 0
            ? `${duplicateDocs} lançamento(s) com anexos repetidos`
            : 'Sem duplicidades aparentes',
        count: duplicateDocs,
      },
      {
        key: 'illegible-docs',
        title: 'Comprovantes possivelmente ilegíveis',
        status: illegeableDocs > 0 ? 'attention' : 'ok',
        detail:
          illegeableDocs > 0
            ? `${illegeableDocs} lançamento(s) com anexos muito pequenos`
            : 'Sem sinais de ilegibilidade por tamanho',
        count: illegeableDocs,
      },
      {
        key: 'category-review',
        title: 'Categorias de despesa sem revisão TaxVision',
        status: unreviewedCategories > 0 ? 'attention' : 'ok',
        detail:
          unreviewedCategories > 0
            ? `${unreviewedCategories} categoria(s) com gastos no ano sem marcação de revisão fiscal`
            : 'Categorias usadas no período estão revisadas',
        count: unreviewedCategories,
      },
    ];

    return { year: y, items };
  }

  async getDocumentTimeline(userId: string, year?: number) {
    const { y, start, end } = this.yearRange(year);
    const txs = await this.prisma.transaction.findMany({
      where: { userId, type: 'EXPENSE', date: { gte: start, lte: end } },
      include: {
        category: { select: { name: true } },
        attachments: {
          select: { id: true, fileName: true, fileSize: true, mimeType: true },
        },
      },
      orderBy: { date: 'desc' },
      take: 300,
    });

    const timeline: TaxDocumentTimelineItem[] = txs.map((t) => {
      const atts = t.attachments || [];
      let status: TaxDocumentTimelineItem['status'] = 'ok';
      if (atts.length === 0) status = 'missing';
      else {
        const seen = new Set<string>();
        let hasDup = false;
        for (const a of atts) {
          const key = `${a.fileName.toLowerCase()}::${a.fileSize}`;
          if (seen.has(key)) {
            hasDup = true;
            break;
          }
          seen.add(key);
        }
        if (hasDup) status = 'duplicate';
        else if (
          atts.some(
            (a) =>
              a.fileSize < 15 * 1024 ||
              !(
                (a.mimeType || '').includes('pdf') ||
                (a.mimeType || '').startsWith('image/')
              ),
          )
        ) {
          status = 'illegible';
        }
      }
      return {
        transactionId: t.id,
        transactionDate: t.date.toISOString(),
        description: t.description || 'Sem descrição',
        amount: Number(t.amount),
        categoryName: t.category?.name || 'Sem categoria',
        deductiblePotential: !!t.deductiblePotential,
        attachmentCount: atts.length,
        attachments: atts.map((a) => ({ id: a.id, fileName: a.fileName })),
        status,
      };
    });

    return { year: y, timeline };
  }

  async ocrAttachment(userId: string, attachmentId: string) {
    const attachment = await this.prisma.transactionAttachment.findFirst({
      where: { id: attachmentId, transaction: { userId } },
      include: { transaction: true },
    });
    if (!attachment) throw new NotFoundException('Anexo não encontrado');
    const fullPath = join(this.uploadsRoot(), ...attachment.storagePath.split('/'));
    const buffer = await readFile(fullPath);
    const mimeType = attachment.mimeType || 'application/octet-stream';
    if (!mimeType.includes('pdf') && !mimeType.startsWith('image/')) {
      throw new BadRequestException('OCR suportado apenas para PDF ou imagem');
    }

    const { model } = this.getGeminiModelForPdfStatement();
    const raw = await model.generateContent([
      { inlineData: { mimeType, data: buffer.toString('base64') } },
      { text: RECEIPT_OCR_PROMPT },
    ]);
    const text = raw.response.text()?.trim();
    if (!text) throw new BadGatewayException('OCR sem resposta do modelo');

    let ocr: OcrReceiptData;
    try {
      const parsed = this.parseGeminiJson<{
        documentType?: string;
        merchant?: string;
        amount?: number | null;
        date?: string | null;
        confidence?: number;
      }>(text);
      ocr = {
        documentType: String(parsed.documentType || 'outro').slice(0, 80),
        merchant: String(parsed.merchant || '').slice(0, 120),
        amount: Number.isFinite(Number(parsed.amount)) ? Number(parsed.amount) : null,
        date: parsed.date ? String(parsed.date).slice(0, 10) : null,
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
      };
    } catch {
      throw new BadGatewayException('OCR devolveu JSON inválido');
    }

    const matches = await this.suggestTransactionMatchesFromOcr(userId, ocr);
    return {
      attachmentId,
      transactionId: attachment.transactionId,
      ocr,
      suggestedMatches: matches,
    };
  }

  private async suggestTransactionMatchesFromOcr(
    userId: string,
    ocr: OcrReceiptData,
  ): Promise<OcrTransactionMatch[]> {
    const start = ocr.date
      ? new Date(new Date(ocr.date).getTime() - 10 * 24 * 60 * 60 * 1000)
      : new Date(new Date().getTime() - 120 * 24 * 60 * 60 * 1000);
    const end = ocr.date
      ? new Date(new Date(ocr.date).getTime() + 10 * 24 * 60 * 60 * 1000)
      : new Date();

    const txs = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        date: { gte: start, lte: end },
      },
      select: { id: true, date: true, amount: true, description: true },
      orderBy: { date: 'desc' },
      take: 50,
    });

    const merchant = (ocr.merchant || '').toLowerCase();
    const targetDate = ocr.date ? new Date(ocr.date) : null;
    const out = txs
      .map((t) => {
        const amount = Number(t.amount);
        const amountDiff = ocr.amount != null ? Math.abs(amount - ocr.amount) : 999;
        const daysDiff =
          targetDate != null
            ? Math.abs(t.date.getTime() - targetDate.getTime()) / (24 * 60 * 60 * 1000)
            : 30;
        const desc = (t.description || '').toLowerCase();
        let score = 0;
        if (ocr.amount != null) score += Math.max(0, 70 - amountDiff * 10);
        score += Math.max(0, 20 - daysDiff * 2);
        if (merchant && desc.includes(merchant.slice(0, 8))) score += 20;
        return {
          transactionId: t.id,
          date: t.date.toISOString(),
          amount,
          description: t.description || 'Sem descrição',
          score: Math.round(score),
        };
      })
      .filter((m) => m.score > 10)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    return out;
  }

  async getAuditReportRows(userId: string, year?: number) {
    const { y, start, end } = this.yearRange(year);
    const txs = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: 'EXPENSE',
        deductiblePotential: true,
        date: { gte: start, lte: end },
      },
      include: {
        attachments: { select: { id: true } },
      },
      orderBy: { date: 'asc' },
    });

    const byMonth = new Map<number, { total: number; flagged: number; withDocs: number; missingDocs: number }>();
    for (const t of txs) {
      const month = t.date.getUTCMonth() + 1;
      if (!byMonth.has(month)) {
        byMonth.set(month, { total: 0, flagged: 0, withDocs: 0, missingDocs: 0 });
      }
      const row = byMonth.get(month)!;
      row.total += Number(t.amount);
      row.flagged += 1;
      if (t.attachments.length > 0) row.withDocs += 1;
      else row.missingDocs += 1;
    }
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const rows = months.map((m) => ({
      month: m,
      deductibleTotal: Number((byMonth.get(m)?.total || 0).toFixed(2)),
      flaggedCount: byMonth.get(m)?.flagged || 0,
      withDocuments: byMonth.get(m)?.withDocs || 0,
      missingDocuments: byMonth.get(m)?.missingDocs || 0,
    }));
    return { year: y, rows };
  }

  async getAuditReportCsv(userId: string, year?: number) {
    const data = await this.getAuditReportRows(userId, year);
    const lines = [
      'Ano,Mês,TotalPotencialDedutivel,QtdLancamentos,QtdComDocumento,QtdSemDocumento',
      ...data.rows.map(
        (r) =>
          `${data.year},${r.month},${r.deductibleTotal.toFixed(2)},${r.flaggedCount},${r.withDocuments},${r.missingDocuments}`,
      ),
    ];
    return lines.join('\n');
  }

  async getAuditReportPdfBuffer(userId: string, year?: number) {
    const data = await this.getAuditReportRows(userId, year);
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    doc.fontSize(18).text(`TaxVision - Relatório de auditoria (${data.year})`);
    doc.moveDown(0.5);
    doc
      .fontSize(10)
      .fillColor('#555')
      .text('Resumo mensal de despesas marcadas como potencial dedução e status documental.');
    doc.moveDown(1);
    doc.fillColor('#111');
    doc.fontSize(11).text('Mês | Total | Lanç. | Com doc | Sem doc');
    doc.moveDown(0.3);

    for (const r of data.rows) {
      const line = `${String(r.month).padStart(2, '0')}  |  ${r.deductibleTotal
        .toFixed(2)
        .padStart(10)}  |  ${String(r.flaggedCount).padStart(4)}  |  ${String(
        r.withDocuments,
      ).padStart(7)}  |  ${String(r.missingDocuments).padStart(7)}`;
      doc.fontSize(10).text(line);
    }
    doc.end();
    return done;
  }

  async forecastCommentary(userId: string): Promise<AiInsightResult> {
    const routeKey = 'forecast.commentary';
    const rows = await this.categoriesService.getExpenseForecast(userId);
    const { model, modelName } = this.getGeminiModel();

    const dados = rows.map((r) => ({
      categoria: r.categoryName,
      mediaMensal: r.averageMonthlyExpense,
      projecaoProximoMes: r.projectedNextMonthExpense,
      mesesComMovimento: r.monthsWithMovement,
      totalNoPeriodo: r.totalInPeriod,
      nTransacoes: r.transactionCount,
    }));

    const system = [
      'És um assistente financeiro pessoal. Responde sempre em português (Brasil ou Portugal), de forma clara e concisa.',
      'Os números abaixo foram calculados pela app (média por meses com movimento nos últimos ~3 meses). Não inventes valores nem categorias.',
      'Se a lista estiver vazia, explica que não há histórico suficiente e sugere registar despesas ou importar extrato (CSV/PDF/imagem).',
      'Não dês conselho de investimento. Máximo ~400 palavras. Usa markdown leve (títulos ##, listas).',
    ].join('\n');

    const user = `Dados agregados de previsão de despesas (JSON):\n${JSON.stringify(dados, null, 2)}\n\nAnalisa padrões, categorias a acompanhar e limitações desta projeção simples.`;
    const prompt = `${system}\n\n---\n\n${user}`;
    const cacheKey = this.hashCacheKey([routeKey, dados]);
    const cached = await this.readCached<AiInsightResult>(userId, routeKey, cacheKey);
    if (cached) return cached;

    try {
      await this.checkQuotaOrThrow(userId, routeKey);
      const result = await model.generateContent(prompt);
      const text = result.response.text()?.trim();
      if (!text) {
        throw new Error('Resposta vazia do modelo');
      }
      const out = { text, model: modelName };
      await this.writeCached(userId, routeKey, cacheKey, out, 3600);
      await this.trackAiUsage(userId, routeKey, modelName, prompt, text);
      return out;
    } catch (err) {
      if (err instanceof BadRequestException) {
        return {
          model: 'fallback',
          text:
            'Resumo indisponível por limite de IA no momento. Revise as três maiores categorias projetadas e ajuste o orçamento mensal para evitar estouro.',
        };
      }
      if (err instanceof HttpException) throw err;
      this.logger.warn(`Gemini forecast: ${err instanceof Error ? err.message : err}`);
      throw new BadGatewayException(
        'Não foi possível gerar o comentário com o Gemini. Verifique GEMINI_API_KEY, GEMINI_MODEL e quotas da API.',
      );
    }
  }

  async taxOrganizationCommentary(
    userId: string,
    year?: number,
  ): Promise<AiInsightResult> {
    const routeKey = 'tax.commentary';
    const summary = await this.taxInsightsService.getYearSummary(userId, year);
    const { model, modelName } = this.getGeminiModel();

    const system = [
      'És um assistente de organização fiscal para utilizadores no Brasil.',
      'IMPORTANTE: Não és contador nem advogado. Não afirmes que valores são dedutíveis no IR nem calcules imposto.',
      'O utilizador apenas marcou despesas como "potencial dedução" na app — isso é informativo.',
      'Dá dicas genéricas de organização (documentos a guardar, hábitos, conversar com contador, consultar Receita Federal).',
      'Inclui no início um aviso curto de que é orientação geral, não substitui profissional nem legislação.',
      'Responde em português. Máximo ~350 palavras. Markdown leve.',
    ].join('\n');

    const user = `Resumo marcado pelo utilizador no ano ${summary.year}:\n- Total das despesas assinaladas como potencial dedução: ${summary.totalPotentialDeductibleExpenses}\n- Número de lançamentos: ${summary.flaggedExpenseCount}\n\nTexto de disclaimer da app: ${summary.disclaimer}\n\nComenta de forma prática e conservadora.`;
    const prompt = `${system}\n\n---\n\n${user}`;
    const cacheKey = this.hashCacheKey([routeKey, summary.year, summary.totalPotentialDeductibleExpenses, summary.flaggedExpenseCount]);
    const cached = await this.readCached<AiInsightResult>(userId, routeKey, cacheKey);
    if (cached) return cached;

    try {
      await this.checkQuotaOrThrow(userId, routeKey);
      const result = await model.generateContent(prompt);
      const text = result.response.text()?.trim();
      if (!text) {
        throw new Error('Resposta vazia do modelo');
      }
      const out = { text, model: modelName };
      await this.writeCached(userId, routeKey, cacheKey, out, 3600);
      await this.trackAiUsage(userId, routeKey, modelName, prompt, text);
      return out;
    } catch (err) {
      if (err instanceof BadRequestException) {
        return {
          model: 'fallback',
          text:
            'Orientação fiscal em modo fallback: priorize anexar comprovantes, revisar marcações de potencial dedução e validar com contador antes de declarar.',
        };
      }
      if (err instanceof HttpException) throw err;
      this.logger.warn(`Gemini tax: ${err instanceof Error ? err.message : err}`);
      throw new BadGatewayException(
        'Não foi possível gerar o comentário com o Gemini. Verifique GEMINI_API_KEY, GEMINI_MODEL e quotas da API.',
      );
    }
  }
}
