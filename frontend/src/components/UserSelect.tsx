import { useState, useEffect, useRef } from 'react';
import { Select, Spin } from 'antd';
import { api } from '../lib/api';

// Chuẩn hoá chuỗi để so sánh không phân biệt hoa/thường & dấu tiếng Việt.
// VD: "Toàn" và "toan" đều thành "toan".
const normalize = (s: string) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUsers = async (q?: string) => {
    setLoading(true);
    try {
      const { data } = await api.get('/users/search', { params: { q, role, orgUnit } });
      setOptions((prev) => mergeById(prev, data));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [role, orgUnit]);

  // Khi có value nhưng chưa có option tương ứng (vd điền sẵn từ biểu mẫu, hoặc user không nằm trong 20 kết quả đầu)
  // → gọi API lấy user theo ids để hiển thị đúng TÊN thay vì UUID
  useEffect(() => {
    const ids = (Array.isArray(value) ? value : value ? [value] : []).filter(Boolean);
    if (!ids.length) return;
    const known = new Set(options.map((o) => o.id));
    const missing = ids.filter((id) => !known.has(id));
    if (!missing.length) return;
    (async () => {
      try {
        const { data } = await api.get('/users/search', { params: { ids: missing.join(',') } });
        setOptions((prev) => mergeById(prev, data));
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Server-side search: debounce 300ms để bổ sung kết quả khi người tìm không nằm trong 20 user đầu
  const onSearch = (q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchUsers(q), 300);
  };

  return (
    <Select
      showSearch
      allowClear
      mode={mode}
      value={value}
      onChange={onChange}
      onSearch={onSearch}
      // Lọc client-side trên các option đang có: khớp không phân biệt hoa/thường & dấu tiếng Việt
      filterOption={(input, option) => {
        if (!input) return true;
        const q = normalize(input);
        const u = (option as any)?.u as UserOption | undefined;
        if (!u) return true;
        const hay = normalize(`${u.username} ${u.fullName} ${u.email} ${u.orgUnit}`);
        return hay.includes(q);
      }}
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

// Trộn 2 danh sách user, bỏ trùng theo id (giữ bản mới nhất)
function mergeById(prev: UserOption[], next: UserOption[]): UserOption[] {
  const map = new Map(prev.map((u) => [u.id, u]));
  for (const u of next) map.set(u.id, u);
  return Array.from(map.values());
}
