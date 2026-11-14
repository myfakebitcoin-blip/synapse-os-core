import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CheckCircle2, Cpu, XCircle } from 'lucide-react';
import type { SynapticFlowNode } from '../store/useSynapseStore';

export function SynapticNode({ data }: NodeProps<SynapticFlowNode>) {
  const isDone = data.status === 'completed';
  const isError = data.status === 'error';
  const isRunning = data.status === 'running';
  const statusLabel = isDone ? 'Concluído' : isError ? 'Falhou' : isRunning ? 'Processando' : 'Aguardando';

  return (
    <article className={`synaptic-node ${isDone ? 'is-done' : ''} ${isError ? 'is-error' : ''} ${isRunning ? 'is-running' : ''}`}>
      <Handle type="target" position={Position.Left} className="synaptic-handle" />
      <div className="synaptic-node-heading">
        {isDone ? <CheckCircle2 aria-hidden="true" /> : isError ? <XCircle aria-hidden="true" /> : <Cpu aria-hidden="true" />}
        <span>{data.role || 'Agente Autônomo'}</span>
        <span className="synaptic-status">{statusLabel}</span>
      </div>
      <div className="synaptic-node-task">{data.label}</div>
      {data.output && <details className="synaptic-output"><summary>Ver resultado</summary><p>{data.output}</p></details>}
      <Handle type="source" position={Position.Right} className="synaptic-handle" />
    </article>
  );
}
