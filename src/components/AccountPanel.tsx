import { useEffect, useState, type FormEvent } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { deleteMemory, listMemories, saveMemory, type UserMemory } from '../lib/memories';
import { useAuthStore } from '../store/useAuthStore';

export function AccountPanel() {
  const { user, loading, error, initialize, signIn, signUp, signOut } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [memoryText, setMemoryText] = useState('');
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => initialize(), [initialize]);
  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setMemories([]);
      return;
    }
    let mounted = true;
    void listMemories().then((items) => {
      if (mounted) setMemories(items);
    }).catch((loadError: unknown) => {
      if (mounted) setMessage(loadError instanceof Error ? loadError.message : 'Falha ao carregar memórias.');
    });
    return () => { mounted = false; };
  }, [user]);

  if (!isSupabaseConfigured) {
    return <details className="account-panel"><summary>Conta e memória</summary><p>Configure <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no ambiente de build para ativar autenticação, memória e presença Supabase.</p></details>;
  }

  const submitAuth = async (mode: 'signin' | 'signup') => {
    setMessage('');
    try {
      if (mode === 'signin') await signIn(email, password);
      else await signUp(email, password);
      setMessage(mode === 'signup' ? 'Conta criada. Verifique seu e-mail caso a confirmação esteja ativada.' : 'Sessão iniciada.');
    } catch {
      // The auth store exposes the error to the panel.
    }
  };

  const addMemory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!memoryText.trim()) return;
    try {
      const item = await saveMemory(memoryText);
      setMemories((current) => [item, ...current]);
      setMemoryText('');
      setMessage('Memória salva com segurança na sua conta.');
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : 'Falha ao salvar memória.');
    }
  };

  const removeMemory = async (id: string) => {
    try {
      await deleteMemory(id);
      setMemories((current) => current.filter((item) => item.id !== id));
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? deleteError.message : 'Falha ao remover memória.');
    }
  };

  return (
    <details className="account-panel">
      <summary>{user ? user.email : 'Entrar / criar conta'}</summary>
      {user ? (
        <div className="account-content">
          <button type="button" className="account-action" onClick={() => void signOut()}>Sair</button>
          <h2>Memória pessoal</h2>
          <form onSubmit={addMemory} className="memory-form">
            <textarea value={memoryText} onChange={(event) => setMemoryText(event.target.value)} placeholder="Adicione uma informação para lembrar..." maxLength={4000} />
            <button type="submit" disabled={!memoryText.trim()}>Salvar memória</button>
          </form>
          <ul className="memory-list">
            {memories.map((memory) => <li key={memory.id}><span>{memory.content}</span><button type="button" aria-label="Excluir memória" onClick={() => void removeMemory(memory.id)}>×</button></li>)}
          </ul>
        </div>
      ) : (
        <div className="account-content auth-form">
          <label>E-mail<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Senha<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
          <div className="auth-actions">
            <button type="button" disabled={loading} onClick={() => void submitAuth('signin')}>{loading ? 'Aguarde...' : 'Entrar'}</button>
            <button type="button" disabled={loading} onClick={() => void submitAuth('signup')}>Criar conta</button>
          </div>
          {error && <p className="account-message" role="alert">{error}</p>}
        </div>
      )}
      {message && <p className="account-message" role="status">{message}</p>}
    </details>
  );
}
