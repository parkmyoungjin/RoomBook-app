"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reservationService } from '@/lib/services/reservations';
import { ReservationFormData } from '@/lib/validations/schemas';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/store/auth';
import { supabase } from "@/lib/supabase/client";
import type { Reservation, ReservationInsert, ReservationUpdate } from "@/types/database";
import { format } from 'date-fns';

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
    staleTime: 5 * 60 * 1000, // 5분간 fresh 상태 유지
    gcTime: 10 * 60 * 1000, // 10분간 캐시 유지
    enabled: !!startDate && !!endDate,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnMount: false, // 마운트시 자동 refetch 비활성화
    refetchOnWindowFocus: false, // 윈도우 포커스시 자동 refetch 비활성화
    refetchOnReconnect: true,
  });
}

// Get reservations with details (for admin view)
export function useReservationsWithDetails(startDate: string, endDate: string) {
  return useQuery({
    queryKey: reservationKeys.withDetails(startDate, endDate),
    queryFn: () => reservationService.getReservationsWithDetails(startDate, endDate),
    staleTime: 1 * 60 * 1000, // 1분간 fresh 상태 유지 (날짜 변경 시 빠른 반응)
    gcTime: 5 * 60 * 1000, // 5분간 캐시 유지
    enabled: !!startDate && !!endDate,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnMount: true, // 마운트 시 새로운 데이터 가져오기
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
    staleTime: 2 * 60 * 1000, // 2분간 fresh 상태 유지
    gcTime: 5 * 60 * 1000, // 5분간 캐시 유지
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    enabled: !!user?.id, // 사용자 ID가 있을 때만 실행
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
      if (!user) {
        throw new Error('사용자 정보를 찾을 수 없습니다');
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
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      toast({
        title: '예약 완료',
        description: '회의실 예약이 성공적으로 완료되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '예약 실패',
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
      
      console.log('useUpdateReservation - sending data:', updateData);
      return reservationService.updateReservation(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
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
      queryClient.invalidateQueries({ queryKey: reservationKeys.all });
      toast({
        title: '예약 취소 완료',
        description: '예약이 성공적으로 취소되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '예약 취소 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export interface PublicReservation {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  department: string;
  user_id: string;
  room_id: string;
  is_mine: boolean;
}

export function useReservations(startDate?: string, endDate?: string) {
  const today = new Date();
  const defaultStartDate = format(today, 'yyyy-MM-dd');
  const defaultEndDate = format(today, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['reservations', startDate || defaultStartDate, endDate || defaultEndDate],
    queryFn: () => reservationService.getReservations(startDate || defaultStartDate, endDate || defaultEndDate),
    staleTime: 1 * 60 * 1000, // 1분간 fresh 상태 유지 (날짜 변경 시 빠른 반응)
    gcTime: 5 * 60 * 1000, // 5분간 캐시 유지
    enabled: true,
    refetchOnMount: true, // 마운트 시 새로운 데이터 가져오기
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
} 