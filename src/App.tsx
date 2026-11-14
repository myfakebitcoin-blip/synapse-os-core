import { useState } from 'react';

const WORKER_URL = (
  import.meta.env.VITE_WORKER_URL || 'https://synapse-brain-worker.myfakebitcoin.workers.dev'
).trim().replace(/\/+$/, '');

interface PlanNode {
  id: string;
  role: string;
  task: string;
  dependsOn: string[];
}

function App() {
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState<PlanNode[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const createPlan = async () => {
    const trimmedGoal = goal.trim();
    if (!trimmedGoal || loading) return;

    setLoading(true);
    setError('');
    setPlan(null);
    try {
      const response = await fetch(`${WORKER_URL}/api/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: trimmedGoal })
      });
      const data = await response.json() as { nodes?: PlanNode[]; error?: string };
      if (!response.ok) throw new Error(data.error || `Worker respondeu com HTTP ${response.status}.`);
      if (!Array.isArray(data.nodes)) throw new Error('O Worker retornou um plano inválido.');
      setPlan(data.nodes);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao conectar com o Worker.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="shell">
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      <section className="panel">
        <span className="eyebrow">SYNAPSE OS</span>
        <h1>Planeje com seu enxame de agentes</h1>
        <p>Descreva um objetivo para solicitar ao Worker um plano de execução.</p>
        <form onSubmit={(event) => { event.preventDefault(); void createPlan(); }}>
          <label htmlFor="goal">Objetivo</label>
          <textarea
            id="goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="Ex.: Planejar o lançamento de um produto..."
            rows={4}
            required
          />
          <button type="submit" disabled={loading || !goal.trim()}>
            {loading ? 'Conectando...' : 'Gerar plano'}
          </button>
        </form>
        {error && <p role="alert">Erro ao chamar o Worker: {error}</p>}
        {plan && (
          <ol aria-label="Plano de execução">
            {plan.map((node) => (
              <li key={node.id}>
                <strong>{node.role}</strong>: {node.task}
                {node.dependsOn.length > 0 && <small> (depende de: {node.dependsOn.join(', ')})</small>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

export default App;
