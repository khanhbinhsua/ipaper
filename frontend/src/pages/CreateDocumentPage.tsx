import { Form, Input, Select, DatePicker, Button, Card, Row, Col, message, Space } from 'antd';
import { SaveOutlined, SendOutlined, RollbackOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import UserSelect from '../components/UserSelect';

const { TextArea } = Input;

const priorityOptions = [
  { value: 'low', label: 'Thấp' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'high', label: 'Cao' },
  { value: 'urgent', label: 'Khẩn' },
];

export default function CreateDocumentPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const createMutation = useMutation({
    mutationFn: (values: any) => api.post('/documents', values),
  });

  const handleSaveDraft = async () => {
    const values = await form.validateFields();
    const payload = { ...values, dueDate: values.dueDate?.toISOString() };
    const { data } = await createMutation.mutateAsync(payload);
    message.success('Đã lưu nháp');
    navigate('/draft');
    return data;
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload = { ...values, dueDate: values.dueDate?.toISOString() };
    const { data } = await createMutation.mutateAsync(payload);
    await api.post(`/documents/${data.id}/submit`);
    message.success('Đã gửi duyệt hồ sơ');
    navigate('/outbox');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Tạo yêu cầu</h2>
        <Space>
          <Button icon={<RollbackOutlined />} onClick={() => navigate('/')}>Lùi</Button>
          <Button icon={<SaveOutlined />} onClick={handleSaveDraft} loading={createMutation.isPending}>Lưu nháp</Button>
          <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit} loading={createMutation.isPending}>Gửi duyệt</Button>
        </Space>
      </div>

      <Card title="Thông tin hồ sơ">
        <Form form={form} layout="vertical" initialValues={{ priority: 'normal' }}>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
                <Input placeholder="Tên ngắn gọn của yêu cầu" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="docType" label="Loại yêu cầu">
                <Input placeholder="Loại yêu cầu của hồ sơ" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="Ưu tiên">
                <Select options={priorityOptions} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="orgUnit" label="Bộ phận">
                <Input placeholder="Tên bộ phận/phòng ban cần duyệt" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dueDate" label="Ngày hoàn thiện">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assignedToId" label="Chuyển tới (người duyệt)">
                <UserSelect placeholder="Tìm người duyệt theo tên/email" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="ccUserIds" label="Người liên quan (CC)">
                <UserSelect mode="multiple" placeholder="Chọn người được xem hồ sơ" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label="Mô tả">
                <TextArea rows={4} placeholder="Thông tin mô tả của yêu cầu" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  );
}
