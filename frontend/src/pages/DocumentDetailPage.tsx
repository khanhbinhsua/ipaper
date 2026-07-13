import { useState } from 'react';
import {
  Card, Descriptions, Tag, Button, Space, Timeline, Modal, Input,
  message, Spin, Tabs, Empty, Upload, List,
} from 'antd';
import {
  CheckOutlined, CloseOutlined, RollbackOutlined, ArrowLeftOutlined,
  UploadOutlined, DownloadOutlined, DeleteOutlined, FileOutlined,
  SendOutlined, CheckCircleOutlined, EyeOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { vnTime } from '../lib/datetime';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import UserSelect from '../components/UserSelect';

const { TextArea } = Input;

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
const actionLabels: Record<string, string> = {
  submit: 'đã gửi duyệt', approve: 'đã duyệt', reject: 'đã từ chối',
  return: 'đã trả về', save_draft: 'đã lưu nháp', complete: 'đã hoàn thành',
};

type ActionType = 'approve' | 'reject' | 'return';

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [modal, setModal] = useState<ActionType | null>(null);
  const [comment, setComment] = useState('');
  const [forwardOpen, setForwardOpen] = useState(false);
  const [nextAssignee, setNextAssignee] = useState<string>();
  const [viewer, setViewer] = useState<{ url: string; name: string } | null>(null);

  const { data: doc, isLoading, refetch } = useQuery({
    queryKey: ['document', id],
    queryFn: async () => (await api.get(`/documents/${id}`)).data,
  });

  const actionMutation = useMutation({
    mutationFn: ({ action, comment }: { action: ActionType; comment: string }) =>
      api.post(`/documents/${id}/${action}`, { comment }),
    onSuccess: () => {
      message.success('Thao tác thành công');
      setModal(null); setComment(''); refetch();
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Lỗi thao tác'),
  });

  const forwardMutation = useMutation({
    mutationFn: () => api.post(`/documents/${id}/forward`, { nextAssigneeId: nextAssignee, comment }),
    onSuccess: () => {
      message.success('Đã gửi duyệt tiếp');
      setForwardOpen(false); setNextAssignee(undefined); setComment(''); refetch();
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Lỗi gửi duyệt'),
  });

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/documents/${id}/complete`),
    onSuccess: () => { message.success('Đã hoàn thành — đã sinh PDF lịch sử phê duyệt'); refetch(); },
    onError: (e: any) => message.error(e.response?.data?.message || 'Lỗi hoàn thành'),
  });

  if (isLoading) return <Spin />;
  if (!doc) return <Empty description="Không tìm thấy hồ sơ" />;

  const canApprove = doc.assignedToId === user?.id && doc.status === 'pending';
  // Người tạo điều phối: hồ sơ đã duyệt 1 cấp đang ở mình → gửi tiếp hoặc hoàn thành
  const canRoute = doc.createdById === user?.id && doc.status === 'approved';
  // Hồ sơ bị trả về → người tạo trình lại
  const canResubmit = doc.createdById === user?.id && doc.status === 'returned';

  const modalTitles: Record<ActionType, string> = {
    approve: 'Xác nhận Duyệt', reject: 'Xác nhận Từ chối', return: 'Xác nhận Trả về',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>Quay về</Button>
          <h2 style={{ margin: 0 }}>{doc.title}</h2>
          <Tag color={statusColors[doc.status]}>{statusLabels[doc.status]}</Tag>
        </Space>
        {canApprove && (
          <Space>
            <Button icon={<RollbackOutlined />} onClick={() => setModal('return')}>Trả về</Button>
            <Button danger icon={<CloseOutlined />} onClick={() => setModal('reject')}>Từ chối</Button>
            <Button type="primary" icon={<CheckOutlined />} onClick={() => setModal('approve')}>Duyệt</Button>
          </Space>
        )}
        {canRoute && (
          <Space>
            <Button type="primary" icon={<SendOutlined />} onClick={() => setForwardOpen(true)}>Gửi duyệt tiếp</Button>
            <Button icon={<CheckCircleOutlined />} style={{ background: '#52c41a', color: '#fff', borderColor: '#52c41a' }}
              loading={completeMutation.isPending}
              onClick={() => completeMutation.mutate()}>Hoàn thành</Button>
          </Space>
        )}
        {canResubmit && (
          <Button type="primary" icon={<SendOutlined />} onClick={() => setForwardOpen(true)}>Trình lại</Button>
        )}
      </div>

      <Card title="Thông tin yêu cầu" style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="Tiêu đề">{doc.title}</Descriptions.Item>
          <Descriptions.Item label="Bộ phận">{doc.orgUnit}</Descriptions.Item>
          <Descriptions.Item label="Loại yêu cầu">{doc.docType}</Descriptions.Item>
          <Descriptions.Item label="Ưu tiên">{priorityLabels[doc.priority]}</Descriptions.Item>
          <Descriptions.Item label="Người tạo">{doc.createdBy?.fullName}</Descriptions.Item>
          <Descriptions.Item label="Người duyệt">{doc.assignedTo?.fullName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Ngày hoàn thiện">
            {doc.dueDate ? dayjs(doc.dueDate).format('DD/MM/YYYY') : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={statusColors[doc.status]}>{statusLabels[doc.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Mô tả" span={2}>{doc.description || '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="Hoạt động">
        <Tabs
          items={[
            {
              key: 'workflow', label: 'Lịch sử quy trình',
              children: doc.approvals?.length ? (
                <Timeline
                  items={[...doc.approvals]
                    .sort((a: any, b: any) => dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix())
                    .map((a: any) => ({
                      color: a.action === 'approve' ? 'green' : a.action === 'reject' ? 'red' : 'blue',
                      children: (
                        <div>
                          <b>{actionLabels[a.action]}</b> — bước {a.step}
                          <div style={{ color: '#888', fontSize: 12 }}>
                            {vnTime(a.createdAt)}
                          </div>
                          {a.comment && <div style={{ marginTop: 4 }}>💬 {a.comment}</div>}
                        </div>
                      ),
                    }))}
                />
              ) : <Empty description="Chưa có lịch sử" />,
            },
            {
              key: 'files', label: 'Tài liệu bổ sung',
              children: (
                <div>
                  <Upload
                    showUploadList={false}
                    customRequest={async ({ file, onSuccess, onError }) => {
                      const fd = new FormData();
                      fd.append('file', file as File);
                      try {
                        await api.post(`/files/upload/${id}`, fd);
                        message.success('Đã tải lên');
                        refetch();
                        onSuccess?.({});
                      } catch (e) {
                        message.error('Tải lên thất bại');
                        onError?.(e as Error);
                      }
                    }}
                  >
                    <Button icon={<UploadOutlined />} style={{ marginBottom: 16 }}>Đính kèm tài liệu</Button>
                  </Upload>
                  {doc.attachments?.length ? (
                    <List
                      dataSource={doc.attachments}
                      renderItem={(f: any) => (
                        <List.Item
                          actions={[
                            ...(f.mimetype === 'application/pdf' ? [
                              <Button key="view" size="small" type="link" icon={<EyeOutlined />}
                                onClick={async () => {
                                  const { data } = await api.get(`/files/${f.id}/url`, { params: { inline: true } });
                                  setViewer({ url: data.url, name: f.filename });
                                }}>Xem</Button>,
                            ] : []),
                            <Button key="dl" size="small" icon={<DownloadOutlined />}
                              onClick={async () => {
                                const { data } = await api.get(`/files/${f.id}/url`);
                                window.open(data.url, '_blank');
                              }}>Tải</Button>,
                            <Button key="rm" size="small" danger icon={<DeleteOutlined />}
                              onClick={async () => { await api.delete(`/files/${f.id}`); refetch(); }}>Xóa</Button>,
                          ]}
                        >
                          <List.Item.Meta
                            avatar={<FileOutlined style={{ fontSize: 20 }} />}
                            title={f.filename}
                            description={`${(f.size / 1048576).toFixed(2)} MB · ${f.mimetype}`}
                          />
                        </List.Item>
                      )}
                    />
                  ) : <Empty description="Chưa có tài liệu đính kèm" />}
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={modal ? modalTitles[modal] : ''}
        open={!!modal}
        onOk={() => actionMutation.mutate({ action: modal!, comment })}
        onCancel={() => { setModal(null); setComment(''); }}
        confirmLoading={actionMutation.isPending}
        okText="Xác nhận"
        cancelText="Hủy"
      >
        <TextArea
          rows={4}
          placeholder="Nhập ý kiến của bạn..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </Modal>

      <Modal
        title={canResubmit ? 'Trình lại hồ sơ' : 'Gửi duyệt tiếp (cấp trên)'}
        open={forwardOpen}
        onOk={() => { if (!nextAssignee) { message.warning('Chọn người duyệt tiếp'); return; } forwardMutation.mutate(); }}
        onCancel={() => { setForwardOpen(false); setNextAssignee(undefined); setComment(''); }}
        confirmLoading={forwardMutation.isPending}
        okText="Gửi duyệt" cancelText="Hủy"
      >
        <div style={{ marginBottom: 8 }}>Chọn người duyệt tiếp theo (vd: Giám đốc):</div>
        <UserSelect value={nextAssignee} onChange={setNextAssignee} placeholder="Tìm người duyệt theo tên/email" />
        <TextArea style={{ marginTop: 12 }} rows={3} placeholder="Ý kiến (tùy chọn)..."
          value={comment} onChange={(e) => setComment(e.target.value)} />
      </Modal>

      {/* Xem PDF trực tiếp trong app */}
      <Modal
        title={viewer?.name}
        open={!!viewer}
        onCancel={() => setViewer(null)}
        footer={null}
        width="90%"
        style={{ top: 20 }}
        styles={{ body: { height: '82vh', padding: 0 } }}
      >
        {viewer && (
          <iframe src={viewer.url} title={viewer.name} style={{ width: '100%', height: '100%', border: 'none' }} />
        )}
      </Modal>
    </div>
  );
}
