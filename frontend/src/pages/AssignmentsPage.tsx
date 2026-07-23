import { useState } from 'react';
import {
  Card, Tabs, Table, Space, Tag, Button, Modal, Form, Input, Select, DatePicker,
  message, Popconfirm, Descriptions, Upload, List,
} from 'antd';
import type { UploadRequestOption } from 'rc-upload/lib/interface';
import {
  PlusOutlined, EyeOutlined, DeleteOutlined, UploadOutlined,
  DownloadOutlined, FileTextOutlined, PaperClipOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../lib/api';
import { vnTime } from '../lib/datetime';
import UserSelect from '../components/UserSelect';
import { useAuthStore } from '../store/auth.store';

interface Props { type: 'task' | 'collab'; }

interface HeldFile { uid: string; name: string; size: number; type: string; raw: File; }
interface Attachment { key: string; originalName: string; size: number; mimeType: string; uploadedAt: string; }

const formatSize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

const priorityLabels: Record<string, string> = {
  low: 'Thấp', normal: 'Bình thường', high: 'Cao', urgent: 'Khẩn',
};
const priorityColors: Record<string, string> = {
  low: 'default', normal: 'blue', high: 'orange', urgent: 'red',
};

const statusLabels: Record<string, string> = {
  pending: 'Chưa xử lý', in_progress: 'Đang thực hiện', done: 'Hoàn thành', cancelled: 'Đã huỷ',
};
const statusColors: Record<string, string> = {
  pending: 'default', in_progress: 'processing', done: 'success', cancelled: 'error',
};

export default function AssignmentsPage({ type }: Props) {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'received' | 'assigned'>('received');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [statusItem, setStatusItem] = useState<any | null>(null);
  const [heldFiles, setHeldFiles] = useState<HeldFile[]>([]); // file chờ upload sau khi tạo assignment
  const [form] = Form.useForm();
  const [statusForm] = Form.useForm();

  const isTask = type === 'task';
  const pageTitle = isTask ? 'Giao việc' : 'Phối hợp giữa bộ phận';
  const createLabel = isTask ? 'Giao việc mới' : 'Tạo yêu cầu phối hợp';

  const list = useQuery({
    queryKey: ['assignments', type, tab],
    queryFn: async () => (await api.get('/assignments', { params: { type, box: tab } })).data,
  });

  const detail = useQuery({
    queryKey: ['assignment-detail', detailId],
    queryFn: async () => (await api.get(`/assignments/${detailId}`)).data,
    enabled: !!detailId,
  });

  const createMutation = useMutation({
    mutationFn: async (v: any) => {
      const { data } = await api.post('/assignments', { ...v, type, dueDate: v.dueDate?.toISOString() });
      // Upload các file đã giữ (nếu có) vào assignment vừa tạo
      for (const f of heldFiles) {
        const fd = new FormData();
        fd.append('file', f.raw);
        await api.post(`/assignments/${data.id}/files`, fd);
      }
      return data;
    },
    onSuccess: () => {
      message.success(isTask ? 'Đã giao việc' : 'Đã gửi yêu cầu phối hợp');
      setCreateOpen(false); form.resetFields(); setHeldFiles([]); list.refetch();
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Không lưu được'),
  });

  const statusMutation = useMutation({
    mutationFn: (v: any) => api.patch(`/assignments/${statusItem.id}/status`, v),
    onSuccess: () => {
      message.success('Đã cập nhật trạng thái');
      setStatusItem(null); statusForm.resetFields(); list.refetch();
      if (detailId) detail.refetch();
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Không cập nhật được'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/assignments/${id}`),
    onSuccess: () => { message.success('Đã xoá'); list.refetch(); },
    onError: (e: any) => message.error(e.response?.data?.message || 'Không xoá được'),
  });

  // Upload file vào chi tiết (assignment đã tồn tại)
  const uploadToDetail = async (opt: UploadRequestOption) => {
    if (!detailId) return;
    const fd = new FormData();
    fd.append('file', opt.file as any);
    try {
      await api.post(`/assignments/${detailId}/files`, fd);
      opt.onSuccess?.({} as any);
      message.success('Đã đính kèm');
      detail.refetch(); list.refetch();
    } catch (e: any) {
      opt.onError?.(e);
      message.error(e.response?.data?.message || 'Không đính kèm được');
    }
  };

  const removeAttachment = async (key: string) => {
    if (!detailId) return;
    try {
      await api.delete(`/assignments/${detailId}/files`, { params: { key } });
      message.success('Đã xoá file');
      detail.refetch();
    } catch (e: any) {
      message.error(e.response?.data?.message || 'Không xoá được file');
    }
  };

  const downloadAttachment = async (id: string, key: string) => {
    try {
      const { data } = await api.get(`/assignments/${id}/files/url`, { params: { key } });
      window.open(data.url, '_blank');
    } catch { message.error('Không lấy được link tải'); }
  };

  const columns = [
    { title: 'Mã', dataIndex: 'code', render: (v: string) => <b style={{ color: '#E4002B' }}>{v}</b>, width: 160 },
    { title: 'Tiêu đề', dataIndex: 'title' },
    ...(isTask ? [] : [
      { title: 'Từ bộ phận', dataIndex: 'fromOrgUnit', render: (v: string) => v || '—' },
      { title: 'Tới bộ phận', dataIndex: 'toOrgUnit', render: (v: string) => v || '—' },
    ]),
    {
      title: tab === 'assigned' ? 'Người nhận' : 'Người giao',
      render: (_: any, r: any) => {
        const u = tab === 'assigned' ? r.assignee : r.assigner;
        return u ? `${u.fullName || u.username}${u.orgUnit ? ' (' + u.orgUnit + ')' : ''}` : '—';
      },
    },
    { title: 'Ưu tiên', dataIndex: 'priority', render: (v: string) => <Tag color={priorityColors[v]}>{priorityLabels[v] ?? v}</Tag> },
    { title: 'Đính kèm', dataIndex: 'attachments', render: (v: Attachment[]) => v?.length ? <Tag icon={<PaperClipOutlined />} color="green">{v.length}</Tag> : '—' },
    { title: 'Trạng thái', dataIndex: 'status', render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v] ?? v}</Tag> },
    { title: 'Hạn', dataIndex: 'dueDate', render: (v: string) => v ? vnTime(v, 'DD/MM/YYYY') : '—' },
    {
      title: 'Thao tác', key: 'act', width: 200,
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailId(r.id)}>Xem</Button>
          {r.assigneeId === user?.id && r.status !== 'done' && r.status !== 'cancelled' && (
            <Button size="small" type="primary" onClick={() => { setStatusItem(r); statusForm.setFieldsValue({ status: r.status, progressNote: r.progressNote }); }}>Cập nhật</Button>
          )}
          {r.assignerId === user?.id && (
            <Popconfirm title="Xoá?" onConfirm={() => removeMutation.mutate(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0 }}>{pageTitle}</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>{createLabel}</Button>
      </div>

      <Card>
        <Tabs activeKey={tab} onChange={(k) => setTab(k as any)} items={[
          { key: 'received', label: isTask ? 'Việc tôi nhận' : 'Yêu cầu cần xử lý' },
          { key: 'assigned', label: isTask ? 'Việc tôi giao' : 'Yêu cầu đã gửi' },
        ]} />
        <Table
          rowKey="id"
          loading={list.isLoading}
          columns={columns}
          dataSource={list.data?.items ?? []}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 15, showTotal: (t) => `Tổng ${t}` }}
        />
      </Card>

      {/* Modal tạo mới */}
      <Modal
        title={createLabel}
        open={createOpen}
        onCancel={() => { setCreateOpen(false); setHeldFiles([]); form.resetFields(); }}
        onOk={() => form.submit()}
        okText={isTask ? 'Giao' : 'Gửi'} cancelText="Hủy"
        confirmLoading={createMutation.isPending}
        destroyOnHidden width={700}
      >
        <Form form={form} layout="vertical" initialValues={{ priority: 'normal' }} onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
            <Input placeholder={isTask ? 'VD: Hoàn thành báo cáo doanh thu Q3' : 'VD: Đề nghị Phòng Kế toán duyệt chi phí đào tạo'} />
          </Form.Item>
          <Form.Item name="description" label="Nội dung">
            <Input.TextArea rows={4} placeholder="Mô tả chi tiết yêu cầu" />
          </Form.Item>
          <Form.Item name="assigneeId" label="Người nhận" rules={[{ required: true, message: 'Chọn người nhận' }]}>
            <UserSelect placeholder="Tìm theo tên/email" />
          </Form.Item>
          {!isTask && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Form.Item name="fromOrgUnit" label="Từ bộ phận">
                <Input placeholder="VD: Phòng Nhân sự" />
              </Form.Item>
              <Form.Item name="toOrgUnit" label="Tới bộ phận">
                <Input placeholder="VD: Phòng Kế toán" />
              </Form.Item>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="priority" label="Ưu tiên">
              <Select options={Object.entries(priorityLabels).map(([v, l]) => ({ value: v, label: l }))} />
            </Form.Item>
            <Form.Item name="dueDate" label="Hạn hoàn thành">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </div>

          <Form.Item label="File đính kèm (tài liệu, biểu mẫu, tham chiếu...)">
            <Upload
              multiple
              showUploadList={false}
              beforeUpload={(f) => {
                setHeldFiles((prev) => [...prev, { uid: f.uid, name: f.name, size: f.size, type: f.type, raw: f }]);
                return false;
              }}
            >
              <Button icon={<UploadOutlined />}>Chọn file</Button>
            </Upload>
            {heldFiles.length > 0 && (
              <List
                size="small" style={{ marginTop: 8 }}
                dataSource={heldFiles}
                renderItem={(f) => (
                  <List.Item
                    actions={[
                      <Button key="x" size="small" danger icon={<DeleteOutlined />}
                        onClick={() => setHeldFiles((prev) => prev.filter((x) => x.uid !== f.uid))} />,
                    ]}
                  >
                    <FileTextOutlined style={{ marginRight: 8 }} />
                    <span>{f.name}</span>
                    <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>{formatSize(f.size)}</span>
                  </List.Item>
                )}
              />
            )}
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal chi tiết */}
      <Modal
        title={detail.data?.code ? `${detail.data.code} — ${detail.data.title}` : 'Chi tiết'}
        open={!!detailId}
        onCancel={() => setDetailId(null)}
        footer={null}
        width={720}
      >
        {detail.data && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Người giao">{detail.data.assigner?.fullName || detail.data.assigner?.username}</Descriptions.Item>
            <Descriptions.Item label="Người nhận">{detail.data.assignee?.fullName || detail.data.assignee?.username}</Descriptions.Item>
            {!isTask && (
              <>
                <Descriptions.Item label="Từ bộ phận">{detail.data.fromOrgUnit || '—'}</Descriptions.Item>
                <Descriptions.Item label="Tới bộ phận">{detail.data.toOrgUnit || '—'}</Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="Ưu tiên"><Tag color={priorityColors[detail.data.priority]}>{priorityLabels[detail.data.priority]}</Tag></Descriptions.Item>
            <Descriptions.Item label="Trạng thái"><Tag color={statusColors[detail.data.status]}>{statusLabels[detail.data.status]}</Tag></Descriptions.Item>
            <Descriptions.Item label="Hạn">{detail.data.dueDate ? vnTime(detail.data.dueDate, 'DD/MM/YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Hoàn thành">{detail.data.completedAt ? vnTime(detail.data.completedAt) : '—'}</Descriptions.Item>
            <Descriptions.Item label="Nội dung" span={2}>{detail.data.description || '—'}</Descriptions.Item>
            <Descriptions.Item label="Ghi chú tiến độ" span={2}>{detail.data.progressNote || '—'}</Descriptions.Item>
          </Descriptions>
        )}

        {detail.data && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <b style={{ color: '#E4002B' }}>📎 File đính kèm</b>
              {(detail.data.assignerId === user?.id || detail.data.assigneeId === user?.id) && (
                <Upload customRequest={uploadToDetail} showUploadList={false} multiple>
                  <Button size="small" icon={<UploadOutlined />}>Thêm file</Button>
                </Upload>
              )}
            </div>
            <List
              size="small"
              dataSource={(detail.data.attachments ?? []) as Attachment[]}
              locale={{ emptyText: 'Chưa có file đính kèm' }}
              renderItem={(f) => {
                const canDelete = detail.data.assignerId === user?.id || detail.data.assigneeId === user?.id;
                return (
                  <List.Item
                    actions={[
                      <Button key="d" size="small" icon={<DownloadOutlined />}
                        onClick={() => downloadAttachment(detail.data.id, f.key)}>Tải</Button>,
                      ...(canDelete ? [
                        <Popconfirm key="x" title="Xoá file này?" okText="Xoá" cancelText="Hủy" okButtonProps={{ danger: true }}
                          onConfirm={() => removeAttachment(f.key)}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>,
                      ] : []),
                    ]}
                  >
                    <FileTextOutlined style={{ marginRight: 8 }} />
                    <b>{f.originalName}</b>
                    <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>{formatSize(f.size)}</span>
                  </List.Item>
                );
              }}
            />
          </div>
        )}
      </Modal>

      {/* Modal cập nhật trạng thái */}
      <Modal
        title="Cập nhật trạng thái"
        open={!!statusItem}
        onCancel={() => setStatusItem(null)}
        onOk={() => statusForm.submit()}
        okText="Cập nhật" cancelText="Hủy"
        confirmLoading={statusMutation.isPending}
        destroyOnHidden
      >
        <Form form={statusForm} layout="vertical" onFinish={(v) => statusMutation.mutate(v)}>
          <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
            <Select options={[
              { value: 'in_progress', label: 'Đang thực hiện' },
              { value: 'done', label: 'Hoàn thành' },
              { value: 'cancelled', label: 'Đã huỷ' },
            ]} />
          </Form.Item>
          <Form.Item name="progressNote" label="Ghi chú tiến độ">
            <Input.TextArea rows={3} placeholder="Cập nhật tiến độ / kết quả" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
