import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Share2, Sparkles } from 'lucide-react';
import { AccountPanel } from './components/AccountPanel';
import { SynapticNode } from './components/SynapticNode';
import { useSupabaseRoom } from './lib/useSupabaseRoom';
import { useAuthStore } from './store/useAuthStore';
import { useSynapseStore } from './store/useSynapseStore';

const nodeTypes = { synaptic: SynapticNode };
const WORKER_URL = (
  import.meta.env.VITE_WORKER_URL || 'https://synapse-os-core.myfakebitcoin.workers.dev'
).trim().replace(/\/+$/, '');

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [shareMessage, setShareMessage] = useState('');
  const { nodes, edges, roomName, isOrchestrating, executionLog, onNodesChange, onEdgesChange, connectRoom, orchestrateGoal } = useSynapseStore();
  const user = useAuthStore((state) => state.user);
  const presence = useSupabaseRoom(roomName, user);

  useEffect(() => {
    const syncRoomFromHash = () => connectRoom(window.location.hash);
    window.addEventListener('hashchange', syncRoomFromHash);
    return () => window.removeEventListener('hashchange', syncRoomFromHash);
  }, [connectRoom]);

  const handleShareRoom = useCallback(async () => {
    let nextRoom = roomName;
    if (roomName === 'synapse-global-room') {
      nextRoom = `synapse-${Math.random().toString(36).slice(2, 8)}`;
      window.location.hash = nextRoom;
    }
    connectRoom(nextRoom);

    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage('Link da sala copiado para compartilhar.');
    } catch {
      setShareMessage(`Compartilhe este link: ${window.location.href}`);
    }
  }, [connectRoom, roomName]);

  const handleExecute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const goal = prompt.trim();
    if (!goal || isOrchestrating) return;

    if (!WORKER_URL || WORKER_URL.includes('SEU-SUBDOMINIO')) {
      window.alert('Configure a URL real do Cloudflare Worker antes de executar.');
      return;
    }

    await orchestrateGoal(goal, WORKER_URL);
  };

  return (
    <main className="synapse-app">
      <header className="topbar">
        <div className="brand-group">
          <span className="brand-indicator" />
          <span className="brand-name">SYNAPSE OS</span>
          <span className="execution-log" title={executionLog} role="status" aria-live="polite">{executionLog}</span>
        </div>
        <div className="share-group">
          {presence.connected && <span className="presence-indicator" title="Presença Supabase conectada">{presence.participantCount} online</span>}
          <AccountPanel />
          <button type="button" className="share-button" onClick={() => void handleShareRoom()}>
            <Share2 aria-hidden="true" />
            Compartilhar sala
          </button>
          {shareMessage && <span className="share-message" role="status">{shareMessage}</span>}
        </div>
      </header>

      <section className="canvas-area" aria-label="Canvas de agentes">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#27272a" />
          <Controls />
        </ReactFlow>

        {nodes.length === 0 && (
          <div className="canvas-empty">
            <span className="empty-orb"><Sparkles aria-hidden="true" /></span>
            <h1>Transforme uma diretriz em um plano de execução</h1>
            <p>Descreva um objetivo. O SYNAPSE OS vai planejar e executar tarefas com agentes especializados.</p>
          </div>
        )}

        <form className="command-bar" onSubmit={(event) => void handleExecute(event)}>
          <input
            aria-label="Objetivo para os agentes"
            type="text"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Digite um objetivo para o enxame de agentes..."
            disabled={isOrchestrating}
          />
          <button type="submit" disabled={isOrchestrating || !prompt.trim()}>
            <Sparkles aria-hidden="true" />
            {isOrchestrating ? 'Executando...' : 'Executar'}
          </button>
        </form>
      </section>
    </main>
  );
}
