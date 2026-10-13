# Mistral Studio agent for meal estimates (optional)

The `meal-estimate` Edge Function works with plain chat completions (`MISTRAL_MODEL`, default
`mistral-medium-latest`). To manage the model from **Mistral AI Studio > Agents > Create Agent**
instead:

1. **Model:** Mistral Medium (`mistral-medium-latest`). Set temperature low (0.1–0.3).
2. **Response format:** JSON.
3. **Instructions:** paste the text below. The Edge Function also sends these instructions as a
   system message on every request, so the output contract holds even if the Studio text changes.
4. **Capabilities:** none. Do not enable web search or code. The function supplies its own
   `search_usda_foods` tool on each request.
5. Copy the agent ID and set it as a secret:
   `npx supabase secrets set MISTRAL_AGENT_ID=ag_...`

Note: Mistral's docs list `/v1/agents/completions` under "Deprecated". It still accepts `agent_id`,
`messages`, `tools` and `response_format`. If it is retired, unset `MISTRAL_AGENT_ID` and the
function falls back to chat completions.

## Instructions to paste

See `MEAL_AGENT_INSTRUCTIONS` in `supabase/functions/_shared/meal-agent.ts` (single source of
truth). Copy the template string's contents into the Studio "Instructions" box.
