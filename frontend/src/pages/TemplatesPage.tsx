import { useState } from 'react';
import { Card, Select, Input, Button, Table, Space, Tag } from 'antd';
import { SearchOutlined, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<string>();
  const [name, setName] = useState('');

  const cats = useQuery({
    queryKey: ['template-categories'],
    queryFn: async () => (await api.get('/templates/categories')).data as string[],
  });

  const list = useQuery({
    queryKey: ['templates', category, name],
    queryFn: async () => (await api.get('/templates', { params: { category, name } })).data,
  });

  const columns = [
    { title: 'Danh mục', dataIndex: 'category', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Tên biểu mẫu', dataIndex: 'name' },
    { title: 'Loại yêu cầu', dataIndex: 'docType', render: (v: string) => v || '—' },
    {
      title: 'Thao tác', key: 'act', width: 200,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" type="primary" icon={<PlusOutlined />}
            onClick={() => navigate('/create', { state: { template: r } })}>Tạo mới</Button>
          <Button size="small" icon={<UnorderedListOutlined />}
            onClick={() => navigate('/search')}>Danh sách</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Tạo yêu cầu theo mẫu</h2>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Chọn danh mục" allowClear style={{ width: 200 }}
            value={category} onChange={setCategory}
            options={(cats.data ?? []).map((c) => ({ value: c, label: c }))}
          />
          <Input
            placeholder="Tên biểu mẫu" value={name} style={{ width: 240 }}
            onChange={(e) => setName(e.target.value)} onPressEnter={() => list.refetch()}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => list.refetch()}>Tìm kiếm</Button>
        </Space>
      </Card>

      <Table rowKey="id" loading={list.isLoading} columns={columns} dataSource={list.data ?? []}
        pagination={{ pageSize: 10, showTotal: (t) => `Tổng ${t} biểu mẫu` }} />
    </div>
  );
}
