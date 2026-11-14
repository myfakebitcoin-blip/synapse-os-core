import { create } from 'zustand';
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange
} from '@xyflow/react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

export interface SynapticNodeData extends Record<string, unknown> {
  label: string;
  role: string;
  task: string;
  status: 'waiting' | 'running' | 'completed' | 'error';
  output?: string;
}

export type SynapticFlowNode = Node<SynapticNodeData, 'synaptic'>;

interface PlannedNode {
  id: string;
  role: string;
  task: string;
  dependsOn: string[];
}

interface SynapseState {
  nodes: SynapticFlowNode[];
  edges: Edge[];
  roomName: string;
  isOrchestrating: boolean;
  executionLog: string;
  setNodes: (nodes: SynapticFlowNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange<SynapticFlowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  connectRoom: (roomName: string) => void;
  orchestrateGoal: (prompt: string, workerUrl: string) => Promise<void>;
}

const SIGNALING_SERVERS = ['wss://signaling.yjs.dev'];
let activeDoc: Y.Doc | undefined;
let activeProvider: WebrtcProvider | undefined;
let activeNodes: Y.Map<SynapticFlowNode> | undefined;
let activeEdges: Y.Map<Edge> | undefined;

function normalizedRoomName(name: string): string {
  return name.trim().replace(/^#/, '') || 'synapse-global-room';
}

function syncMap<T>(target: Y.Map<T>, values: T[], getId: (value: T) => string): void {
  const incoming = new Map(values.map((value) => [getId(value), value]));
  target.doc?.transact(() => {
    for (const key of target.keys()) {
      if (!incoming.has(key)) target.delete(key);
    }
    for (const [key, value] of incoming) target.set(key, value);
  });
}

export const useSynapseStore = create<SynapseState>((set, get) => {
  const connectRoom = (requestedRoom: string) => {
    const roomName = normalizedRoomName(requestedRoom);
    if (activeProvider && get().roomName === roomName) return;

    activeProvider?.destroy();
    activeDoc?.destroy();

    const doc = new Y.Doc();
    const provider = new WebrtcProvider(roomName, doc, { signaling: SIGNALING_SERVERS });
    const nodesMap = doc.getMap<SynapticFlowNode>('nodes');
    const edgesMap = doc.getMap<Edge>('edges');

    activeDoc = doc;
    activeProvider = provider;
    activeNodes = nodesMap;
    activeEdges = edgesMap;

    const publish = () => {
      set({
        nodes: Array.from(nodesMap.values()),
        edges: Array.from(edgesMap.values())
      });
    };
    nodesMap.observe(publish);
    edgesMap.observe(publish);
    set({ roomName, nodes: Array.from(nodesMap.values()), edges: Array.from(edgesMap.values()) });
  };

  const initialRoom = typeof window === 'undefined'
    ? 'synapse-global-room'
    : window.location.hash;
  connectRoom(initialRoom);

  return {
    nodes: [],
    edges: [],
    roomName: normalizedRoomName(initialRoom),
    isOrchestrating: false,
    executionLog: 'Sistema Sináptico Online. Aguardando diretriz...',

    setNodes: (nodes) => {
      if (activeNodes) syncMap(activeNodes, nodes, (node) => node.id);
      set({ nodes });
    },

    setEdges: (edges) => {
      if (activeEdges) syncMap(activeEdges, edges, (edge) => edge.id);
      set({ edges });
    },

    onNodesChange: (changes) => {
      get().setNodes(applyNodeChanges(changes, get().nodes));
    },

    onEdgesChange: (changes) => {
      get().setEdges(applyEdgeChanges(changes, get().edges));
    },

    connectRoom,

    orchestrateGoal: async (prompt, workerUrl) => {
      const baseUrl = workerUrl.trim().replace(/\/$/, '');
      if (!baseUrl) {
        set({ executionLog: 'Configure VITE_WORKER_URL com a URL publicada do Cloudflare Worker.' });
        return;
      }

      set({ isOrchestrating: true, executionLog: 'Solicitando plano ao enxame de agentes...' });
      try {
        const planResponse = await fetch(`${baseUrl}/api/plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal: prompt })
        });
        if (!planResponse.ok) {
          throw new Error(await readApiError(planResponse, 'Não foi possível gerar o plano.'));
        }

        const plan = await planResponse.json() as { nodes?: PlannedNode[] };
        if (!Array.isArray(plan.nodes) || plan.nodes.length === 0) {
          throw new Error('O Worker retornou um plano sem tarefas.');
        }
        validatePlan(plan.nodes);

        const formattedNodes: SynapticFlowNode[] = plan.nodes.map((node, index) => ({
          id: node.id,
          type: 'synaptic',
          position: { x: 100 + (index % 3) * 320, y: 120 + Math.floor(index / 3) * 220 },
          data: {
            label: node.task,
            role: node.role,
            task: node.task,
            status: 'waiting'
          }
        }));
        const formattedEdges: Edge[] = plan.nodes.flatMap((node) => node.dependsOn.map((dependency) => ({
          id: `${dependency}-${node.id}`,
          source: dependency,
          target: node.id,
          animated: true,
          style: { stroke: '#38bdf8', strokeWidth: 2 }
        })));

        get().setNodes(formattedNodes);
        get().setEdges(formattedEdges);

        const completedOutputs = new Map<string, string>();
        const pending = new Set(plan.nodes.map((node) => node.id));
        while (pending.size > 0) {
          const ready = plan.nodes.filter((node) =>
            pending.has(node.id) && node.dependsOn.every((id) => completedOutputs.has(id))
          );
          if (ready.length === 0) throw new Error('O plano contém dependências impossíveis de executar.');

          for (const node of ready) updateNodeStatus(node.id, 'running');
          set({ executionLog: `Executando ${ready.length} agente(s) em paralelo...` });

          const results = await Promise.all(ready.map(async (node) => {
            const context = node.dependsOn
              .map((id) => `Resultado de ${id}:\n${completedOutputs.get(id) ?? ''}`)
              .join('\n\n');
            const response = await fetch(`${baseUrl}/api/execute-node`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role: node.role, task: node.task, context })
            });
            if (!response.ok) {
              throw new Error(await readApiError(response, `Falha ao executar ${node.id}.`));
            }
            const result = await response.json() as { output?: string };
            if (typeof result.output !== 'string') throw new Error(`Resposta inválida do agente ${node.id}.`);
            return { id: node.id, output: result.output };
          }));

          for (const result of results) {
            completedOutputs.set(result.id, result.output);
            pending.delete(result.id);
            updateNodeStatus(result.id, 'completed', result.output);
          }
        }

        set({ executionLog: 'Grafo concluído. Todos os agentes finalizaram.' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro inesperado';
        set({ executionLog: `Falha na sinapse: ${message}` });
      } finally {
        set({ isOrchestrating: false });
      }
    }
  };
});

function updateNodeStatus(
  id: string,
  status: SynapticNodeData['status'],
  output?: string
): void {
  const node = useSynapseStore.getState().nodes.find((item) => item.id === id);
  if (!node) return;
  useSynapseStore.getState().setNodes(useSynapseStore.getState().nodes.map((item) =>
    item.id === id ? { ...item, data: { ...item.data, status, ...(output ? { output } : {}) } } : item
  ));
}

function validatePlan(nodes: PlannedNode[]): void {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || typeof node.role !== 'string' || typeof node.task !== 'string' || !Array.isArray(node.dependsOn)) {
      throw new Error('O Worker retornou uma tarefa em formato inválido.');
    }
    if (ids.has(node.id)) throw new Error(`O plano contém o ID duplicado ${node.id}.`);
    ids.add(node.id);
  }
  for (const node of nodes) {
    if (node.dependsOn.some((dependency) => !ids.has(dependency) || dependency === node.id)) {
      throw new Error(`O plano contém uma dependência inválida em ${node.id}.`);
    }
  }
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}
