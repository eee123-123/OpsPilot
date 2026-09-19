import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api';
import {
  Confidence,
  ContentViewer,
  DangerousActionDialog,
  EmptyState,
  RequestError,
  RiskTag,
  ServerTable,
  StatusTag,
} from './foundation';

describe('shared frontend components', () => {
  it('renders status, risk and confidence without relying on color alone', () => {
    render(
      <>
        <StatusTag status="FAILED" />
        <RiskTag risk="HIGH" />
        <Confidence value={0.87} />
      </>,
    );
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByLabelText('置信度 87%')).toBeInTheDocument();
  });

  it('shows empty-state guidance and an optional action', () => {
    render(
      <EmptyState
        title="没有事故"
        detail="调整筛选条件后重试"
        action={<button>清除筛选</button>}
      />,
    );
    expect(screen.getByText('没有事故')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '清除筛选' })).toBeInTheDocument();
  });

  it('shows request ids and supports recoverable retry', () => {
    const retry = vi.fn();
    render(
      <RequestError
        error={new ApiError(500, { detail: 'Database unavailable', requestId: 'request-500' })}
        onRetry={retry}
      />,
    );
    expect(screen.getByText('Request ID: request-500')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('switches between JSON, log and trace content', () => {
    render(<ContentViewer json={{ ok: true }} logs="service ready" trace="api → database" />);
    expect(screen.getByText(/"ok": true/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '日志' }));
    expect(screen.getByText('service ready')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Trace' }));
    expect(screen.getByText('api → database')).toBeInTheDocument();
  });

  it('requires an explicit confirmation for dangerous operations', () => {
    const confirm = vi.fn();
    render(
      <DangerousActionDialog
        open
        title="确认回滚"
        impact="会中断正在处理的请求"
        onConfirm={confirm}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByText('会中断正在处理的请求')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认执行' }));
    expect(confirm).toHaveBeenCalledOnce();
  });

  it('maps one-based table pagination back to zero-based API pages', () => {
    const pageChange = vi.fn();
    render(
      <ServerTable
        columns={[{ title: '名称', dataIndex: 'name' }]}
        data={Array.from({ length: 10 }, (_, index) => ({
          id: String(index),
          name: `用户 ${index}`,
        }))}
        loading={false}
        page={0}
        pageSize={10}
        total={21}
        emptyTitle="暂无数据"
        onPageChange={pageChange}
      />,
    );
    fireEvent.click(screen.getByTitle('2'));
    expect(pageChange).toHaveBeenCalledWith(1, 10);
  });
});
