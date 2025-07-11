"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService } from '@/lib/services/reservations';
import { ReservationFormData } from '@/lib/validations/schemas';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/store/auth';
import { supabase } from "@/lib/supabase/client";
import type { Reservation, ReservationInsert, ReservationUpdate, PublicReservation } from "@/types/database";
import { format } from 'date-fns';
import { logger } from '@/lib/utils/logger';

// Query keys
export const reservationKeys = {
  all: ['reservations'] as const,
  lists: () => [...reservationKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...reservationKeys.lists(), filters] as const,
  details: () => [...reservationKeys.all, 'detail'] as const,
  detail: (id: string) => [...reservationKeys.details(), id] as const,
  public: (startDate: string, endDate: string) => 
    [...reservationKeys.all, 'public', startDate, endDate] as const,
  my: () => [...reservationKeys.all, 'my'] as const,
  withDetails: (startDate: string, endDate: string) => 
    [...reservationKeys.all, 'withDetails', startDate, endDate] as const,
};

// Get public reservations (for calendar view)
export function usePublicReservations(startDate: string, endDate: string) {
  return useQuery({
    queryKey: reservationKeys.public(startDate, endDate),
    queryFn: () => reservationService.getPublicReservations(startDate, endDate),
    staleTime: 10 * 60 * 1000, // 10분으로 연장장 (캐시 강화)
    gcTime: 30 * 60 * 1000, // 30분으로 연장장 (캐시 강화)
    enabled: !!startDate && !!endDate,
    retry: 2, // 1번으로 줄임 (3번)
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnMount: true, // 마운트시 새 데이터 가져오기 (중요)
    refetchOnWindowFocus: false, // 도커시 동작 refetch 비활화
    refetchOnReconnect: true, // 네트워크 재연결시 새 데이터 가져오기
    refetchInterval: false, // 동작 간격 refetch 비활화
    refetchIntervalInBackground: false, // 백그운도 refetch 비활화
  });
}

// Get reservations with details (for admin view)
export function useReservationsWithDetails(startDate: string, endDate: string) {
  return useQuery({
    queryKey: reservationKeys.withDetails(startDate, endDate),
    queryFn: () => reservationService.getReservationsWithDetails(startDate, endDate),
    staleTime: 1 * 60 * 1000, // 1분간 fresh ?�태 ?��? (?�짜 변�???빠른 반응)
    gcTime: 5 * 60 * 1000, // 5분간 캐시 ?��?
    enabled: !!startDate && !!endDate,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnMount: true, // 마운?????�로???�이??가?�오�?
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

// Get my reservations
export function useMyReservations() {
  const { user } = useAuthStore();
  
  return useQuery({
    queryKey: reservationKeys.my(),
    queryFn: () => reservationService.getMyReservations(user?.id),
    staleTime: 2 * 60 * 1000, // 2분간 fresh ?�태 ?��?
    gcTime: 5 * 60 * 1000, // 5분간 캐시 ?��?
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    enabled: !!user?.id, // ?�용??ID가 ?�을 ?�만 ?�행
  });
}

// Get reservation by ID
export function useReservation(id: string) {
  return useQuery({
    queryKey: reservationKeys.detail(id),
    queryFn: () => reservationService.getReservationById(id),
    enabled: !!id,
  });
}

// Get all reservations (admin only)
export function useAllReservations() {
  return useQuery({
    queryKey: [...reservationKeys.all, 'admin'],
    queryFn: () => reservationService.getAllReservations(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Create reservation mutation
export function useCreateReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuthStore();

  return useMutation({
    mutationFn: (data: ReservationFormData) => {
      if (!user?.id) {
        throw new Error('?�용???�보�?찾을 ???�습?�다');
      }
      
      // Convert Date objects to ISO strings and add user_id
      const reservationData: ReservationInsert = {
        room_id: data.room_id,
        user_id: user.id,
        title: data.title,
        purpose: data.purpose,
        start_time: data.start_time.toISOString(),
        end_time: data.end_time.toISOString(),
      };
      
      return reservationService.createReservation(reservationData);
    },
    onSuccess: () => {
      // ????구체?�으�?무효??(?�체가 ?�닌 ?�요??부분만)
      queryClient.invalidateQueries({ 
        queryKey: reservationKeys.all,
        exact: false // 'reservations'�??�작?�는 모든 쿼리 무효??
      });
      toast({
        title: '?�약 ?�료',
        description: '?�의???�약???�공?�으�??�료?�었?�니??',
      });
    },
    onError: (error: Error) => {
      logger.error('?�약 ?�성 ?�패', error);
      toast({
        title: '?�약 ?�패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update reservation mutation
export function useUpdateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ReservationFormData> }) => {
      // Convert Date objects to ISO strings if they exist
      const updateData: ReservationUpdate = {
        ...(data.room_id && { room_id: data.room_id }),
        ...(data.title && { title: data.title }),
        ...(data.purpose !== undefined && { purpose: data.purpose }),
        ...(data.start_time && { start_time: data.start_time.toISOString() }),
        ...(data.end_time && { end_time: data.end_time.toISOString() }),
      };
      
      // ???�전??로깅?�로 변�?(민감???�보 ?�거)
      logger.debug('Updating reservation', { id, hasData: !!updateData });
      return reservationService.updateReservation(id, updateData);
    },
    onSuccess: () => {
      // ????구체?�으�?무효??(?�체가 ?�닌 ?�요??부분만)
      queryClient.invalidateQueries({ 
        queryKey: reservationKeys.all,
        exact: false // 'reservations'�??�작?�는 모든 쿼리 무효??
      });
    },
    onError: (error: Error) => {
      logger.error('?�약 ?�정 ?�패', error);
    },
  });
}

// Cancel reservation mutation
export function useCancelReservation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => 
      reservationService.cancelReservation(id, reason),
    onSuccess: () => {
      // ????구체?�으�?무효??(?�체가 ?�닌 ?�요??부분만)
      queryClient.invalidateQueries({ 
        queryKey: reservationKeys.all,
        exact: false // 'reservations'�??�작?�는 모든 쿼리 무효??
      });
      toast({
        title: '?�약 취소 ?�료',
        description: '?�약???�공?�으�?취소?�었?�니??',
      });
    },
    onError: (error: Error) => {
      logger.error('?�약 취소 ?�패', error);
      toast({
        title: '?�약 취소 ?�패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// ??PublicReservation ?�?��? @/types/database?�서 import

export function useReservations(startDate?: string, endDate?: string) {
  const today = new Date();
  const defaultStartDate = format(today, 'yyyy-MM-dd');
  const defaultEndDate = format(today, 'yyyy-MM-dd');

  const query = useQuery({
    queryKey: ['reservations', startDate || defaultStartDate, endDate || defaultEndDate],
    queryFn: async () => {
      try {
        return await reservationService.getReservations(startDate || defaultStartDate, endDate || defaultEndDate);
      } catch (error) {
        logger.error('?�약 목록 조회 ?�패', error);
        throw error;
      }
    },
    staleTime: 1 * 60 * 1000, // 1분간 fresh ?�태 ?��? (?�짜 변�???빠른 반응)
    gcTime: 5 * 60 * 1000, // 5분간 캐시 ?��?
    enabled: true,
    refetchOnMount: true, // 마운?????�로???�이??가?�오�?
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return query;
} 
