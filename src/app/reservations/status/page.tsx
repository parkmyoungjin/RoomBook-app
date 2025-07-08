'use client';

import { useAuthGuard } from '@/features/auth/hooks/useAuthGuard';
import ReservationCalendarView from '@/features/reservation/components/ReservationCalendarView';
import MobileHeader from '@/components/ui/mobile-header';

export default function ReservationStatusPage() {
  const { user, isAuthenticated, isLoading } = useAuthGuard();

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
      <MobileHeader title="회의실 예약 현황" />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <ReservationCalendarView />
      </div>
    </div>
  );
} 