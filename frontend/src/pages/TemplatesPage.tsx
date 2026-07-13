import { useState } from 'react';
import { Card, Select, Input, Button, Table, Space, Tag, Modal, Form, message, Popconfirm } from 'antd';
import { SearchOutlined, PlusOutlined, UnorderedListOutlined, EditOutlined, DeleteOutlined, FormOutlined } from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';

interface Template {
  id: string;
  name: string;
  category: string;
  docType?: string;
  isActive: boolean;
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [category, setCategory] = useState<string>();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Template | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const cats = useQuery({
    queryKey: ['template-categories'],
    queryFn: async () => (await api.get('/templates/categories')).data as string[],
  });

  const list = useQuery({
    queryKey: ['templates', category, name],
    queryFn: async () => (await api.get('/templates', { params: { category, name } })).data,
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };
  const openEdit = (t: Template) => {
    setEditing(t);
    form.setFieldsValue(t);
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); form.resetFields(); };

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editing) return (await api.patch(`/templates/${editing.id}`, values)).data;
      return (await api.post('/templates', values)).data;
    },
    onSuccess: () => {
      message.success(editing ? 'Đã cập nhật biểu mẫu' : 'Đã tạo biểu mẫu');
      closeModal();
      list.refetch();
      cats.refetch();
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Không lưu được biểu mẫu'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => { message.success('Đã xoá biểu mẫu'); list.refetch(); },
    onError: (e: any) => message.error(e.response?.data?.message || 'Không xoá được biểu mẫu'),
  });

  const columns = [
    { title: 'Danh mục', dataIndex: 'category', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Tên biểu mẫu', dataIndex: 'name' },
    { title: 'Loại yêu cầu', dataIndex: 'docType', render: (v: string) => v || '—' },
    {
      title: 'Thao tác', key: 'act', width: isAdmin ? 320 : 200,
      render: (_: any, r: Template) => (
        <Space wrap>
          <Button size="small" type="primary" icon={<PlusOutlined />}
            onClick={() => navigate('/create', { state: { template: r } })}>Tạo mới</Button>
          <Button size="small" icon={<UnorderedListOutlined />}
            onClick={() => navigate('/search')}>Danh sách</Button>
          {isAdmin && (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Sửa</Button>
              <Popconfirm title="Xoá biểu mẫu này?" okText="Xoá" cancelText="Hủy" okButtonProps={{ danger: true }}
                onConfirm={() => removeMutation.mutate(r.id)}>
                <Button size="small" danger icon={<DeleteOutlined />}>Xoá</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Tạo yêu cầu theo mẫu</h2>
        {isAdmin && (
          <Button type="primary" icon={<FormOutlined />} onClick={openCreate}>Tạo biểu mẫu</Button>
        )}
      </div>

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
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 10, showTotal: (t) => `Tổng ${t} biểu mẫu` }} />

      <Modal
        title={editing ? 'Sửa biểu mẫu' : 'Tạo biểu mẫu mới'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={() => form.submit()}
        okText={editing ? 'Cập nhật' : 'Tạo'}
        cancelText="Hủy"
        confirmLoading={saveMutation.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)} initialValues={{ isActive: true }}>
          <Form.Item name="category" label="Danh mục" rules={[{ required: true, message: 'Nhập danh mục' }]}
            tooltip="VD: Nhân sự, Kế toán, Hành chính. Có thể tự đặt hoặc chọn danh mục có sẵn.">
            <Select
              placeholder="Chọn hoặc gõ danh mục mới"
              options={(cats.data ?? []).map((c) => ({ value: c, label: c }))}
              showSearch
              mode="tags"
              maxCount={1}
            />
          </Form.Item>
          <Form.Item name="name" label="Tên biểu mẫu" rules={[{ required: true, message: 'Nhập tên biểu mẫu' }]}>
            <Input placeholder="VD: Đề xuất mua sắm văn phòng phẩm" />
          </Form.Item>
          <Form.Item name="docType" label="Loại yêu cầu"
            tooltip="Loại yêu cầu sẽ được điền sẵn khi tạo hồ sơ từ biểu mẫu này">
            <Input placeholder="VD: Đề xuất, Thanh toán, Trình ký..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
