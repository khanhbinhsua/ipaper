import { useState } from 'react';
import { Card, Select, Input, Button, Table, Space, Tag, Modal, Form, message, Popconfirm } from 'antd';
import { SearchOutlined, PlusOutlined, UnorderedListOutlined, EditOutlined, DeleteOutlined, FormOutlined } from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import UserSelect from '../components/UserSelect';

interface Template {
  id: string;
  name: string;
  category: string;
  docType?: string;
  description?: string;
  orgUnit?: string;
  priority?: string;
  assignedToId?: string;
  nextApproverIds?: string[];
  ccUserIds?: string[];
  isActive: boolean;
}

const priorities = [
  { value: 'low', label: 'Thấp' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'high', label: 'Cao' },
  { value: 'urgent', label: 'Khẩn' },
];

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
    form.setFieldsValue({ priority: 'normal' });
    setModalOpen(true);
  };
  const openEdit = (t: Template) => {
    setEditing(t);
    // chuyển category (string) sang mảng vì Select mode=tags dùng array
    form.setFieldsValue({ ...t, category: t.category ? [t.category] : [] });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); form.resetFields(); };

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      // category từ Select mode="tags" là mảng — chuyển về string
      const payload = { ...values, category: Array.isArray(values.category) ? values.category[0] : values.category };
      if (editing) return (await api.patch(`/templates/${editing.id}`, payload)).data;
      return (await api.post('/templates', payload)).data;
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
    { title: 'Bộ phận', dataIndex: 'orgUnit', render: (v: string) => v || '—' },
    {
      title: 'Thao tác', key: 'act', width: isAdmin ? 340 : 200,
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
        width={780}
      >
        <p style={{ color: '#666', marginTop: 0, marginBottom: 12, fontSize: 13 }}>
          Các trường điền ở đây sẽ được <b>điền sẵn tự động</b> khi nhân viên tạo hồ sơ từ biểu mẫu này.
          Nhân viên chỉ cần chỉnh Tiêu đề rồi bấm Gửi duyệt.
        </p>

        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)} initialValues={{ priority: 'normal' }}>
          {/* Thông tin nhận diện biểu mẫu */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="category" label="Danh mục" rules={[{ required: true, message: 'Nhập danh mục' }]}
              tooltip="VD: Nhân sự, Kế toán, Hành chính. Có thể chọn có sẵn hoặc gõ mới.">
              <Select
                placeholder="Chọn hoặc gõ danh mục mới"
                options={(cats.data ?? []).map((c) => ({ value: c, label: c }))}
                showSearch mode="tags" maxCount={1}
              />
            </Form.Item>
            <Form.Item name="name" label="Tên biểu mẫu" rules={[{ required: true, message: 'Nhập tên biểu mẫu' }]}>
              <Input placeholder="VD: Đề xuất mua sắm văn phòng phẩm" />
            </Form.Item>
          </div>

          {/* Preset điền sẵn cho hồ sơ */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="docType" label="Loại yêu cầu"
              tooltip="VD: Đề xuất, Thanh toán, Trình ký...">
              <Input placeholder="Sẽ điền sẵn ô Loại yêu cầu" />
            </Form.Item>
            <Form.Item name="orgUnit" label="Bộ phận">
              <Input placeholder="VD: Phòng Kế toán" />
            </Form.Item>
          </div>

          <Form.Item name="priority" label="Ưu tiên">
            <Select options={priorities} />
          </Form.Item>

          <Form.Item name="description" label="Mô tả mẫu"
            tooltip="Nội dung khung điền sẵn — nhân viên có thể chỉnh khi tạo hồ sơ">
            <Input.TextArea rows={3} placeholder="VD: Kính gửi Ban Giám đốc, phòng ... kính đề xuất..." />
          </Form.Item>

          <div style={{ borderTop: '1px dashed #eee', paddingTop: 12, marginTop: 4 }}>
            <b style={{ color: '#E4002B' }}>Luồng phê duyệt điền sẵn</b>
            <p style={{ color: '#888', fontSize: 12, marginTop: 4, marginBottom: 8 }}>
              Chọn sẵn người duyệt các cấp — nhân viên sẽ không phải chọn lại từng người khi tạo hồ sơ.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="assignedToId" label="Chuyển tới 1 (bắt buộc)">
                <UserSelect placeholder="VD: Trưởng phòng" />
              </Form.Item>
              <Form.Item name={['nextApproverIds', 0]} label="Chuyển tới 2">
                <UserSelect role="staff" orgUnit="Phòng Kế toán" placeholder="Nhân viên Phòng Kế toán" />
              </Form.Item>
              <Form.Item name={['nextApproverIds', 1]} label="Chuyển tới 3">
                <UserSelect role="manager" orgUnit="Phòng Kế toán" placeholder="Trưởng phòng Kế toán" />
              </Form.Item>
              <Form.Item name={['nextApproverIds', 2]} label="Chuyển tới 4">
                <UserSelect role="director" placeholder="Ban Giám đốc" />
              </Form.Item>
            </div>
            <Form.Item name="ccUserIds" label="Người liên quan (CC)">
              <UserSelect mode="multiple" placeholder="Chọn người cần theo dõi hồ sơ" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
