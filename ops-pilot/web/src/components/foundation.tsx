import {
  Alert,
  Button,
  Card,
  Empty,
  Modal,
  Progress,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { ReactNode } from 'react';
import { ApiError } from '../api';

const { Paragraph, Text, Title } = Typography;

export function RequestError({
  error,
  onRetry,
  title = '暂时无法加载',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const message = error instanceof Error ? error.message : '发生未知错误';
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return (
    <Alert
      type="error"
      showIcon
      role="alert"
      title={title}
      description={
        <Space orientation="vertical">
          <Text>{message}</Text>
          {requestId && <Text copyable>Request ID: {requestId}</Text>}
          {onRetry && (
            <Button onClick={onRetry} size="small">
              重试
            </Button>
          )}
        </Space>
      }
    />
  );
}

export function PageLoading({ rows = 4 }: { rows?: number }) {
  return (
    <Card aria-label="正在加载" className="surface-card">
      <Skeleton active paragraph={{ rows }} />
    </Card>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="surface-card">
      <Empty
        description={
          <Space orientation="vertical">
            <Text strong>{title}</Text>
            {detail && <Text type="secondary">{detail}</Text>}
            {action}
          </Space>
        }
      />
    </Card>
  );
}

const statusColors: Record<string, string> = {
  ENABLED: 'success',
  HEALTHY: 'success',
  COMPLETED: 'success',
  DISABLED: 'default',
  PENDING: 'processing',
  FAILED: 'error',
  ERROR: 'error',
};

export function StatusTag({ status }: { status: string }) {
  return <Tag color={statusColors[status] ?? 'blue'}>{status}</Tag>;
}

const riskColors = { LOW: 'green', MEDIUM: 'gold', HIGH: 'red' } as const;

export function RiskTag({ risk }: { risk: keyof typeof riskColors }) {
  return <Tag color={riskColors[risk]}>{risk}</Tag>;
}

export function Confidence({ value }: { value: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div aria-label={`置信度 ${percent}%`} className="confidence">
      <Progress
        percent={percent}
        size="small"
        status={percent < 50 ? 'exception' : 'normal'}
        strokeColor={percent >= 80 ? '#28c7a1' : undefined}
      />
    </div>
  );
}

type ContentViewerProps = {
  json?: unknown;
  logs?: string;
  trace?: string;
};

export function ContentViewer({ json, logs, trace }: ContentViewerProps) {
  const items = [
    json === undefined
      ? null
      : {
          key: 'json',
          label: 'JSON',
          children: <pre className="content-viewer">{JSON.stringify(json, null, 2)}</pre>,
        },
    logs === undefined
      ? null
      : { key: 'logs', label: '日志', children: <pre className="content-viewer">{logs}</pre> },
    trace === undefined
      ? null
      : { key: 'trace', label: 'Trace', children: <pre className="content-viewer">{trace}</pre> },
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  return <Tabs items={items} />;
}

export function DangerousActionDialog({
  open,
  title,
  impact,
  confirmText = '确认执行',
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  impact: string;
  confirmText?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      okText={confirmText}
      okButtonProps={{ danger: true }}
      confirmLoading={loading}
      onOk={onConfirm}
      onCancel={onCancel}
      destroyOnHidden
    >
      <Alert type="warning" showIcon title="请确认操作影响" description={impact} />
    </Modal>
  );
}

export function ServerTable<T extends { id: string }>({
  columns,
  data,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  emptyTitle,
}: {
  columns: ColumnsType<T>;
  data: T[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number, pageSize: number) => void;
  emptyTitle: string;
}) {
  const pagination: TablePaginationConfig = {
    current: page + 1,
    pageSize,
    total,
    showSizeChanger: true,
    showTotal: (count) => `共 ${count} 条`,
  };
  return (
    <Table<T>
      rowKey="id"
      columns={columns}
      dataSource={data}
      loading={loading}
      pagination={pagination}
      locale={{
        emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyTitle} />,
      }}
      scroll={{ x: 900 }}
      onChange={(next) => onPageChange((next.current ?? 1) - 1, next.pageSize ?? pageSize)}
    />
  );
}

export function RouteStatus({
  code,
  title,
  detail,
  onHome,
}: {
  code: '403' | '404' | '500';
  title: string;
  detail: string;
  onHome: () => void;
}) {
  return (
    <section className="route-status">
      <Text className="route-code">{code}</Text>
      <Title level={1}>{title}</Title>
      <Paragraph type="secondary">{detail}</Paragraph>
      <Button type="primary" onClick={onHome}>
        返回首页
      </Button>
    </section>
  );
}
