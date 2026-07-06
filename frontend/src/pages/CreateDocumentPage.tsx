import { useState } from 'react';
import { Form, Input, Select, DatePicker, Button, Row, Col, message, Upload, Table } from 'antd';
import { SaveOutlined, SendOutlined, MessageOutlined, ArrowLeftOutlined, FolderOpenOutlined, PaperClipOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
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

interface HeldFile { uid: string; name: string; size: number; type: string; raw: File; }

export default function CreateDocumentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const tpl = (location.state as any)?.template;
  const [form] = Form.useForm();
  const [files, setFiles] = useState<HeldFile[]>([]);

  const createMutation = useMutation({ mutationFn: (values: any) => api.post('/documents', values) });

  // Tạo hồ sơ rồi upload các tài liệu đính kèm đang giữ
  const persist = async () => {
    const values = await form.validateFields();
    // Gom người duyệt cấp 2..4 thành hàng đợi (giữ thứ tự, bỏ ô trống)
    const nextApproverIds = [values.approver2, values.approver3, values.approver4].filter(Boolean);
    const { approver2, approver3, approver4, ...rest } = values;
    const payload = { ...rest, nextApproverIds, dueDate: values.dueDate?.toISOString() };
    const { data: doc } = await createMutation.mutateAsync(payload);
    for (const f of files) {
      const fd = new FormData();
      fd.append('file', f.raw);
      await api.post(`/files/upload/${doc.id}`, fd);
    }
    return doc;
  };

  const handleSaveDraft = async () => { await persist(); message.success('Đã lưu nháp'); navigate('/draft'); };
  const handleConsult = async () => { await persist(); message.success('Đã lưu và lấy ý kiến'); navigate('/draft'); };
  const handleSubmit = async () => {
    const doc = await persist();
    await api.post(`/documents/${doc.id}/submit`);
    message.success('Đã gửi duyệt hồ sơ');
    navigate('/outbox');
  };

  const labelCol = { flex: '150px' };
  const wrapperCol = { flex: 1 };

  return (
    <div>
      {/* Thanh tiêu đề */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '2px solid #f0f0f0', marginBottom: 20 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#E4002B' }}>▦ Hồ sơ {tpl ? `— ${tpl.name}` : ''}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ color: '#E4002B', borderColor: '#E4002B' }} />
          <Button shape="circle" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setFiles([]); }} type="primary" />
        </div>
      </div>

      <Form form={form} labelCol={labelCol} wrapperCol={wrapperCol} labelAlign="left" colon={false} labelWrap
        initialValues={{ priority: 'normal', docType: tpl?.docType || 'Trình ký PDF có sẵn', status: 'Lưu nháp', workflow: 'Quy trình PDF có sẵn' }}>
        <Row gutter={40}>
          <Col xs={24} md={12}>
            <Form.Item name="title" label="Tiêu đề" required rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="priority" label="Ưu tiên" required>
              <Select options={priorityOptions} />
            </Form.Item>
            <Form.Item name="orgUnit" label="Bộ phận" required rules={[{ required: true, message: 'Nhập bộ phận' }]}>
              <Input placeholder="Tên bộ phận/phòng ban cần duyệt" />
            </Form.Item>
            <Form.Item name="dueDate" label="Thời hạn thực hiện">
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="assignedToId" label="Duyệt I" required rules={[{ required: true, message: 'Chọn người duyệt cấp 1' }]}
              tooltip="Người duyệt cấp 1 — hồ sơ được chuyển tới duyệt trước (VD: Trưởng phòng)">
              <UserSelect placeholder="VD: Trưởng phòng — tìm theo tên/email" />
            </Form.Item>
            <Form.Item name="approver2" label="Duyệt II"
              tooltip="Người duyệt cấp 2 (tùy chọn) — sau khi cấp 1 duyệt, tự chuyển tới (VD: Giám đốc)">
              <UserSelect placeholder="Để trống nếu chỉ 1 cấp" />
            </Form.Item>
            <Form.Item name="approver3" label="Duyệt III"
              tooltip="Người duyệt cấp 3 (tùy chọn) — duyệt sau cấp 2">
              <UserSelect placeholder="Để trống nếu không có" />
            </Form.Item>
            <Form.Item name="approver4" label="Duyệt IV"
              tooltip="Người duyệt cấp 4 (tùy chọn) — duyệt sau cấp 3">
              <UserSelect placeholder="Để trống nếu không có" />
            </Form.Item>
            <Form.Item name="description" label="Mô tả">
              <TextArea rows={3} />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item name="docType" label="Loại yêu cầu" required>
              <Input />
            </Form.Item>
            <Form.Item label="Tờ trình đính kèm">
              <Upload
                showUploadList={false}
                beforeUpload={(file) => {
                  setFiles((prev) => [...prev, { uid: file.uid, name: file.name, size: file.size, type: file.type, raw: file }]);
                  return false;
                }}
              >
                <Input
                  readOnly
                  value={files[0]?.name || ''}
                  placeholder="Chọn tệp tải lên"
                  suffix={<FolderOpenOutlined style={{ color: '#E4002B' }} />}
                  style={{ cursor: 'pointer' }}
                />
              </Upload>
            </Form.Item>
            <Form.Item name="status" label="Trạng thái">
              <Input disabled />
            </Form.Item>
            <Form.Item name="workflow" label="Quy trình">
              <Input disabled />
            </Form.Item>
            <Form.Item name="ccUserIds" label="Người liên quan">
              <UserSelect mode="multiple" placeholder="Chọn người được xem hồ sơ" />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      {/* Nút thao tác — căn giữa */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, margin: '8px 0 28px' }}>
        <Button danger type="primary" icon={<SaveOutlined />} onClick={handleSaveDraft} loading={createMutation.isPending}>Lưu</Button>
        <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit} loading={createMutation.isPending}>Gửi duyệt</Button>
        <Button icon={<MessageOutlined />} onClick={handleConsult} loading={createMutation.isPending}>Lấy ý kiến</Button>
      </div>

      {/* Bảng tài liệu liên quan — header đỏ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, borderBottom: '2px solid #E4002B', paddingBottom: 4 }}>Tài liệu liên quan đính kèm</span>
        <Upload
          showUploadList={false}
          beforeUpload={(file) => {
            setFiles((prev) => [...prev, { uid: file.uid, name: file.name, size: file.size, type: file.type, raw: file }]);
            return false;
          }}
        >
          <Button danger type="primary" icon={<PaperClipOutlined />}>Đính kèm</Button>
        </Upload>
      </div>
      <Table
        rowKey="uid"
        size="small"
        dataSource={files}
        locale={{ emptyText: 'Không có dữ liệu' }}
        pagination={false}
        scroll={{ x: 'max-content' }}
        columns={[
          { title: '#', render: (_t, _r, i) => i + 1, width: 60 },
          { title: 'Tên tài liệu', dataIndex: 'name' },
          { title: 'Kiểu dữ liệu', dataIndex: 'type', render: (v: string) => v || '—' },
          { title: 'Kích thước (MB)', dataIndex: 'size', render: (v: number) => (v / 1048576).toFixed(2) },
          {
            title: 'Thao tác', width: 100,
            render: (_t, r: HeldFile) => (
              <Button size="small" danger onClick={() => setFiles((prev) => prev.filter((f) => f.uid !== r.uid))}>Xóa</Button>
            ),
          },
        ]}
        components={{ header: { cell: (props: any) => <th {...props} style={{ ...props.style, background: '#E4002B', color: '#fff', fontWeight: 600 }} /> } }}
      />
    </div>
  );
}
