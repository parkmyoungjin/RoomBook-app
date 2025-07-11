'use server';

import { NextRequest, NextResponse } from 'next/server';
import { createPureClient } from '@/lib/supabase/server';
import { normalizeDateForQuery } from '@/lib/utils/date';
import type { PublicReservation } from '@/types/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate와 endDate가 필요합니다' },
        { status: 400 }
      );
    }

    // 날짜 범위 정규화
    let normalizedStartDate: string;
    let normalizedEndDate: string;

    try {
      normalizedStartDate = normalizeDateForQuery(startDate, false);
      normalizedEndDate = normalizeDateForQuery(endDate, true);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : '날짜 형식이 올바르지 않습니다' },
        { status: 400 }
      );
    }

    // ✅ Server client 사용으로 RLS 우회
    const serverClient = await createPureClient();
    
    const { data, error } = await serverClient
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
        user:users!inner(department)
      `)
      .eq('status', 'confirmed')
      .gte('end_time', normalizedStartDate)  // 예약 종료시간이 시작날짜 이후
      .lte('start_time', normalizedEndDate)  // 예약 시작시간이 종료날짜 이전
      .order('start_time', { ascending: true });

    if (error) {
      console.error('공개 예약 목록 조회 실패:', error);
      return NextResponse.json(
        { error: '예약 현황을 불러오는데 실패했습니다' },
        { status: 500 }
      );
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

    return NextResponse.json({ data: publicReservations });

  } catch (error) {
    console.error('공개 예약 목록 조회 중 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
} 