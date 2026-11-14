export interface Env {
  GROQ_API_KEY: string;
  ALLOWED_ORIGIN?: string;
  ASSETS: Fetcher;
}

interface AgentNode {
  id: string;
  role: string;
  task: string;
  dependsOn: string[];
}

interface Plan {
  nodes: AgentNode[];
}

const DEFAULT_ALLOWED_ORIGIN = '*';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

function corsHeaders(env: Env): HeadersInit {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin'
  };
}

function jsonResponse(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = corsHeaders(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const { pathname } = new URL(request.url);

    if (pathname === '/api/plan' || pathname === '/api/execute-node') {
      if (request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405, headers);
      }

      if (!env.GROQ_API_KEY) {
        return jsonResponse({ error: 'Worker is missing its GROQ_API_KEY secret' }, 503, headers);
      }

      const body = await readJson(request);
      if (!body) {
        return jsonResponse({ error: 'Request body must be a valid JSON object' }, 400, headers);
      }

      try {
        if (pathname === '/api/plan') {
          const goal = typeof body.goal === 'string' ? body.goal.trim() : '';
          if (!goal) {
            return jsonResponse({ error: 'A non-empty goal is required' }, 400, headers);
          }

          const systemPrompt = `Você é o Núcleo Orquestrador do SYNAPSE OS.
Dado um objetivo do usuário, quebre-o em 4 a 6 sub-tarefas especializadas formando um grafo de execução (DAG).
Responda APENAS com um JSON válido no formato:
{
  "nodes": [
    { "id": "node-1", "role": "Arquiteto de Produto", "task": "Descrição objetiva da tarefa", "dependsOn": [] },
    { "id": "node-2", "role": "Engenheiro Fullstack", "task": "Descrição objetiva", "dependsOn": ["node-1"] }
  ]
}`;

          const result = await callGroq(env.GROQ_API_KEY, systemPrompt, goal, true);
          let plan: Plan;
          try {
            plan = JSON.parse(result) as Plan;
          } catch {
            return jsonResponse({ error: 'The model returned an invalid plan' }, 502, headers);
          }

          if (!plan || !Array.isArray(plan.nodes)) {
            return jsonResponse({ error: 'The model returned a plan with an invalid shape' }, 502, headers);
          }

          return jsonResponse(plan, 200, headers);
        }

        const role = typeof body.role === 'string' ? body.role.trim() : '';
        const task = typeof body.task === 'string' ? body.task.trim() : '';
        const context = typeof body.context === 'string' ? body.context : '';
        if (!role || !task) {
          return jsonResponse({ error: 'Non-empty role and task fields are required' }, 400, headers);
        }

        const systemPrompt = `Você é um ${role} de elite no SYNAPSE OS.
Execute a tarefa solicitada entregando resultado prático, técnico, código ou plano acionável. Sem enrolação.`;
        const userPrompt = `Contexto dos agentes anteriores:\n${context || 'Nenhum'}\n\nSua tarefa:\n${task}`;
        const output = await callGroq(env.GROQ_API_KEY, systemPrompt, userPrompt, false);
        return jsonResponse({ output }, 200, headers);
      } catch {
        return jsonResponse({ error: 'The upstream AI service request failed' }, 502, headers);
      }
    }

    if (pathname.startsWith('/api/')) {
      return jsonResponse({ error: 'Not found' }, 404, headers);
    }

    return env.ASSETS.fetch(request);
  }
};

async function callGroq(
  apiKey: string,
  system: string,
  user: string,
  jsonMode: boolean
): Promise<string> {
  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      temperature: 0.4,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
    })
  });

  if (!response.ok) {
    throw new Error(`Groq returned status ${response.status}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Groq returned an empty response');
  }

  return content;
}
