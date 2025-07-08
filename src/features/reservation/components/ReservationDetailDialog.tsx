"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription, // 추가
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useCancelReservation } from "@/hooks/useCancelReservation";
import { useAuthStore } from "@/lib/store/auth"; // 추가
import type { PublicReservation } from "@/hooks/useReservations";

interface ReservationDetailDialogProps {
  reservation: PublicReservation | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReservationDetailDialog({
  reservation,
  isOpen,
  onClose,
}: ReservationDetailDialogProps) {
  const router = useRouter();
  const { mutate: cancelReservation } = useCancelReservation();
  const { user } = useAuthStore(); // 현재 로그인한 사용자 정보 가져오기

  if (!reservation) return null;

  // 현재 사용자가 예약자이거나 관리자인 경우 수정/취소 가능
  const canManageReservation = user && (
    reservation.is_mine || 
    user.role === 'admin'
  );

  const handleEdit = () => {
    router.push(`/reservations/edit/${reservation.id}`);
  };

  const handleCancel = () => {
    cancelReservation({ 
      id: reservation.id,
      reason: "사용자 취소" 
    }, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>예약 정보</DialogTitle>
          <DialogDescription>
            예약 상세 정보를 확인하고 관리할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <h3 className="font-medium">제목</h3>
            <p>{reservation.title}</p>
          </div>
          <div>
            <h3 className="font-medium">부서</h3>
            <p>{reservation.department}</p>
          </div>
          <div>
            <h3 className="font-medium">예약 시간</h3>
            <p>
              {format(new Date(reservation.start_time), "PPP a h:mm", { locale: ko })} - 
              {format(new Date(reservation.end_time), "a h:mm", { locale: ko })}
            </p>
          </div>
          {/* 수정/취소 버튼을 canManageReservation 조건에 따라 표시 */}
          {canManageReservation && (
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={handleEdit}>
                수정
              </Button>
              <Button variant="destructive" onClick={handleCancel}>
                취소
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 