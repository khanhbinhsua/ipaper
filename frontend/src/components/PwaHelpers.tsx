import { useEffect, useState } from 'react';
import { Button, notification, Modal } from 'antd';
import { DownloadOutlined, ReloadOutlined, MobileOutlined } from '@ant-design/icons';
import { registerSW } from 'virtual:pwa-register';

// Ghi nhớ để không hỏi cài đặt lại nếu user đã bỏ qua
const DISMISS_KEY = 'ipaper-pwa-install-dismissed';
const IOS_HINT_KEY = 'ipaper-ios-hint-shown';

export default function PwaHelpers() {
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    // Đăng ký service worker; hỏi refresh khi có bản mới
    const update = registerSW({
      onNeedRefresh() { setNeedRefresh(true); },
      onOfflineReady() { /* im lặng, không quấy user */ },
    });
    setUpdateSW(() => update);

    // Chrome/Edge Android: browser bắn beforeinstallprompt khi đủ điều kiện PWA
    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (!dismissed && !isStandalone()) setInstallEvent(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS Safari: không có beforeinstallprompt → hiện hint 1 lần
    if (isIOSSafari() && !isStandalone() && !localStorage.getItem(IOS_HINT_KEY)) {
      setTimeout(() => setShowIosHint(true), 3000);
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  // Thông báo "cài đặt iPaper" (Android/Chrome)
  useEffect(() => {
    if (!installEvent) return;
    const key = 'install-pwa';
    notification.open({
      key,
      message: 'Cài đặt iPaper vào máy',
      description: 'Cài để nhận thông báo tức thời và mở nhanh như một app.',
      placement: 'bottomRight',
      duration: 0,
      icon: <MobileOutlined style={{ color: '#E4002B' }} />,
      btn: (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1');
            notification.destroy(key);
            setInstallEvent(null);
          }}>Để sau</Button>
          <Button size="small" type="primary" icon={<DownloadOutlined />}
            onClick={async () => {
              installEvent.prompt();
              await installEvent.userChoice;
              notification.destroy(key);
              setInstallEvent(null);
            }}>Cài đặt</Button>
        </div>
      ),
    });
  }, [installEvent]);

  // Thông báo "có bản mới"
  useEffect(() => {
    if (!needRefresh || !updateSW) return;
    const key = 'update-pwa';
    notification.open({
      key,
      message: 'iPaper có bản cập nhật',
      description: 'Tải lại để dùng phiên bản mới nhất.',
      placement: 'bottomRight',
      duration: 0,
      icon: <ReloadOutlined style={{ color: '#E4002B' }} />,
      btn: (
        <Button size="small" type="primary" icon={<ReloadOutlined />}
          onClick={() => { updateSW(true); notification.destroy(key); }}>
          Cập nhật ngay
        </Button>
      ),
    });
  }, [needRefresh, updateSW]);

  return (
    <Modal
      title="Cài đặt iPaper trên iPhone"
      open={showIosHint}
      onCancel={() => { localStorage.setItem(IOS_HINT_KEY, '1'); setShowIosHint(false); }}
      footer={<Button type="primary" onClick={() => { localStorage.setItem(IOS_HINT_KEY, '1'); setShowIosHint(false); }}>Đã hiểu</Button>}
    >
      <div style={{ lineHeight: 1.7 }}>
        <p>Để mở iPaper như một app và nhận thông báo, làm 3 bước:</p>
        <ol style={{ paddingLeft: 20 }}>
          <li>Bấm nút <b>Chia sẻ</b> ở thanh dưới Safari <span style={{ fontSize: 18 }}>􀈂</span></li>
          <li>Kéo xuống chọn <b>"Thêm vào màn hình chính"</b></li>
          <li>Bấm <b>"Thêm"</b> ở góc phải trên</li>
        </ol>
        <p style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
          Yêu cầu iOS 16.4 trở lên để nhận thông báo đẩy.
        </p>
      </div>
    </Modal>
  );
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as any).standalone === true;
}

function isIOSSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}
