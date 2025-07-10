'use client';

import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/features/auth/hooks/useAuthGuard';
import { ReservationListView } from '@/features/reservation/components/ReservationListView';
import MobileHeader from '@/components/ui/mobile-header';

export default function MyReservationsPage() {
  const { user, isAuthenticated, isLoading } = useAuthGuard();
  const router = useRouter();
  const handleBack = () => {
    router.push('/'); // 명시적으로 메인페이지로 이동
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="내 예약" onBack={handleBack} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <ReservationListView />
      </div>
    </div>
  );
} 