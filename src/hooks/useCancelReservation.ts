import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService } from '@/lib/services/reservations';
import { useToast } from '@/hooks/use-toast';

interface CancelReservationInput {
  id: string;
  reason?: string;
}

export function useCancelReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, reason }: CancelReservationInput) => {
      return reservationService.cancelReservation(id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast({
        title: '예약이 취소되었습니다.',
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: '예약 취소 실패',
        description: error instanceof Error ? error.message : '예약 취소 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    },
  });
} 