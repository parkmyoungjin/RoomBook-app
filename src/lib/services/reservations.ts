'use client';

import { supabase } from '@/lib/supabase/client';
import { Tables, ReservationInsert, ReservationUpdate, Database } from '@/types/database';
import { authService } from './auth';
import { formatDateTimeForDisplay, formatDateTimeForDatabase } from '@/lib/utils/date';
import { format, startOfDay, endOfDay, addHours } from "date-fns";
import { ko } from "date-fns/locale";

export type BaseReservation = Tables<'reservations'>;
type ReservationInput = Omit<BaseReservation, 'id' | 'created_at' | 'updated_at'>;
type ReservationModify = Partial<ReservationInput>;

export type CreateReservationInput = {
  title: string;
  room_id: string;
  start_time: string;
  end_time: string;
  purpose?: string;
};

export class ReservationService {
  private static instance: ReservationService;

  private constructor() {}

  static getInstance(): ReservationService {
    if (!ReservationService.instance) {
      ReservationService.instance = new ReservationService();
    }
    return ReservationService.instance;
  }


  async getReservations(startDate: string, endDate: string): Promise<BaseReservation[]> {
    console.log('getReservations - Input parameters:', {
      startDate,
      endDate,
      startDateType: typeof startDate,
      endDateType: typeof endDate,
    });

    // 날짜 순서 확인 및 정렬
    const dates = [startDate, endDate].sort();
    const actualStartDate = dates[0];
    const actualEndDate = dates[1];
    
    // 한국 시간 날짜를 UTC 시간 범위로 변환
    // 한국 시간 2025-07-09 00:00 → UTC 2025-07-08 15:00
    // 한국 시간 2025-07-09 23:59 → UTC 2025-07-09 14:59
    const kstStartDateTime = `${actualStartDate}T00:00:00+09:00`;
    const kstEndDateTime = `${actualEndDate}T23:59:59+09:00`;
    
    // UTC로 변환
    const startDateTime = new Date(kstStartDateTime).toISOString();
    const endDateTime = new Date(kstEndDateTime).toISOString();

    console.log('getReservations - Date range:', {
      originalStartDate: startDate,
      originalEndDate: endDate,
      actualStartDate,
      actualEndDate,
      kstStartDateTime,
      kstEndDateTime,
      utcStartDateTime: startDateTime,
      utcEndDateTime: endDateTime,
    });

    console.log('getReservations - Supabase query parameters:', {
      table: 'reservations',
      select: '*, room:rooms(*)',
      lt_start_time: endDateTime,    // start_time < UTC endDateTime
      gt_end_time: startDateTime,    // end_time > UTC startDateTime  
      eq_status: 'confirmed',
      order: 'start_time',
    });

    const { data, error } = await supabase
      .from('reservations')
      .select('*, room:rooms(*), user:users(department)')
      .lt('start_time', endDateTime)    // 예약 시작 시간이 조회 종료 시간보다 이전
      .gt('end_time', startDateTime)    // 예약 종료 시간이 조회 시작 시간보다 이후
      .eq('status', 'confirmed')
      .order('start_time');

    console.log('getReservations - Query result:', {
      data,
      dataLength: data?.length,
      error,
      hasError: !!error,
    });

    if (error) {
      console.error('getReservations - Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      throw error;
    }

    console.log('getReservations - Returning data:', {
      resultCount: data?.length || 0,
      firstItem: data?.[0] || null,
    });

    return data;
  }

  async createReservation(data: ReservationInsert): Promise<BaseReservation> {
    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert({
        ...data,
        start_time: formatDateTimeForDatabase(data.start_time),
        end_time: formatDateTimeForDatabase(data.end_time),
      })
      .select()
      .single();

    if (error) throw error;
    return reservation;
  }

  async updateReservation(id: string, data: ReservationUpdate): Promise<BaseReservation> {
    const { data: reservation, error } = await supabase
      .from('reservations')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }


    return reservation;
  }

  async cancelReservation(id: string, reason?: string): Promise<void> {
    const { data: reservation, error: getError } = await supabase
      .from('reservations')
      .select()
      .eq('id', id)
      .single();

    if (getError) {
      throw getError;
    }

    const { error: updateError } = await supabase
      .from('reservations')
      .update({ 
        status: 'cancelled',
        cancellation_reason: reason || null 
      })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

  }

