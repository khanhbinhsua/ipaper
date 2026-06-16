import { useState } from 'react';
import {
  Card, Tabs, Form, Select, DatePicker, Checkbox, Input, Button, Table,
  Tag, Space, message, Modal,
} from 'antd';
import { useQuery, useMutation } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '../lib/api';
import UserSelect from '../components/UserSelect';

const leaveTypes = [
  { value: 'annual', label: 'Phép năm' },
  { value: 'sick', label: 'Nghỉ ốm' },
  { value: 'unpaid', label: 'Nghỉ không lương' },
  { value: 'personal', label: 'Nghỉ việc riêng' },
];
const statusColors: Record<string, string> = { pending: 'processing', approved: 'success', rejected: 'error' };
const statusLabels: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' };
const typeLabels = Object.fromEntries(leaveTypes.map((t) => [t.value, t.label]));

function CreateLeaveForm({ onDone }: { onDone: () => void }) {
  const [form] = Form.useForm();
  const mutation = useMutation({
    mutationFn: (v: any) => api.post('/leave', v),
    onSuccess: () => { message.success('Đã gửi đơn nghỉ'); form.resetFields(); onDone(); },
    onError: (e: any) => message.error(e.response?.data?.message || 'Lỗi gửi đơn'),
  });

  return (
    <Form form={form} layout="vertical" style={{ maxWidth: 560 }}
      onFinish={(v) => mutation.mutate({
        ...v,
        fromDate: v.range[0].format('YYYY-MM-DD'),
        toDate: v.range[1].format('YYYY-MM-DD'),
        range: undefined,
      })}>
      <Form.Item name="leaveType" label="Loại nghỉ phép" rules={[{ required: true }]}>
        <Select options={leaveTypes} placeholder="Chọn loại nghỉ" />
      </Form.Item>
      <Form.Item name="range" label="Từ ngày — Đến ngày" rules={[{ required: true }]}>
        <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
      </Form.Item>
      <Space size="large">
        <Form.Item name="halfAm" valuePropName="checked" noStyle><Checkbox>Nghỉ buổi sáng (ngày đầu)</Checkbox></Form.Item>
        <Form.Item name="halfPm" valuePropName="checked" noStyle><Checkbox>Nghỉ buổi chiều (ngày cuối)</Checkbox></Form.Item>
      </Space>
      <Form.Item name="approverId" label="Người duyệt (cấp quản lý)" rules={[{ required: true }]} style={{ marginTop: 16 }}>
        <UserSelect placeholder="Tìm quản lý theo tên/email" />
      </Form.Item>
      <Button type="primary" htmlType="submit" loading={mutation.isPending}>Gửi duyệt</Button>
    </Form>
  );
}

export default function LeavePage() {
  const [tab, setTab] = useState('create');
  const [decision, setDecision] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [comment, setComment] = useState('');

  const mine = useQuery({ queryKey: ['leave-mine'], queryFn: async () => (await api.get('/leave/mine')).data, enabled: tab === 'mine' });
  const pending = useQuery({ queryKey: ['leave-pending'], queryFn: async () => (await api.get('/leave/pending')).data, enabled: tab === 'pending' });

  const decideMutation = useMutation({
    mutationFn: ({ id, action, comment }: any) => api.post(`/leave/${id}/${action}`, { comment }),
    onSuccess: () => { message.success('Đã xử lý đơn'); setDecision(null); setComment(''); pending.refetch(); },
  });

  const dateRange = (r: any) =>
    `${dayjs(r.fromDate).format('DD/MM')}${r.halfAm ? ' (chiều)' : ''} → ${dayjs(r.toDate).format('DD/MM/YYYY')}${r.halfPm ? ' (sáng)' : ''}`;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Đăng ký nghỉ phép</h2>
      <Card>
        <Tabs activeKey={tab} onChange={setTab} items={[
          { key: 'create', label: 'Tạo đơn', children: <CreateLeaveForm onDone={() => setTab('mine')} /> },
          {
            key: 'mine', label: 'Đơn của tôi',
            children: <Table rowKey="id" loading={mine.isLoading} dataSource={mine.data ?? []} pagination={false}
              columns={[
                { title: 'Loại', dataIndex: 'leaveType', render: (v: string) => typeLabels[v] ?? v },
                { title: 'Thời gian', render: (_: any, r: any) => dateRange(r) },
                { title: 'Trạng thái', dataIndex: 'status', render: (v: string) => <Tag color={statusColors[v]}>{statusLabels[v]}</Tag> },
                { title: 'Ý kiến duyệt', dataIndex: 'approverComment', render: (v: string) => v || '—' },
              ]} />,
          },
          {
            key: 'pending', label: 'Chờ tôi duyệt',
            children: <Table rowKey="id" loading={pending.isLoading} dataSource={pending.data ?? []} pagination={false}
              columns={[
                { title: 'Người nghỉ', render: (_: any, r: any) => r.user?.fullName || r.user?.username },
                { title: 'Loại', dataIndex: 'leaveType', render: (v: string) => typeLabels[v] ?? v },
                { title: 'Thời gian', render: (_: any, r: any) => dateRange(r) },
                {
                  title: 'Thao tác', render: (_: any, r: any) => (
                    <Space>
                      <Button size="small" type="primary" onClick={() => setDecision({ id: r.id, action: 'approve' })}>Duyệt</Button>
                      <Button size="small" danger onClick={() => setDecision({ id: r.id, action: 'reject' })}>Từ chối</Button>
                    </Space>
                  ),
                },
              ]} />,
          },
        ]} />
      </Card>

      <Modal
        title={decision?.action === 'approve' ? 'Duyệt đơn nghỉ' : 'Từ chối đơn nghỉ'}
        open={!!decision}
        onOk={() => decideMutation.mutate({ ...decision, comment })}
        onCancel={() => { setDecision(null); setComment(''); }}
        confirmLoading={decideMutation.isPending}
        okText="Xác nhận" cancelText="Hủy"
      >
        <Input.TextArea rows={3} placeholder="Ý kiến..." value={comment} onChange={(e) => setComment(e.target.value)} />
      </Modal>
    </div>
  );
}
