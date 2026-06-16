import { Card, Form, Input, Button, message, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const mutation = useMutation({
    mutationFn: (v: { currentPassword: string; newPassword: string }) =>
      api.patch('/auth/change-password', v),
    onSuccess: () => { message.success('Đổi mật khẩu thành công'); form.resetFields(); navigate('/'); },
    onError: (e: any) => message.error(e.response?.data?.message || 'Đổi mật khẩu thất bại'),
  });

  return (
    <div style={{ maxWidth: 520 }}>
      <h2 style={{ marginTop: 0 }}>Đổi mật khẩu</h2>
      <Card>
        <Alert
          type="info" showIcon style={{ marginBottom: 16 }}
          message="Mật khẩu mới phải có: chữ hoa, số, ký tự đặc biệt và tối thiểu 7 ký tự."
        />
        <Form form={form} layout="vertical"
          onFinish={(v) => mutation.mutate({ currentPassword: v.currentPassword, newPassword: v.newPassword })}>
          <Form.Item name="currentPassword" label="Mật khẩu hiện tại" rules={[{ required: true }]}>
            <Input.Password placeholder="Nhập mật khẩu hiện tại" />
          </Form.Item>
          <Form.Item name="newPassword" label="Mật khẩu mới" rules={[
            { required: true },
            { min: 7, message: 'Tối thiểu 7 ký tự' },
            { pattern: /(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])/, message: 'Cần chữ hoa, số và ký tự đặc biệt' },
          ]}>
            <Input.Password placeholder="Nhập mật khẩu mới" />
          </Form.Item>
          <Form.Item name="confirm" label="Xác nhận mật khẩu mới" dependencies={['newPassword']} rules={[
            { required: true },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
              },
            }),
          ]}>
            <Input.Password placeholder="Nhập lại mật khẩu mới" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>Lưu</Button>
        </Form>
      </Card>
    </div>
  );
}
