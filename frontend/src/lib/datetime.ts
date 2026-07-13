import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const VN_TZ = 'Asia/Ho_Chi_Minh';

// Hiển thị mốc thời gian (createdAt...) LUÔN theo giờ Việt Nam GMT+7,
// bất kể múi giờ thiết bị người xem. Backend lưu UTC → đổi sang VN.
export const vnTime = (d: string | Date | undefined | null, fmt = 'DD/MM/YYYY HH:mm:ss') =>
  d ? dayjs.utc(d).tz(VN_TZ).format(fmt) : '';
