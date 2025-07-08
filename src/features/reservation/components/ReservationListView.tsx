"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMyReservations } from '@/hooks/useReservations';
import { useAuthStore } from '@/lib/store/auth';
import { formatDateTimeForDisplay, formatTime } from '@/lib/utils/date';
import { ReservationEditForm } from './ReservationEditForm';
import { ReservationCancelDialog } from './ReservationCancelDialog';
import { Reservation } from '@/types/database';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function ReservationListView() {
  const { user } = useAuthStore();
  const { data: reservations, isLoading, error, isError } = useMyReservations();
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  // 디버깅을 위한 로그
  useEffect(() => {
    console.log('=== ReservationListView Debug ===');
    console.log('user:', user);
    console.log('user?.id:', user?.id);
    console.log('reservations:', reservations);
    console.log('reservations length:', reservations?.length);
    console.log('isLoading:', isLoading);
    console.log('isError:', isError);
    console.log('error:', error);
    console.log('================================');
  }, [user, reservations, isLoading, error, isError]);

  // 사용자가 로그인되지 않은 경우
  if (!user) {
    return <div>로그인이 필요합니다.</div>;
  }

  // 로딩 중
  if (isLoading) {
    return <div>예약 목록을 불러오는 중...</div>;
  }

  // 에러 발생
  if (isError) {
    return (
      <div className="text-red-600">
        예약 목록을 불러오는 데 오류가 발생했습니다.
        <br />
        오류: {error?.message || '알 수 없는 오류'}
      </div>
    );
  }

  // 데이터가 없는 경우
  if (!reservations || reservations.length === 0) {
    return (
      <div>
        <CardHeader>
          <CardTitle>내 예약 목록</CardTitle>
        </CardHeader>
        <div className="text-center py-8 text-gray-500">
          예약된 회의가 없습니다.
        </div>
      </div>
    );
  }

  const handleEdit = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setIsEditDialogOpen(true);
  };

  const handleCancel = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setIsCancelDialogOpen(true);
  };


  return (
    <div className="space-y-4">
      <CardHeader>
        <CardTitle>내 예약 목록</CardTitle>
      </CardHeader>
      {reservations.map((reservation) => (
        <Card key={reservation.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{reservation.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {(reservation as any).room?.name && (
                    <span className="text-blue-600 font-medium">
                      {(reservation as any).room.name} • 
                    </span>
                  )}
                  {formatDateTimeForDisplay(reservation.start_time)} ~ {formatTime(reservation.end_time)}
                </p>
                {reservation.purpose && (
                  <p className="mt-2 text-sm">{reservation.purpose}</p>
                )}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(reservation)}
                >
                  수정
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleCancel(reservation)}
                >
                  취소
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      {selectedReservation && (
        <>
          <ReservationEditForm
            reservation={selectedReservation}
            isOpen={isEditDialogOpen}
            onClose={() => {
              setIsEditDialogOpen(false);
              setSelectedReservation(null);
            }}
          />
          <ReservationCancelDialog
            reservation={selectedReservation}
            isOpen={isCancelDialogOpen}
            onClose={() => {
              setIsCancelDialogOpen(false);
              setSelectedReservation(null);
            }}
          />
        </>
      )}
    </div>
  );
} 