import { useState } from 'react';
import { Row, Col, Card, Statistic, DatePicker, Button, Spin } from 'antd';
import {
  InboxOutlined, SendOutlined, FileTextOutlined, TeamOutlined, PlusCircleOutlined,
} from '@ant-design/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '../lib/api';

const { RangePicker } = DatePicker;
const COLORS = { approved: '#52c41a', rejected: '#ff4d4f', pending: '#faad14' };

interface Stats {
  counters: { inbox: number; outbox: number; draft: number; related: number };
  chart: { approved: number; rejected: number; pending: number; total: number };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);

  const { data, isLoading } = useQuery<Stats>({
    queryKey: ['statistics', range],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (range) { params.fromDate = range[0].toISOString(); params.toDate = range[1].toISOString(); }
      const { data } = await api.get('/documents/statistics', { params });
      return data;
    },
  });

  const counters = [
    { key: 'inbox', label: 'Hồ sơ đến', value: data?.counters.inbox ?? 0, icon: <InboxOutlined />, color: '#1677ff', path: '/inbox' },
    { key: 'outbox', label: 'Hồ sơ đi', value: data?.counters.outbox ?? 0, icon: <SendOutlined />, color: '#52c41a', path: '/outbox' },
    { key: 'draft', label: 'Hồ sơ nháp', value: data?.counters.draft ?? 0, icon: <FileTextOutlined />, color: '#faad14', path: '/draft' },
    { key: 'related', label: 'Hồ sơ liên quan', value: data?.counters.related ?? 0, icon: <TeamOutlined />, color: '#722ed1', path: '/related' },
  ];

  const pieData = data ? [
    { name: 'Đã duyệt', value: data.chart.approved, key: 'approved' },
    { name: 'Từ chối', value: data.chart.rejected, key: 'rejected' },
    { name: 'Chưa duyệt', value: data.chart.pending, key: 'pending' },
  ] : [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Thống kê hồ sơ</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          <RangePicker
            value={range}
            onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
            placeholder={['Từ ngày', 'Đến ngày']}
          />
          <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => navigate('/create')}>
            Tạo yêu cầu
          </Button>
        </div>
      </div>

      <Spin spinning={isLoading}>
        <Row gutter={16}>
          {counters.map((c) => (
            <Col span={6} key={c.key}>
              <Card hoverable onClick={() => navigate(c.path)} style={{ borderTop: `3px solid ${c.color}` }}>
                <Statistic title={c.label} value={c.value} prefix={<span style={{ color: c.color }}>{c.icon}</span>} />
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={16} style={{ marginTop: 24 }}>
          <Col span={12}>
            <Card title="Trạng thái hồ sơ">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {pieData.map((entry) => (
                      <Cell key={entry.key} fill={COLORS[entry.key as keyof typeof COLORS]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col span={12}>
            <Card title="Tổng quan">
              <Row gutter={[16, 16]}>
                <Col span={12}><Statistic title="Tổng số hồ sơ" value={data?.chart.total ?? 0} /></Col>
                <Col span={12}><Statistic title="Đã duyệt" value={data?.chart.approved ?? 0} valueStyle={{ color: COLORS.approved }} /></Col>
                <Col span={12}><Statistic title="Từ chối" value={data?.chart.rejected ?? 0} valueStyle={{ color: COLORS.rejected }} /></Col>
                <Col span={12}><Statistic title="Chưa duyệt" value={data?.chart.pending ?? 0} valueStyle={{ color: COLORS.pending }} /></Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
