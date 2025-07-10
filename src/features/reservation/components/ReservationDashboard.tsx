'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Users, MapPin, Calendar } from 'lucide-react';
import { usePublicReservations } from '@/hooks/useReservations';
import { useRooms } from '@/hooks/useRooms';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { formatDate, formatTime, formatDateTime, utcToKst } from '@/lib/utils/date';
import type { PublicReservation, Room } from '@/types/database';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface TimeSlot {
  time: string;
  hour: number;
  reservations: PublicReservation[];
}

interface CurrentReservation {
  reservation: PublicReservation;
  room: Room;
}

export default function ReservationDashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // 오늘 날짜 범위 설정
  const today = format(new Date(), 'yyyy-MM-dd');
  const startDate = today;
  const endDate = today;

  // 데이터 가져오기
  const { data: reservations = [], isLoading: reservationsLoading } = usePublicReservations(startDate, endDate);
  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
  
  // 실시간 구독
  useRealtimeSubscription();

  // 예약 블록 색상 팔레트 (status 페이지와 동일)
  const colorPalette = [
    { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-900', textLight: 'text-blue-700' },
    { border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-900', textLight: 'text-green-700' },
    { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-900', textLight: 'text-purple-700' },
    { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-900', textLight: 'text-orange-700' },
    { border: 'border-pink-500', bg: 'bg-pink-50', text: 'text-pink-900', textLight: 'text-pink-700' },
    { border: 'border-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-900', textLight: 'text-indigo-700' },
  ];

  // 예약 ID를 기반으로 색상 선택 (status 페이지와 동일)
  const getReservationColor = (reservationId: string) => {
    const index = reservationId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colorPalette.length;
    return colorPalette[index];
  };

  // 현재 시간 업데이트 (1분마다)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // 1분마다 업데이트

    return () => clearInterval(timer);
  }, []);

  // 현재 활성 예약 찾기
  const currentReservation: CurrentReservation | null = useMemo(() => {
    if (!reservations.length || !rooms.length) return null;

    const now = new Date();
    const activeReservation = reservations.find(reservation => {
      const startTime = new Date(reservation.start_time);
      const endTime = new Date(reservation.end_time);
      return now >= startTime && now <= endTime;
    });

    if (!activeReservation) return null;

    const room = rooms.find(r => r.id === activeReservation.room_id);
    return room ? { reservation: activeReservation, room } : null;
  }, [reservations, rooms, currentTime]);

  // 타임테이블 데이터 생성 (9시-18시)
  const timeSlots: TimeSlot[] = useMemo(() => {
    const slots: TimeSlot[] = [];
    
    for (let hour = 9; hour <= 18; hour++) {
      const time = `${hour.toString().padStart(2, '0')}:00`;
      const hourReservations = reservations.filter(reservation => {
        const startTime = new Date(reservation.start_time);
        const endTime = new Date(reservation.end_time);
        const slotStart = new Date();
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date();
        slotEnd.setHours(hour + 1, 0, 0, 0);
        
        // 예약이 해당 시간대와 겹치는지 확인
        return startTime < slotEnd && endTime > slotStart;
      });

      slots.push({
        time,
        hour,
        reservations: hourReservations,
      });
    }
    
    return slots;
  }, [reservations]);

  const isLoading = reservationsLoading || roomsLoading;

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            예약 대시보드
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            예약 대시보드
          </CardTitle>
          <p className="text-xl font-bold text-gray-900">
            {currentTime.toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDate(new Date(), 'yyyy년 MM월 dd일 (E)')}
        </p>
      </CardHeader>
      <CardContent>
        {/* 반응형 레이아웃 */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 현재 예약 상태 - 모바일에서는 상단, 데스크탑에서는 좌측 (더 큰 비율) */}
          <div className="lg:col-span-3 order-1 lg:order-1">
            <CurrentReservationCard 
              reservation={currentReservation} 
              reservations={reservations}
              rooms={rooms}
              getReservationColor={getReservationColor} 
            />
          </div>

          {/* 오늘 일정 타임테이블 - 모바일에서는 하단, 데스크탑에서는 우측 (작은 비율) */}
          <div className="lg:col-span-2 order-2 lg:order-2">
            <TodayScheduleCard timeSlots={timeSlots} rooms={rooms} currentTime={currentTime} getReservationColor={getReservationColor} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 현재 예약 상태 카드
function CurrentReservationCard({ 
  reservation, 
  reservations,
  rooms,
  getReservationColor 
}: { 
  reservation: CurrentReservation | null;
  reservations: PublicReservation[];
  rooms: Room[];
  getReservationColor: (id: string) => any;
}) {
  const currentTime = new Date();
  const currentHour = currentTime.getHours();
  
  // 현재 시간대의 다음 예약 찾기 (예약 없음 표시용)
  const getNextTimeSlot = () => {
    const nextHour = currentHour + 1;
    return `${currentHour.toString().padStart(2, '0')}:00 ~ ${nextHour.toString().padStart(2, '0')}:00`;
  };

  // 다음 예약 찾기
  const getNextReservation = () => {
    const now = new Date();
    const todayReservations = reservations
      .filter(res => {
        const startTime = new Date(res.start_time);
        return startTime > now;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    
    return todayReservations.length > 0 ? todayReservations[0] : null;
  };

  const nextReservation = getNextReservation();

  if (!reservation) {
    return (
      <Card className="h-full bg-gray-50">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg text-gray-800">17.CR.09(화상)</CardTitle>
              <p className="text-sm text-gray-600">{formatDate(currentTime, 'MM월 dd일')}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-2xl font-bold text-gray-700 mb-2">
              {getNextTimeSlot()} 예약없음
            </p>
          </div>
          
          <div className="space-y-2">
            <p className="text-lg text-gray-600">사용 가능</p>
            {nextReservation ? (
              <p className="text-sm text-gray-500">
                다음회의: {formatTime(nextReservation.start_time)} ({nextReservation.title})
              </p>
            ) : (
              <p className="text-sm text-gray-500">오늘 예정된 회의가 없습니다</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { reservation: res, room } = reservation;
  const startTime = formatTime(res.start_time);
  const endTime = formatTime(res.end_time);
  const colors = getReservationColor(res.id);

  return (
    <Card className={`h-full ${colors.bg} border-l-4 ${colors.border}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className={`text-lg ${colors.text}`}>{room.name}</CardTitle>
            <p className={`text-sm ${colors.textLight}`}>{formatDate(currentTime, 'MM월 dd일')}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className={`text-2xl font-bold ${colors.text} mb-2`}>
            {startTime} ~ {endTime} 진행중
          </p>
        </div>
        
        <div className="space-y-3">
          <div>
            <h3 className={`text-xl font-bold ${colors.text}`}>{res.title}</h3>
            {res.purpose && (
              <p className={`text-base ${colors.textLight} mt-1`}>{res.purpose}</p>
            )}
          </div>
          
          <div className={`border-t ${colors.border} pt-3`}>
            <p className={`text-base font-medium ${colors.textLight}`}>
              {res.department} / {res.is_mine ? '나' : '동료'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 오늘 일정 타임테이블 카드 (시간 그리드 + 예약 오버레이 방식)
function TodayScheduleCard({ 
  timeSlots, 
  rooms, 
  currentTime,
  getReservationColor
}: { 
  timeSlots: TimeSlot[], 
  rooms: Room[], 
  currentTime: Date,
  getReservationColor: (id: string) => any;
}) {
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  
  // 시간 범위 설정 (9시-21시)
  const startHour = 9;
  const endHour = 21;
  const totalHours = endHour - startHour;
  const hourHeight = 60; // 각 시간당 60px
  
  // 시간 그리드 생성
  const timeGrid = Array.from({ length: totalHours }, (_, i) => {
    const hour = startHour + i;
    return {
      hour,
      time: `${hour.toString().padStart(2, '0')}:00`,
      isCurrentHour: hour === currentHour,
    };
  });

  // 원본 예약 데이터를 직접 사용 (중복 제거)
  const uniqueReservations = timeSlots
    .flatMap(slot => slot.reservations)
    .filter((reservation, index, array) => 
      array.findIndex(r => r.id === reservation.id) === index // id로 중복 제거
    );

  const reservationCards = uniqueReservations
    .map(reservation => {
      const room = rooms.find(r => r.id === reservation.room_id);
      const startTime = new Date(reservation.start_time);
      const endTime = new Date(reservation.end_time);
      
      // 시작 시간을 기준으로 정확한 위치 계산
      const startHours = startTime.getHours();
      const startMinutes = startTime.getMinutes();
      const endHours = endTime.getHours();
      const endMinutes = endTime.getMinutes();
      
      // 시작 시간이 표시 범위 내에 있는지 확인
      if (startHours < startHour || startHours >= endHour) {
        return null; // 범위 밖 예약은 표시하지 않음
      }
      
      // 시작 위치 계산
      const hourIndex = startHours - startHour;
      const minuteOffset = (startMinutes / 60) * hourHeight;
      const topPosition = (hourIndex * hourHeight) + minuteOffset;
      
      // 예약 길이 계산 (실제 예약 시간만큼)
      const startTotalMinutes = startHours * 60 + startMinutes;
      const endTotalMinutes = endHours * 60 + endMinutes;
      const durationMinutes = endTotalMinutes - startTotalMinutes;
      const cardHeight = (durationMinutes / 60) * hourHeight; // 실제 시간 길이에 비례
      
      return {
        id: reservation.id,
        reservation,
        room,
        topPosition,
        height: Math.max(cardHeight, 32), // 최소 32px 보장
        startTime: formatTime(reservation.start_time),
        endTime: formatTime(reservation.end_time),
      };
    })
    .filter((card): card is NonNullable<typeof card> => card !== null);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg">오늘 일정</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-y-auto rounded-lg border bg-gray-50" style={{ maxHeight: '480px' }}>
          {/* 시간 그리드 배경 */}
          <div 
            className="relative"
            style={{ height: `${totalHours * hourHeight}px` }}
          >
            {/* 시간 라벨과 그리드 라인 */}
            {timeGrid.map((timeData, index) => (
              <div
                key={timeData.hour}
                className="absolute w-full border-b border-gray-200 bg-white"
                style={{
                  top: `${index * hourHeight}px`,
                  height: `${hourHeight}px`,
                }}
              >
                <div className="absolute left-2 top-2 text-sm font-medium text-gray-600">
                  {timeData.time}
                </div>
              </div>
            ))}

            {/* 예약 카드 오버레이 */}
            <div className="absolute inset-0" style={{ left: '64px' }}>
              {reservationCards.map((card, index) => {
                // 동일한 시간에 시작하는 예약들의 인덱스 계산 (가로 배치용)
                const sameTimeCards = reservationCards.filter((otherCard, otherIndex) => 
                  otherIndex < index && Math.abs(card.topPosition - otherCard.topPosition) < 5
                );
                const columnIndex = sameTimeCards.length;
                const maxColumns = Math.max(1, sameTimeCards.length + 1);
                const colors = getReservationColor(card.id);
                
                return (
                  <div
                    key={card.id}
                    className={`absolute ${colors.bg} border-l-4 ${colors.border} rounded px-3 py-2 shadow-sm hover:shadow-md transition-all cursor-pointer z-20`}
                    style={{
                      top: `${card.topPosition + 2}px`,
                      height: `${Math.max(card.height - 4, 32)}px`,
                      left: `${(columnIndex * 100) / maxColumns + 1}%`,
                      width: `${100 / maxColumns - 2}%`,
                    }}
                  >
                    <div className="h-full flex items-center justify-between">
                      {/* 좌측: 목적/부서명 */}
                      <div className="flex-1 min-w-0">
                        {card.reservation.purpose ? (
                          <p className={`font-medium text-xs ${colors.text} truncate`}>
                            {card.reservation.purpose} / {card.reservation.department}
                          </p>
                        ) : (
                          <p className={`text-xs ${colors.textLight} truncate`}>
                            {card.reservation.department}
                          </p>
                        )}
                      </div>
                      
                      {/* 우측: 시간 */}
                      <div className="flex-shrink-0 ml-2">
                        <p className={`text-xs ${colors.textLight} font-medium`}>
                          {card.startTime}-{card.endTime}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 예약이 없을 때 메시지 */}
            {reservationCards.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-500">오늘 예약이 없습니다</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 