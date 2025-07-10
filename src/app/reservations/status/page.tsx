'use client';

import { useAuthGuard } from '@/features/auth/hooks/useAuthGuard';
import ReservationCalendarView from '@/features/reservation/components/ReservationCalendarView';
import MobileHeader from '@/components/ui/mobile-header';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';

export default function ReservationStatusPage() {
  const { user, isAuthenticated, isLoading } = useAuthGuard();
  const router = useRouter();

  // 빈 셀 클릭 시 새 예약 페이지로 이동
  const handleCellClick = (date: Date, hour: number) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const url = `/reservations/new?date=${dateString}&hour=${hour}`;
    
    // 디버깅용 로그 추가
    console.log('Cell clicked:', { 
      date: date.toISOString(), 
      hour, 
      dateString, 
      url 
    });
    
    router.push(url);
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
      <MobileHeader title="회의실 예약 현황" />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <ReservationCalendarView onCellClick={handleCellClick} />
      </div>
    </div>
  );
} 