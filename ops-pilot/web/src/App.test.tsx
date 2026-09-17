import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the live backend status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'UP' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<App />);

    expect(screen.getByText('检查中')).toBeInTheDocument();
    expect(await screen.findByText('运行正常')).toBeInTheDocument();
  });

  it('shows an error and retries the health check', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'UP' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    render(<App />);

    expect(await screen.findByText('暂不可用')).toBeInTheDocument();
    expect(screen.getByText('network unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新检查' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('运行正常')).toBeInTheDocument();
  });

  it('rejects a non-UP health response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'DOWN' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    render(<App />);

    expect(await screen.findByText('Backend health status is not UP')).toBeInTheDocument();
  });
});
