import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService } from '@/lib/services/reservations';
import { useToast } from '@/hooks/use-toast';
import { ReservationFormData } from '@/lib/validations/schemas';
import { ReservationUpdate } from '@/types/database';

export function useUpdateReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReservationFormData> }) => {
      // Transform Date objects to ISO strings for database
      const updateData: ReservationUpdate = {
        ...data,
        start_time: data.start_time?.toISOString(),
        end_time: data.end_time?.toISOString(),
      };
      return reservationService.updateReservation(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast({
        title: '예약이 수정되었습니다.',
        variant: 'default',
      });
    },
    onError: (error) => {
      toast({
        title: '예약 수정 실패',
        description: error instanceof Error ? error.message : '예약 수정 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    },
  });
} 