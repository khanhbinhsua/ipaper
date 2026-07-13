import { useState } from 'react';
import {
  Card, Select, Input, Button, Table, Space, Tag, Modal, Form, message, Popconfirm, Upload, List,
} from 'antd';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import {
  SearchOutlined, PlusOutlined, UnorderedListOutlined, EditOutlined, DeleteOutlined,
  FormOutlined, UploadOutlined, DownloadOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import UserSelect from '../components/UserSelect';

interface TemplateFile { key: string; originalName: string; size: number; mimeType: string; }
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
  templateFiles?: TemplateFile[];
  isActive: boolean;
}

const priorities = [
  { value: 'low', label: 'Thấp' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'high', label: 'Cao' },
  { value: 'urgent', label: 'Khẩn' },
];

function formatSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
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
    form.setFieldsValue({ priority: 'normal' });
    setModalOpen(true);
  };
  const openEdit = (t: Template) => {
    setEditing(t);
    form.setFieldsValue({ ...t, category: t.category ? [t.category] : [] });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); form.resetFields(); };

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      const payload = { ...values, category: Array.isArray(values.category) ? values.category[0] : values.category };
      if (editing) return (await api.patch(`/templates/${editing.id}`, payload)).data;
      return (await api.post('/templates', payload)).data;
    },
    onSuccess: (saved: Template) => {
      const wasCreating = !editing;
      message.success(wasCreating ? 'Đã tạo biểu mẫu. Bạn có thể tải file mẫu lên ở phần dưới.' : 'Đã cập nhật biểu mẫu');
      list.refetch();
      cats.refetch();
      // Sau khi tạo mới: chuyển modal sang chế độ Sửa để user upload file mẫu
      if (wasCreating) setEditing(saved);
      else setEditing(saved); // giữ mode edit, refresh file list
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Không lưu được biểu mẫu'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => { message.success('Đã xoá biểu mẫu'); list.refetch(); },
    onError: (e: any) => message.error(e.response?.data?.message || 'Không xoá được biểu mẫu'),
  });

  // Upload file mẫu qua axios (giữ auth token của api instance)
  const doUpload = async (opt: UploadRequestOption) => {
    if (!editing) return;
    const fd = new FormData();
    fd.append('file', opt.file as any);
    try {
      const { data } = await api.post(`/templates/${editing.id}/files`, fd);
      setEditing(data);
      opt.onSuccess?.(data as any);
      message.success('Đã tải file mẫu lên');
    } catch (e: any) {
      opt.onError?.(e);
      message.error(e.response?.data?.message || 'Không tải được file');
    }
  };

  const removeFile = async (file: TemplateFile) => {
    if (!editing) return;
    try {
      const { data } = await api.delete(`/templates/${editing.id}/files`, { params: { key: file.key } });
      setEditing(data);
      message.success('Đã xoá file mẫu');
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Không xoá được file');
    }
  };

  const downloadFile = async (tplId: string, file: TemplateFile) => {
    try {
      const { data } = await api.get(`/templates/${tplId}/files/url`, { params: { key: file.key } });
      window.open(data.url, '_blank');
    } catch {
      message.error('Không lấy được link tải');
    }
  };

  const columns = [
    { title: 'Danh mục', dataIndex: 'category', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Tên biểu mẫu', dataIndex: 'name' },
    { title: 'Loại yêu cầu', dataIndex: 'docType', render: (v: string) => v || '—' },
    { title: 'Bộ phận', dataIndex: 'orgUnit', render: (v: string) => v || '—' },
    {
      title: 'File mẫu', dataIndex: 'templateFiles',
      render: (v: TemplateFile[]) => v?.length ? <Tag color="green">{v.length} file</Tag> : '—',
    },
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
        okText={editing ? 'Cập nhật' : 'Tạo & tiếp tục thêm file mẫu'}
        cancelText="Đóng"
        confirmLoading={saveMutation.isPending}
        destroyOnHidden
        width={780}
      >
        <p style={{ color: '#666', marginTop: 0, marginBottom: 12, fontSize: 13 }}>
          Các trường điền ở đây sẽ được <b>điền sẵn tự động</b> khi nhân viên tạo hồ sơ từ biểu mẫu này.
        </p>

        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)} initialValues={{ priority: 'normal' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="category" label="Danh mục" rules={[{ required: true, message: 'Nhập danh mục' }]}>
              <Select placeholder="Chọn hoặc gõ danh mục mới"
                options={(cats.data ?? []).map((c) => ({ value: c, label: c }))}
                showSearch mode="tags" maxCount={1} />
            </Form.Item>
            <Form.Item name="name" label="Tên biểu mẫu" rules={[{ required: true, message: 'Nhập tên biểu mẫu' }]}>
              <Input placeholder="VD: Đề xuất mua sắm văn phòng phẩm" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="docType" label="Loại yêu cầu">
              <Input placeholder="VD: Đề xuất, Thanh toán..." />
            </Form.Item>
            <Form.Item name="orgUnit" label="Bộ phận">
              <Input placeholder="VD: Phòng Kế toán" />
            </Form.Item>
          </div>

          <Form.Item name="priority" label="Ưu tiên">
            <Select options={priorities} />
          </Form.Item>

          <Form.Item name="description" label="Mô tả mẫu">
            <Input.TextArea rows={3} placeholder="Nội dung khung sẽ điền sẵn vào ô Mô tả của hồ sơ" />
          </Form.Item>

          <div style={{ borderTop: '1px dashed #eee', paddingTop: 12, marginTop: 4 }}>
            <b style={{ color: '#E4002B' }}>Luồng phê duyệt điền sẵn</b>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <Form.Item name="assignedToId" label="Chuyển tới 1">
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

        {/* Phần upload file mẫu — chỉ hiện sau khi đã lưu biểu mẫu (có id) */}
        <div style={{ borderTop: '1px dashed #eee', paddingTop: 12, marginTop: 4 }}>
          <b style={{ color: '#E4002B' }}>File mẫu đính kèm</b>
          <p style={{ color: '#888', fontSize: 12, marginTop: 4, marginBottom: 8 }}>
            Tải lên file mẫu (Word, PDF, Excel...). Khi tạo hồ sơ, nhân viên thấy các file này để tải về dùng.
          </p>
          {!editing ? (
            <p style={{ color: '#999', fontStyle: 'italic', fontSize: 13 }}>
              Vui lòng bấm <b>“Tạo & tiếp tục thêm file mẫu”</b> ở trên trước, rồi mới tải file lên được.
            </p>
          ) : (
            <>
              <Upload customRequest={doUpload} showUploadList={false} multiple>
                <Button icon={<UploadOutlined />}>Tải file mẫu lên</Button>
              </Upload>
              <List
                size="small" style={{ marginTop: 12 }}
                dataSource={editing.templateFiles ?? []}
                locale={{ emptyText: 'Chưa có file mẫu' }}
                renderItem={(f) => (
                  <List.Item
                    actions={[
                      <Button key="d" size="small" icon={<DownloadOutlined />}
                        onClick={() => downloadFile(editing.id, f)}>Tải</Button>,
                      <Popconfirm key="x" title="Xoá file mẫu này?" okText="Xoá" cancelText="Hủy" okButtonProps={{ danger: true }}
                        onConfirm={() => removeFile(f)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>,
                    ]}
                  >
                    <FileTextOutlined style={{ marginRight: 8 }} />
                    <b>{f.originalName}</b>
                    <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>{formatSize(f.size)}</span>
                  </List.Item>
                )}
              />
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
