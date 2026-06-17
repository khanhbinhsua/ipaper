import { QueryClient } from '@tanstack/react-query';

// QueryClient dùng chung để store ngoài React (vd notification socket) cũng invalidate được
export const queryClient = new QueryClient();
