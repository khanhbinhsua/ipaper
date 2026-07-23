import { Modal, Spin } from 'antd';

interface Props {
  open: boolean;
  onClose: () => void;
  url?: string;
  filename?: string;
  mimeType?: string;
}

// Kiểm tra file có xem được inline không (ảnh hoặc PDF)
export function canPreview(mimeType?: string): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}

// Modal xem trực tiếp file (ảnh + PDF) không cần tải về
export default function FilePreviewModal({ open, onClose, url, filename, mimeType }: Props) {
  const isImage = mimeType?.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={filename || 'Xem file'}
      footer={null}
      width="85%"
      style={{ top: 20 }}
      styles={{ body: { height: '82vh', padding: 0, background: '#f0f0f0' } }}
      destroyOnHidden
    >
      {!url ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Spin />
        </div>
      ) : isImage ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', overflow: 'auto' }}>
          <img src={url} alt={filename} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        </div>
      ) : isPdf ? (
        <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }} title={filename} />
      ) : (
        <div style={{ padding: 24, textAlign: 'center', color: '#888' }}>
          Không hỗ trợ xem trực tiếp định dạng này. Vui lòng tải về.
        </div>
      )}
    </Modal>
  );
}
