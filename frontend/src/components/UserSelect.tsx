import { useState, useEffect } from 'react';
import { Select, Spin } from 'antd';
import { api } from '../lib/api';

interface UserOption {
  id: string;
  fullName: string;
  email: string;
  orgUnit: string;
}

interface Props {
  value?: string | string[];
  onChange?: (value: any) => void;
  mode?: 'multiple';
  placeholder?: string;
  role?: string;    // lọc theo vai trò (vd 'director')
  orgUnit?: string; // lọc theo phòng ban (vd 'Phòng Kế toán')
}

// Ô chọn người dùng có tìm kiếm theo tên/email (dùng cho Chuyển tới, Người liên quan, Người duyệt)
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
      mode={mode}
      value={value}
      onChange={onChange}
      onSearch={onSearch}
      filterOption={false}
      loading={loading}
      placeholder={placeholder || 'Tìm theo tên hoặc email'}
      notFoundContent={loading ? <Spin size="small" /> : 'Không tìm thấy'}
      style={{ width: '100%' }}
      options={options.map((u) => ({
        value: u.id,
        label: `${u.fullName} (${u.email})${u.orgUnit ? ' · ' + u.orgUnit : ''}`,
      }))}
    />
  );
}
