// Supabase Edge Function: POST { text } -> USDA-backed meal estimate for review.
// Secrets (supabase secrets set ...): MISTRAL_API_KEY, USDA_FDC_API_KEY,
// optional MISTRAL_AGENT_ID (use a Mistral Studio agent) and MISTRAL_MODEL.
// This function never writes diary data; the client logs reviewed items via log_usda_foods.
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  MAX_TEXT_LENGTH, MealAgentError, USDA_SEARCH_TOOL, runMealAgent, searchUsda,
  type ChatMessage, type FetchFn, type UsdaCandidate,
} from '../_shared/meal-agent.ts'

const HOURLY_LIMIT = 30

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
const fail = (status: number, code: string, message: string) => json(status, { error: { code, message } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.')

  const mistralKey = Deno.env.get('MISTRAL_API_KEY')
  const usdaKey = Deno.env.get('USDA_FDC_API_KEY')
  if (!mistralKey || !usdaKey) {
    return fail(503, 'not_configured', 'Meal estimates are not set up yet. Add MISTRAL_API_KEY and USDA_FDC_API_KEY to the Edge Function secrets.')
  }

  const authorization = req.headers.get('Authorization')
  if (!authorization) return fail(401, 'unauthorized', 'Sign in to use meal estimates.')
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return fail(401, 'unauthorized', 'Your session has expired. Sign in again.')

  let text: string
  try {
    const body = await req.json()
    text = typeof body?.text === 'string' ? body.text.trim() : ''
  } catch {
    return fail(400, 'bad_request', 'Send JSON: { "text": "..." }.')
  }
  if (!text) return fail(400, 'bad_request', 'Describe what you ate.')
  if (text.length > MAX_TEXT_LENGTH) return fail(400, 'bad_request', `Keep the description under ${MAX_TEXT_LENGTH} characters.`)

  // Rate limit runs as the user (RLS), so usage is recorded against their account.
  const { data: allowed, error: limitError } = await supabase.rpc('consume_ai_request', { p_kind: 'meal_estimate', p_hourly_limit: HOURLY_LIMIT })
  if (limitError) return fail(500, 'rate_limit_failed', 'Could not check usage limits. Try again.')
  if (!allowed) return fail(429, 'rate_limited', `You can request up to ${HOURLY_LIMIT} meal estimates per hour. Try again later.`)

  const agentId = Deno.env.get('MISTRAL_AGENT_ID')
  const model = Deno.env.get('MISTRAL_MODEL') ?? 'mistral-medium-latest'
  const fetchFn = fetch as unknown as FetchFn

  const chat = async (messages: ChatMessage[]) => {
    const common = { messages, tools: [USDA_SEARCH_TOOL], tool_choice: 'auto', response_format: { type: 'json_object' } }
    const url = agentId ? 'https://api.mistral.ai/v1/agents/completions' : 'https://api.mistral.ai/v1/chat/completions'
    const body = agentId ? { agent_id: agentId, ...common } : { model, temperature: 0.1, ...common }
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mistralKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error('Mistral error', res.status, (await res.text()).slice(0, 500))
      throw new MealAgentError('agent_failed', 'The meal assistant is unavailable right now. Try again shortly.')
    }
    const data = await res.json()
    const message = data?.choices?.[0]?.message ?? {}
    return { content: typeof message.content === 'string' ? message.content : '', tool_calls: message.tool_calls }
  }

  const cache = new Map<string, UsdaCandidate[]>()
  const search = async (query: string) => {
    const key = query.trim().toLowerCase()
    if (!cache.has(key)) cache.set(key, await searchUsda(key, usdaKey, fetchFn))
    return cache.get(key)!
  }

  try {
    const estimate = await runMealAgent(text, chat, search)
    return json(200, { ...estimate, source: 'USDA FoodData Central', model: agentId ? `agent:${agentId}` : model })
  } catch (error) {
    if (error instanceof MealAgentError) {
      return fail(error.code === 'usda_failed' ? 502 : 422, error.code, error.message)
    }
    console.error(error)
    return fail(500, 'internal', 'Something went wrong while estimating the meal.')
  }
})
