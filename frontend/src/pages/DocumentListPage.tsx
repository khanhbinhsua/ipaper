import { useState } from 'react';
import { Table, Input, Select, Button, Tag, Space, Card } from 'antd';
import { SearchOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { vnTime } from '../lib/datetime';
import { api } from '../lib/api';

type Box = 'inbox' | 'outbox' | 'draft' | 'related' | 'all';

const titles: Record<Box, string> = {
  inbox: 'Hồ sơ đến', outbox: 'Hồ sơ đi', draft: 'Hồ sơ nháp',
  related: 'Hồ sơ liên quan', all: 'Tìm hồ sơ',
};

const statusColors: Record<string, string> = {
  draft: 'default', pending: 'processing', approved: 'success',
  rejected: 'error', returned: 'warning', completed: 'green',
};
const statusLabels: Record<string, string> = {
  draft: 'Nháp', pending: 'Chờ duyệt', approved: 'Đã duyệt cấp này',
  rejected: 'Từ chối', returned: 'Trả về', completed: 'Hoàn thành',
};
const priorityLabels: Record<string, string> = {
  low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn',
};

export default function DocumentListPage({ box }: { box: Box }) {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [priority, setPriority] = useState<string>();
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', box, page],
    queryFn: async () => {
      const { data } = await api.get('/documents/search', {
        params: { box, keyword, priority, page, pageSize: 10 },
      });
      return data;
    },
  });

  const columns = [
    {
      title: 'Thao tác', key: 'actions', width: 110,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/documents/${r.id}`)} />
          {box === 'draft' && (
            <Button size="small" danger icon={<DeleteOutlined />}
              onClick={async () => { await api.delete(`/documents/${r.id}`); refetch(); }} />
          )}
        </Space>
      ),
    },
    { title: 'Mã hồ sơ', dataIndex: 'code', render: (v: string) => <b style={{ color: '#E4002B' }}>{v || '—'}</b> },
    { title: 'Tiêu đề', dataIndex: 'title', sorter: true },
    { title: 'Loại yêu cầu', dataIndex: 'docType' },
    { title: 'Bộ phận', dataIndex: 'orgUnit' },
    {
      title: 'Ưu tiên', dataIndex: 'priority',
      render: (v: string) => priorityLabels[v] ?? v,
    },
    {
      title: 'Người tạo', dataIndex: ['createdBy', 'fullName'],
      render: (_: any, r: any) => r.createdBy?.fullName || r.createdBy?.username,
    },
    {
      title: 'Ngày tạo', dataIndex: 'createdAt',
      render: (v: string) => vnTime(v, 'DD/MM/YYYY HH:mm'),
      sorter: true,
    },
    {
      title: 'Ngày hoàn thành', dataIndex: 'completedAt',
      render: (v: string) => (v ? vnTime(v, 'DD/MM/YYYY HH:mm') : '—'),
    },
    {
      title: 'Trạng thái', dataIndex: 'status',
      render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v] ?? v}</Tag>,
    },
  ];

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{titles[box]}</h2>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Tìm theo mã hồ sơ / tiêu đề / mô tả"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 260 }}
            onPressEnter={() => refetch()}
          />
          <Select
            placeholder="Ưu tiên" allowClear style={{ width: 150 }}
            value={priority} onChange={setPriority}
            options={Object.entries(priorityLabels).map(([value, label]) => ({ value, label }))}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => refetch()}>Tìm kiếm</Button>
        </Space>
      </Card>

      <Table
        rowKey="id"
        loading={isLoading}
        columns={columns}
        dataSource={data?.items ?? []}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: page, pageSize: 10, total: data?.total ?? 0,
          onChange: setPage, showTotal: (t) => `Tổng ${t} hồ sơ`,
        }}
      />
    </div>
  );
}
