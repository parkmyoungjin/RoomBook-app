'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useCancelReservation } from '@/hooks/useReservations';
import { Reservation } from '@/types/database';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface ReservationCancelDialogProps {
  reservation: Reservation;
  isOpen: boolean;
  onClose: () => void;
}

export function ReservationCancelDialog({ reservation, isOpen, onClose }: ReservationCancelDialogProps) {
  const { mutate: cancelReservation, isPending } = useCancelReservation();
  const { toast } = useToast();
  const [cancelReason, setCancelReason] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);

  const handleCancel = () => {
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    // 시작 시간 10분 전까지만 취소 가능
    const startTime = new Date(reservation.start_time);
    const now = new Date();
    const timeDiff = startTime.getTime() - now.getTime();
    const minutesDiff = Math.floor(timeDiff / (1000 * 60));

    if (minutesDiff < 10) {
      toast({
        variant: "destructive",
        title: "취소 불가",
        description: "회의 시작 10분 전부터는 취소할 수 없습니다.",
      });
      return;
    }

    const reason = cancelReason.trim();
    
    // Debug: 전달되는 reservation 객체 확인
    console.log('Reservation object:', reservation);
    console.log('Reservation ID:', reservation.id);
    console.log('ID type:', typeof reservation.id);
    
    // 안전하게 ID 추출
    const reservationId = typeof reservation.id === 'string' ? reservation.id : String(reservation.id);
    
    cancelReservation(
      {
        id: reservationId,
        reason: reason || undefined,
      },
      {
        onSuccess: () => {
          toast({
            title: "취소 완료",
            description: "예약이 취소되었습니다.",
          });
          onClose();
          setConfirmStep(false);
          setCancelReason('');
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "취소 실패",
            description: "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
          });
          setConfirmStep(false);
        },
      }
    );
  };

  const handleClose = () => {
    onClose();
    setConfirmStep(false);
    setCancelReason('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>예약 취소</DialogTitle>
          <DialogDescription>
            {!confirmStep ? (
              <>
                다음 예약을 취소하시겠습니까?
                <div className="mt-2">
                  <p className="font-semibold">{reservation.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(reservation.start_time), 'PPP EEEE p', { locale: ko })} ~{' '}
                    {format(new Date(reservation.end_time), 'p', { locale: ko })}
                  </p>
                </div>
                <div className="mt-4">
                  <label className="text-sm font-medium">취소 사유 (선택)</label>
                  <Textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="취소 사유를 입력해주세요"
                    className="mt-1"
                    disabled={isPending}
                  />
                </div>
              </>
            ) : (
              <div className="text-red-500">
                정말로 이 예약을 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            {confirmStep ? '아니오' : '닫기'}
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending
              ? '취소 중...'
              : confirmStep
              ? '예, 취소합니다'
              : '예약 취소'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 