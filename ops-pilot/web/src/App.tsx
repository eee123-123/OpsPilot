import { useCallback, useEffect, useState } from 'react';

type HealthState = { phase: 'loading' } | { phase: 'up' } | { phase: 'down'; message: string };

type HealthPayload = {
  status?: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export function App() {
  const [health, setHealth] = useState<HealthState>({ phase: 'loading' });
  const [requestSequence, setRequestSequence] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadHealth() {
      setHealth({ phase: 'loading' });
      try {
        const response = await fetch(`${apiBaseUrl}/actuator/health`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as HealthPayload;
        if (payload.status !== 'UP') {
          throw new Error('Backend health status is not UP');
        }
        setHealth({ phase: 'up' });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Unknown health check error';
        setHealth({ phase: 'down', message });
      }
    }

    void loadHealth();
    return () => controller.abort();
  }, [requestSequence]);

  const retry = useCallback(() => {
    setRequestSequence((current) => current + 1);
  }, []);

  return (
    <main className="shell">
      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">INTELLIGENT INCIDENT OPERATIONS</p>
        <h1 id="page-title">OpsPilot</h1>
        <p className="summary">可审计、可恢复、证据优先的智能故障诊断与应急处置平台。</p>
      </section>

      <section className="status-card" aria-live="polite" aria-busy={health.phase === 'loading'}>
        <div>
          <p className="status-label">API FOUNDATION</p>
          <h2>后端连接状态</h2>
        </div>
        {health.phase === 'loading' && <span className="status loading">检查中</span>}
        {health.phase === 'up' && <span className="status up">运行正常</span>}
        {health.phase === 'down' && (
          <div className="failure">
            <span className="status down">暂不可用</span>
            <p>{health.message}</p>
            <button type="button" onClick={retry}>
              重新检查
            </button>
          </div>
        )}
      </section>

      <section className="foundation" aria-labelledby="foundation-title">
        <h2 id="foundation-title">工程基础已就绪</h2>
        <ul>
          <li>Java 21 模块化后端</li>
          <li>React + TypeScript 严格模式</li>
          <li>PostgreSQL + pgvector</li>
          <li>Prometheus · Grafana · Jaeger</li>
        </ul>
      </section>
    </main>
  );
}
