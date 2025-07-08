'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/features/auth/hooks/useAuthGuard';
import { useAuthStore } from '@/lib/store/auth';
import { authService } from '@/lib/services/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Users, Clock, Settings, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ReservationForm } from '@/features/reservation/components/ReservationForm';

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuthGuard();
  const { logout } = useAuthStore();
  const { toast } = useToast();
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);

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

  const handleLogout = async () => {
    try {
      await authService.logout();
      logout();
      toast({
        title: '로그아웃 완료',
        description: '안전하게 로그아웃되었습니다.',
      });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: '로그아웃 오류',
        description: '로그아웃 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenReservationModal = () => {
    setIsReservationModalOpen(true);
  };

  const navigateToMyReservations = () => {
    router.push('/reservations/my');
  };

  const navigateToReservationStatus = () => {
    router.push('/reservations/status');
  };

  const navigateToAdmin = () => {
    if (user.role === 'admin') {
      router.push('/admin');
    } else {
      toast({
        title: '접근 권한 없음',
        description: '관리자만 접근할 수 있는 페이지입니다.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">회의실 예약 시스템</h1>
            <p className="mt-2 text-gray-600">
              안녕하세요, <span className="font-semibold">{user.name}</span>님!
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={handleOpenReservationModal}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">새 예약</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">예약하기</div>
              <p className="text-xs text-muted-foreground">회의실을 예약합니다</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={navigateToMyReservations}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">내 예약</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">예약 관리</div>
              <p className="text-xs text-muted-foreground">내 예약을 확인하고 관리합니다</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={navigateToReservationStatus}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">예약 현황</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">현황 보기</div>
              <p className="text-xs text-muted-foreground">전체 예약 현황을 확인합니다</p>
            </CardContent>
          </Card>

          {user.role === 'admin' && (
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={navigateToAdmin}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">관리자</CardTitle>
                <Settings className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">시스템 관리</div>
                <p className="text-xs text-muted-foreground">회의실 및 사용자 관리</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 예약 모달 */}
        <ReservationForm 
          isOpen={isReservationModalOpen}
          onClose={() => setIsReservationModalOpen(false)}
        />
      </div>
    </div>
  );
}