  async checkConflict(
    roomId: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Promise<boolean> {
    // Correct logic: A conflict exists if a confirmed reservation for the same room
    // starts before the new one ends AND ends after the new one starts.
    let query = supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("status", "confirmed")
      .lt("start_time", endTime) // It starts before the new one ends
      .gt("end_time", startTime);   // It ends after the new one starts

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { error, count } = await query;

    if (error) {
      console.error("Conflict check error:", error);
      throw new Error("예약 가능 여부 확인 중 오류가 발생했습니다.");
    }

    return (count ?? 0) > 0;
  }

  async getReservationById(id: string): Promise<BaseReservation | null> {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Get reservation error:', error);
      return null;
    }

    return data;
  }

  async getReservationsWithDetails(
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        room:rooms(*),
        user:users(*)
      `)
      .eq('status', 'confirmed')
      .gte('start_time', startDate)
      .lte('end_time', endDate)
      .order('start_time');

    if (error) {
      throw new Error(`예약 목록 조회 실패: ${error.message}`);
    }

    return data;
  }

  async getPublicReservations(
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    console.log('getPublicReservations - Input parameters:', {
      startDate,
      endDate,
      startDateType: typeof startDate,
      endDateType: typeof endDate,
    });

    // Parse dates to see what we're working with
    try {
      const parsedStartDate = new Date(startDate);
      const parsedEndDate = new Date(endDate);
      console.log('getPublicReservations - Parsed dates:', {
        parsedStartDate: parsedStartDate.toISOString(),
        parsedEndDate: parsedEndDate.toISOString(),
        startDateValid: !isNaN(parsedStartDate.getTime()),
        endDateValid: !isNaN(parsedEndDate.getTime()),
      });
    } catch (parseError) {
      console.error('getPublicReservations - Date parsing error:', parseError);
    }

    console.log('getPublicReservations - Calling RPC function with parameters:', {
      start_date: startDate,
      end_date: endDate,
    });

    const { data, error } = await supabase
      .rpc('get_public_reservations', {
        start_date: startDate,
        end_date: endDate,
      });

    console.log('getPublicReservations - RPC response:', {
      data,
      dataLength: data?.length,
      error,
      hasError: !!error,
    });

    if (error) {
      console.error('getPublicReservations - RPC error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      throw new Error(`공개 예약 목록 조회 실패: ${error.message}`);
    }

    console.log('getPublicReservations - Returning data:', {
      resultCount: data?.length || 0,
      firstItem: data?.[0] || null,
    });

    return data;
  }

  async getMyReservations(userId?: string): Promise<BaseReservation[]> {
    let currentUserId = userId;
    
    if (!currentUserId) {
      const currentUser = await authService.getCurrentUser();
      console.log('getMyReservations - currentUser:', currentUser);
      if (!currentUser) {
        throw new Error('로그인이 필요합니다');
      }
      currentUserId = currentUser.id;
    }

    console.log('getMyReservations - querying for user_id:', currentUserId);

    const { data, error } = await supabase
      .from('reservations')
      .select('*, room:rooms(*)')
      .eq('user_id', currentUserId)
      .eq('status', 'confirmed') // 확정된 예약만 조회 (취소된 예약 제외)
      .order('start_time');

    console.log('getMyReservations - query result:', { data, error, count: data?.length });

    if (error) {
      console.error('getMyReservations - error:', error);
      throw new Error(`내 예약 목록 조회 실패: ${error.message}`);
    }

    return data;
  }

  async getAllReservations(): Promise<any[]> {
    // Admin only function
    const isAdminUser = await authService.isAdmin();
    if (!isAdminUser) {
      throw new Error('관리자 권한이 필요합니다');
    }

    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        room:rooms(*),
        user:users(*)
      `)
      .order('start_time', { ascending: false });

    if (error) {
      throw new Error(`전체 예약 목록 조회 실패: ${error.message}`);
    }

    return data;
  }

  private async checkForConflicts(
    roomId: string,
    startTime: string,
    endTime: string,
    excludeId?: string
  ): Promise<void> {
    let query = supabase
      .from('reservations')
      .select('id')
      .eq('room_id', roomId)
      .eq('status', 'confirmed')
      .or(`start_time.lt.${endTime},end_time.gt.${startTime}`);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`예약 충돌 확인 실패: ${error.message}`);
    }

    if (data && data.length > 0) {
      throw new Error('해당 시간에 이미 예약이 있습니다');
    }
  }

  // Realtime subscription for reservations
  subscribeToReservations(
    callback: (payload: any) => void
  ): () => void {
    const channel = supabase
      .channel('reservations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const reservationService = ReservationService.getInstance(); 