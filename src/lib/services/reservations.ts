'use client';

import { supabase } from '@/lib/supabase/client';
import { logger } from '@/lib/utils/logger';
import { normalizeDateForQuery } from '@/lib/utils/date';
import type { 
  Reservation, 
  ReservationInsert, 
  ReservationUpdate,
  PublicReservation,
  ReservationWithDetails
} from '@/types/database';

export const reservationService = {
  async createReservation(data: ReservationInsert): Promise<Reservation> {
    try {
      const { data: reservation, error } = await supabase
        .from('reservations')
        .insert(data)
        .select(`
          *,
          room:rooms!inner(*)
        `)
        .single();

      if (error) {
        logger.error('예약 생성 실패', error);
        throw new Error('예약 생성에 실패했습니다.');
      }

      logger.userAction('Reservation created', true);
      return reservation as Reservation;
    } catch (error) {
      logger.error('예약 생성 중 오류 발생', error);
      throw error;
    }
  },

  async getReservations(startDate?: string, endDate?: string): Promise<PublicReservation[]> {
    try {
      let query = supabase
        .from('reservations')
        .select(`
          id,
          room_id,
          user_id,
          title,
          purpose,
          start_time,
          end_time,
          status,
          user:users!inner(department),
          room:rooms!inner(name)
        `)
        .eq('status', 'confirmed')
        .order('start_time', { ascending: true });

      if (startDate && endDate) {
        // 날짜 범위 정규화를 통한 정확한 쿼리
        const normalizedStartDate = normalizeDateForQuery(startDate, false);
        const normalizedEndDate = normalizeDateForQuery(endDate, true);
        
        query = query
          .gte('start_time', normalizedStartDate)  // 예약 시작시간이 범위 시작 이후
          .lte('end_time', normalizedEndDate);     // 예약 종료시간이 범위 끝 이전
      }

      const { data, error } = await query;

      if (error) {
        logger.error('예약 목록 조회 실패', error);
        throw new Error('예약 목록을 불러오는데 실패했습니다.');
      }

      // PublicReservation 형태로 변환
      const publicReservations: PublicReservation[] = (data || []).map((reservation: any) => ({
        id: reservation.id,
        room_id: reservation.room_id,
        user_id: reservation.user_id,
        title: reservation.title,
        purpose: reservation.purpose,
        start_time: reservation.start_time,
        end_time: reservation.end_time,
        department: reservation.user?.department || '',
        is_mine: false // 클라이언트에서 설정됨
      }));

      return publicReservations;
    } catch (error) {
      logger.error('예약 목록 조회 중 오류 발생', error);
      throw error;
    }
  },

  // ✅ 추가: 상세 정보가 포함된 예약 목록 (관리자용)
  async getReservationsWithDetails(startDate?: string, endDate?: string): Promise<Reservation[]> {
    try {
      let query = supabase
        .from('reservations')
        .select(`
          *,
          user:users!inner(*),
          room:rooms!inner(*)
        `)
        .order('start_time', { ascending: true });

      if (startDate && endDate) {
        // 날짜 범위 정규화를 통한 정확한 쿼리
        const normalizedStartDate = normalizeDateForQuery(startDate, false);
        const normalizedEndDate = normalizeDateForQuery(endDate, true);
        
        query = query
          .gte('start_time', normalizedStartDate)  // 예약 시작시간이 범위 시작 이후
          .lte('end_time', normalizedEndDate);     // 예약 종료시간이 범위 끝 이전
      }

      const { data, error } = await query;

      if (error) {
        logger.error('상세 예약 목록 조회 실패', error);
        throw new Error('예약 목록을 불러오는데 실패했습니다.');
      }

      return data as Reservation[];
    } catch (error) {
      logger.error('상세 예약 목록 조회 중 오류 발생', error);
      throw error;
    }
  },

  // ✅ 추가: 모든 예약 조회 (관리자용)
  async getAllReservations(): Promise<Reservation[]> {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          user:users!inner(*),
          room:rooms!inner(*)
        `)
        .order('start_time', { ascending: false });

      if (error) {
        logger.error('전체 예약 목록 조회 실패', error);
        throw new Error('전체 예약 목록을 불러오는데 실패했습니다.');
      }

      return data as Reservation[];
    } catch (error) {
      logger.error('전체 예약 목록 조회 중 오류 발생', error);
      throw error;
    }
  },

  async updateReservation(id: string, data: ReservationUpdate): Promise<Reservation> {
    try {
      const { data: reservation, error } = await supabase
        .from('reservations')
        .update(data)
        .eq('id', id)
        .select(`
          *,
          room:rooms!inner(*)
        `)
        .single();

      if (error) {
        logger.error('예약 수정 실패', error);
        throw new Error('예약 수정에 실패했습니다.');
      }

      return reservation as Reservation;
    } catch (error) {
      logger.error('예약 수정 중 오류 발생', error);
      throw error;
    }
  },

  async cancelReservation(id: string, reason?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('reservations')
        .update({ 
          status: 'cancelled',
          cancellation_reason: reason 
        })
        .eq('id', id);

      if (error) {
        logger.error('예약 취소 실패', error);
        throw new Error('예약 취소에 실패했습니다.');
      }

      logger.userAction('Reservation cancelled', true);
    } catch (error) {
      logger.error('예약 취소 중 오류 발생', error);
      throw error;
    }
  },

  async deleteReservation(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('예약 삭제 실패', error);
        throw new Error('예약 삭제에 실패했습니다.');
      }

      logger.userAction('Reservation deleted', true);
    } catch (error) {
      logger.error('예약 삭제 중 오류 발생', error);
      throw error;
    }
  },

  async checkConflict(roomId: string, startTime: string, endTime: string, excludeId?: string): Promise<boolean> {
    try {
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
        logger.error('예약 충돌 검사 실패', error);
        return false; // 안전하게 충돌 없음으로 처리
      }

      return data && data.length > 0;
    } catch (error) {
      logger.error('예약 충돌 검사 중 오류 발생', error);
      return false; // 안전하게 충돌 없음으로 처리
    }
  },

  async getReservationById(id: string): Promise<Reservation | null> {
    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          room:rooms!inner(*),
          user:users!inner(*)
        `)
        .eq('id', id)
        .single();

      if (error) {
        logger.error('예약 상세 조회 실패', error);
        return null;
      }

      return data as Reservation;
    } catch (error) {
      logger.error('예약 상세 조회 중 오류 발생', error);
      return null;
    }
  },

  async getPublicReservations(startDate: string, endDate: string): Promise<PublicReservation[]> {
    try {
      logger.debug('공개 예약 조회 시작', { startDate, endDate });
      
      // ✅ API 엔드포인트 호출로 RLS 우회
      const response = await fetch(`/api/reservations/public?startDate=${startDate}&endDate=${endDate}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        logger.error('공개 예약 목록 조회 실패', errorData);
        throw new Error(errorData.error || '예약 현황을 불러오는데 실패했습니다.');
      }

      const { data } = await response.json();
      logger.debug('조회된 공개 예약 데이터', { count: data?.length || 0, data });

      return data || [];
    } catch (error) {
      logger.error('공개 예약 목록 조회 중 오류 발생', error);
      throw error;
    }
  },

  async getMyReservations(userId?: string): Promise<ReservationWithDetails[]> {
    // ✅ 타입 안전성 개선: userId가 없으면 빈 배열 반환
    if (!userId) {
      logger.warn('사용자 ID가 없어 내 예약을 조회할 수 없습니다');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          room:rooms!inner(*)
        `)
        .eq('user_id', userId)
        .order('start_time', { ascending: true });

      if (error) {
        logger.error('내 예약 목록 조회 실패', error);
        throw new Error('내 예약 목록을 불러오는데 실패했습니다.');
      }

      return data as ReservationWithDetails[];
    } catch (error) {
      logger.error('내 예약 목록 조회 중 오류 발생', error);
      throw error;
    }
  }
}; 