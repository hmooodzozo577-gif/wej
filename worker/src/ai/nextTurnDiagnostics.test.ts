import { describe, expect, it } from 'vitest';
import { handleRequest, type Env } from '../index';

const origin = 'https://hmooodzozo577-gif.github.io';
const requestBody = {
  lang: 'ar', purposeName: 'Tourism', turnNumber: 1,
  confirmedProfile: { climate: 'cold' },
  catalog: [
    { id: 'climate', kind: 'climate', question: 'What climate do you prefer?', rankingSupported: true, resolved: true, alreadyAsked: true, options: [{ value: 'cold', label: 'Cold' }] },
    { id: 'budget', kind: 'target', question: 'What is your approximate budget?', rankingSupported: true, resolved: false, alreadyAsked: false, options: [{ value: 1, label: 'Low' }, { value: 2, label: 'Medium' }] },
  ],
};
const validTurn = {
  status: 'ask', questionType: 'choice', targetDimensions: ['budget'], prompt: 'Which cost level suits you?',
  options: [{ id: 'low', label: 'Low', updates: { budget: 1 } }],
};
const privateMarker = 'PRIVATE_MODEL_TEXT_MUST_NEVER_LEAVE_WORKER';

async function callNextTurn(content: unknown, finishReason = 'stop') {
  const env = {
    AI: { run: async () => ({ choices: [{ message: { role: 'assistant', content }, finish_reason: finishReason }] }) },
  } as unknown as Env;
  return handleRequest(new Request('https://worker.example/api/ai/next-turn', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(requestBody),
  }), env);
}

describe('Capability C production diagnostics through the HTTP, adapter and validation pipeline', () => {
  it.each([
    { name: 'missing model content', content: null, reason: 'output_empty' },
    { name: 'malformed JSON', content: privateMarker, reason: 'output_json' },
    { name: 'token-limited incomplete JSON', content: '{"status":"ask",', finish: 'length', reason: 'output_truncated' },
    { name: 'invalid decision shape', content: JSON.stringify({ status: privateMarker, diagnostic: privateMarker }), reason: 'decision_shape' },
    { name: 'unknown question type', content: JSON.stringify({ ...validTurn, questionType: privateMarker }), reason: 'question_type' },
    { name: 'already-resolved target', content: JSON.stringify({ ...validTurn, targetDimensions: ['climate'] }), reason: 'target_dimensions' },
    { name: 'oversized question', content: JSON.stringify({ ...validTurn, prompt: privateMarker.repeat(12) }), reason: 'question_prompt' },
    { name: 'empty option updates', content: JSON.stringify({ ...validTurn, options: [{ id: 'x', label: privateMarker, updates: {} }] }), reason: 'choice_options' },
    { name: 'invented option values', content: JSON.stringify({ ...validTurn, options: [{ id: 'x', label: privateMarker, updates: { budget: 999 } }] }), reason: 'choice_options' },
  ])('distinguishes $name without publishing model content', async ({ content, finish, reason }) => {
    const response = await callNextTurn(content, finish);
    expect(response.status).toBe(502);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    const body = await response.json();
    expect(body).toEqual({ error: 'ai_provider_error', message: 'The AI service returned an unexpected response.', diagnostic: reason });
    expect(JSON.stringify(body)).not.toContain(privateMarker);
  });

  it('preserves the validated success response without diagnostic or raw provider fields', async () => {
    const response = await callNextTurn(JSON.stringify({ ...validTurn, diagnostic: privateMarker }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(validTurn);
  });
});
