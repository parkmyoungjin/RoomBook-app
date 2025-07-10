'use client';

import { useAuthGuard } from '@/features/auth/hooks/useAuthGuard';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import ReservationDashboard from '@/features/reservation/components/ReservationDashboard';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthGuard();
  const [currentTime, setCurrentTime] = useState(new Date());

  // 현재 시간 업데이트 (1초마다)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 로딩 중이면 로딩 화면 표시
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 인증되지 않은 경우 (useAuthGuard에서 이미 리디렉션 처리)
  if (!isAuthenticated || !user) {
    return null;
  }

  const handleGoBack = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            onClick={handleGoBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            메인으로
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">예약 대시보드</h1>
            <p className="text-gray-600">
              실시간 회의실 예약 현황을 확인하세요
            </p>
          </div>
        </div>

        {/* Dashboard Content */}
        <ReservationDashboard />
      </div>
    </div>
  );
}