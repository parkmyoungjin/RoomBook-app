"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reservationService } from "@/lib/services/reservations";
import type { ReservationInsert } from "@/types/database";

import { useToast } from "@/hooks/use-toast";

export function useCreateReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ReservationInsert) => {
      console.log("useCreateReservation - calling service with data:", data);
      console.log("Data types:", {
        start_time: typeof data.start_time,
        end_time: typeof data.end_time,
        start_value: data.start_time,
        end_value: data.end_time
      });
      return await reservationService.createReservation(data);
    },
    onSuccess: (data) => {
      console.log("useCreateReservation - success:", data);
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      toast({
        title: "예약 완료",
        description: "회의실 예약이 성공적으로 완료되었습니다.",
      });
    },
    onError: (error: Error) => {
      console.error("useCreateReservation - error:", error);
      toast({
        title: "예약 실패",
        description: error.message || "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    },
  });
} 