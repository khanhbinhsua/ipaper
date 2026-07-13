import { useState, useEffect } from 'react';
import { Select, Spin } from 'antd';
import { api } from '../lib/api';

interface UserOption {
  id: string;
  username: string;
  fullName: string;
  email: string;
  orgUnit: string;
  role: string;
}

interface Props {
  value?: string | string[];
  onChange?: (value: any) => void;
  mode?: 'multiple';
  placeholder?: string;
  role?: string;    // lọc theo vai trò (vd 'director')
  orgUnit?: string; // lọc theo phòng ban (vd 'Phòng Kế toán')
}

const ROLE_LABELS: Record<string, string> = {
  staff: 'Nhân viên', manager: 'Trưởng phòng', director: 'Ban Giám đốc', admin: 'Quản trị',
};

// Ô chọn người dùng có tìm kiếm; hiển thị 2 dòng (tên + chức vụ) cho dễ nhận biết
export default function UserSelect({ value, onChange, mode, placeholder, role, orgUnit }: Props) {
  const [options, setOptions] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async (q?: string) => {
    setLoading(true);
    try {
      const { data } = await api.get('/users/search', { params: { q, role, orgUnit } });
      setOptions(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [role, orgUnit]);

  let timer: ReturnType<typeof setTimeout>;
  const onSearch = (q: string) => {
    clearTimeout(timer);
    timer = setTimeout(() => fetchUsers(q), 300);
  };

  return (
    <Select
      showSearch
      allowClear
      mode={mode}
      value={value}
      onChange={onChange}
      onSearch={onSearch}
      filterOption={false}
      loading={loading}
      placeholder={placeholder || 'Tìm theo tên hoặc email'}
      notFoundContent={loading ? <Spin size="small" /> : 'Không tìm thấy'}
      style={{ width: '100%' }}
      optionLabelProp="label"
      options={options.map((u) => ({
        value: u.id,
        // Nhãn hiển thị khi ĐÃ chọn (gọn, dễ thấy người được chuyển)
        label: `${u.fullName}${u.orgUnit ? ' - ' + u.orgUnit : ''}`,
        // dữ liệu để render 2 dòng trong dropdown
        u,
      }))}
      optionRender={(opt) => {
        const u = (opt.data as any).u as UserOption;
        return (
          <div style={{ lineHeight: 1.3, padding: '2px 0' }}>
            <div style={{ fontWeight: 600 }}>
              {u.username} {(u.fullName || '').toUpperCase()}{u.orgUnit ? ` - ${u.orgUnit}` : ''}
              {u.email ? ` (${u.email})` : ''}
            </div>
            <div style={{ fontStyle: 'italic', color: '#888', fontSize: 12 }}>
              {ROLE_LABELS[u.role] || u.role}
            </div>
          </div>
        );
      }}
    />
  );
}
