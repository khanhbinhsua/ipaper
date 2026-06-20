import { useState } from 'react';
import {
  Card, Table, Button, Tag, Modal, Form, Input, Select, message, Switch,
} from 'antd';
import { UserAddOutlined, EditOutlined, KeyOutlined } from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';

const roleOptions = [
  { value: 'staff', label: 'Nhân viên' },
  { value: 'manager', label: 'Trưởng phòng' },
  { value: 'director', label: 'Ban giám đốc' },
  { value: 'admin', label: 'Quản trị' },
];
const roleColors: Record<string, string> = { staff: 'default', manager: 'blue', director: 'purple', admin: 'red' };
const roleLabels = Object.fromEntries(roleOptions.map((r) => [r.value, r.label]));

export default function AdminUsersPage() {
  const me = useAuthStore((s) => s.user);
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<any | null>(null); // null=đóng, {}=tạo mới, {id}=sửa
  const isCreate = editing && !editing.id;

  const { data: users, isLoading, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get('/users/admin/all')).data,
  });

  const saveMutation = useMutation({
    mutationFn: (v: any) =>
      isCreate ? api.post('/users/admin', v) : api.patch(`/users/admin/${editing.id}`, v),
    onSuccess: () => {
      message.success(isCreate ? 'Đã tạo tài khoản' : 'Đã cập nhật');
      setEditing(null); form.resetFields(); refetch();
    },
    onError: (e: any) => message.error(e.response?.data?.message || 'Lỗi lưu'),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/users/admin/${id}`, { isActive }),
    onSuccess: () => { message.success('Đã cập nhật trạng thái'); refetch(); },
  });

  const openCreate = () => { form.resetFields(); form.setFieldsValue({ role: 'staff' }); setEditing({}); };
  const openEdit = (u: any) => { form.resetFields(); form.setFieldsValue({ fullName: u.fullName, orgUnit: u.orgUnit, role: u.role }); setEditing(u); };

  const columns = [
    { title: 'Tên đăng nhập', dataIndex: 'username' },
    { title: 'Họ tên', dataIndex: 'fullName', render: (v: string) => v || '—' },
    { title: 'Email', dataIndex: 'email' },
    { title: 'Bộ phận', dataIndex: 'orgUnit', render: (v: string) => v || '—' },
    { title: 'Vai trò', dataIndex: 'role', render: (v: string) => <Tag color={roleColors[v]}>{roleLabels[v] || v}</Tag> },
    {
      title: 'Trạng thái', dataIndex: 'isActive',
      render: (v: boolean, r: any) => (
        <Switch checked={v} size="small" disabled={r.id === me?.id}
          onChange={(val) => toggleActive.mutate({ id: r.id, isActive: val })} />
      ),
    },
    {
      title: 'Thao tác', width: 110,
      render: (_: any, r: any) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Sửa</Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Quản trị người dùng</h2>
        <Button type="primary" icon={<UserAddOutlined />} onClick={openCreate}>Tạo tài khoản</Button>
      </div>

      <Card>
        <Table rowKey="id" loading={isLoading} columns={columns} dataSource={users ?? []}
          scroll={{ x: 'max-content' }}
          pagination={{ pageSize: 15, showTotal: (t) => `Tổng ${t} người dùng` }} />
      </Card>

      <Modal
        title={isCreate ? 'Tạo tài khoản mới' : `Sửa tài khoản: ${editing?.username || ''}`}
        open={!!editing}
        onOk={() => form.submit()}
        onCancel={() => { setEditing(null); form.resetFields(); }}
        confirmLoading={saveMutation.isPending}
        okText="Lưu" cancelText="Hủy"
      >
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          {isCreate && (
            <>
              <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true }]}>
                <Input placeholder="vd: nguyenvana" />
              </Form.Item>
              <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                <Input placeholder="email@ipaper.vn" />
              </Form.Item>
            </>
          )}
          <Form.Item name="fullName" label="Họ và tên" rules={[{ required: true }]}>
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>
          <Form.Item name="orgUnit" label="Bộ phận / Phòng ban">
            <Input placeholder="vd: Phòng Kế toán" />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item name="password" label={isCreate ? 'Mật khẩu' : 'Đặt lại mật khẩu (để trống nếu không đổi)'}
            rules={isCreate ? [{ required: true, min: 6, message: 'Tối thiểu 6 ký tự' }] : [{ min: 6, message: 'Tối thiểu 6 ký tự' }]}>
            <Input.Password prefix={<KeyOutlined />} placeholder="Mật khẩu" autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
