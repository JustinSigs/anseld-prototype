// ============================================================
// Claude API client — direct from the browser (personal
// prototype; the key never leaves this machine). Tracks every
// call and its cost for the designer panel's run log.
// ============================================================

export interface AiCallLogEntry {
  at: string; // ISO time
  kind: 'storyteller' | 'clerk' | 'generator';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  summary: string;
}

/** USD per million tokens: [input, output]. */
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-4-5-20251001': [1, 5],
  'claude-sonnet-5': [3, 15],
  'claude-opus-4-8': [10, 40],
};

function priceFor(model: string): [number, number] {
  for (const key of Object.keys(PRICES)) {
    if (model.startsWith(key) || key.startsWith(model)) return PRICES[key];
  }
  return [3, 15]; // conservative default
}

export class ClaudeClient {
  readonly log: AiCallLogEntry[] = [];
  /** Stop reason of the most recent call — 'max_tokens' means the reply was cut off. */
  lastStopReason: string | null = null;

  constructor(private apiKey: string) {}

  totalCostUsd(): number {
    return this.log.reduce((s, e) => s + e.costUsd, 0);
  }

  async complete(params: {
    kind: AiCallLogEntry['kind'];
    model: string;
    system: string;
    user: string;
    maxTokens: number;
    summary: string;
  }): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: params.model,
        max_tokens: params.maxTokens,
        system: params.system,
        messages: [{ role: 'user', content: params.user }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Claude API error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = await res.json();
    this.lastStopReason = data.stop_reason ?? null;
    const text: string = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');

    const inputTokens = data.usage?.input_tokens ?? 0;
    const outputTokens = data.usage?.output_tokens ?? 0;
    const [inP, outP] = priceFor(params.model);
    this.log.push({
      at: new Date().toISOString(),
      kind: params.kind,
      model: params.model,
      inputTokens,
      outputTokens,
      costUsd: (inputTokens * inP + outputTokens * outP) / 1_000_000,
      summary: params.summary,
    });

    return text;
  }

  /**
   * Complete and parse a JSON reply. A reply cut off at the token limit
   * retries with double the room; a malformed reply retries once with the
   * parse error appended. Then fail loudly — the Referee never accepts garbage.
   */
  async completeJson<T>(params: Parameters<ClaudeClient['complete']>[0]): Promise<T> {
    let call = { ...params };
    let raw = await this.complete(call);
    for (let attempt = 0; attempt < 3; attempt++) {
      if (this.lastStopReason === 'max_tokens') {
        if (attempt === 2) throw new Error(`AI reply still truncated at ${call.maxTokens} tokens.`);
        call = { ...call, maxTokens: call.maxTokens * 2, summary: call.summary + ' (more room)' };
        raw = await this.complete(call);
        continue;
      }
      try {
        return JSON.parse(stripFences(raw)) as T;
      } catch (err) {
        if (attempt === 2) throw new Error(`Unparseable AI reply after retry: ${String(err)}\n---\n${raw.slice(0, 500)}`);
        raw = await this.complete({
          ...call,
          user:
            call.user +
            `\n\nYour previous reply was not valid JSON (${String(err)}). Reply again with ONLY valid JSON, no code fences, no commentary.`,
          summary: call.summary + ' (retry)',
        });
      }
    }
    throw new Error('unreachable');
  }
}

function stripFences(s: string): string {
  const t = s.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m ? m[1] : t;
}
