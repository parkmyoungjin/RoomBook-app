"use client";

import { useState, useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { format, startOfWeek, endOfWeek, addDays, startOfDay, endOfDay, isSameDay, parseISO, isToday } from "date-fns";
import { ko } from "date-fns/locale";
import { useReservations } from "@/hooks/useReservations";
import { BaseReservation } from "@/lib/services/reservations";
import { formatDateTimeKorean, utcToKst } from "@/lib/utils/date";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { ReservationDetailDialog } from "./ReservationDetailDialog";
import type { PublicReservation } from "@/hooks/useReservations";
import { useAuthStore } from "@/lib/store/auth";
import { ReservationForm } from "./ReservationForm";

interface ReservationCalendarViewProps {
  onCellClick?: (date: Date, hour: number) => void;
}

export default function ReservationCalendarView({ onCellClick }: ReservationCalendarViewProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [selectedReservation, setSelectedReservation] = useState<PublicReservation | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [reservationModal, setReservationModal] = useState<{
    isOpen: boolean;
    date?: Date;
    hour?: number;
  }>({
    isOpen: false
  });
  
  // 선택된 날짜가 포함된 주의 월~금 범위 계산
  const weekRange = useMemo(() => {
    const start = startOfWeek(date, { weekStartsOn: 1 }); // 월요일 시작
    const end = addDays(start, 4); // 금요일까지 (월~금 5일)
    return {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
      dates: Array.from({ length: 5 }, (_, i) => addDays(start, i))
    };
  }, [date]);

  // 주간 예약 데이터 조회
  const { data: reservations, isLoading } = useReservations(
    weekRange.start,
    weekRange.end
  );

  // 실시간 업데이트 구독
  useRealtimeSubscription();

  // 예약 블록 색상 팔레트
  const colorPalette = [
    { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-900', textLight: 'text-blue-700' },
    { border: 'border-green-500', bg: 'bg-green-50', text: 'text-green-900', textLight: 'text-green-700' },
    { border: 'border-purple-500', bg: 'bg-purple-50', text: 'text-purple-900', textLight: 'text-purple-700' },
    { border: 'border-orange-500', bg: 'bg-orange-50', text: 'text-orange-900', textLight: 'text-orange-700' },
    { border: 'border-pink-500', bg: 'bg-pink-50', text: 'text-pink-900', textLight: 'text-pink-700' },
    { border: 'border-indigo-500', bg: 'bg-indigo-50', text: 'text-indigo-900', textLight: 'text-indigo-700' },
  ];

  // 예약 ID를 기반으로 색상 선택
  const getReservationColor = (reservationId: string) => {
    const index = reservationId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colorPalette.length;
    return colorPalette[index];
  };

  // 시간 슬롯 생성 (08:00 ~ 19:00)
  const timeSlots = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const hour = 8 + i;
      return {
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`
      };
    });
  }, []);

  // 예약을 시간 슬롯에 맞게 분류
  const reservationGrid = useMemo(() => {
    if (!reservations) return {};
    
    const grid: { [key: string]: BaseReservation[] } = {};
    
    reservations.forEach(reservation => {
      const kstStartTime = utcToKst(reservation.start_time);
      const kstEndTime = utcToKst(reservation.end_time);
      
      const reservationDate = format(kstStartTime, 'yyyy-MM-dd');
      const startHour = kstStartTime.getHours();
      const endHour = kstEndTime.getHours();
      
      // 예약이 걸치는 모든 시간 슬롯에 추가
      for (let hour = startHour; hour < endHour || (hour === endHour && kstEndTime.getMinutes() > 0); hour++) {
        if (hour >= 8 && hour <= 19) {
          const key = `${reservationDate}-${hour}`;
          if (!grid[key]) grid[key] = [];
          grid[key].push(reservation);
        }
      }
    });
    
    return grid;
  }, [reservations]);

  // 예약 블록 클릭 핸들러
  const handleReservationClick = (reservation: BaseReservation & { user?: { department: string } }, e: React.MouseEvent) => {
    e.stopPropagation(); // 버블링 방지
    const publicReservation: PublicReservation = {
      ...reservation,
      department: reservation.user?.department || '',
      is_mine: reservation.user_id === user?.id
    };
    setSelectedReservation(publicReservation);
  };

  // 빈 셀 클릭 핸들러 수정
  const handleEmptyCellClick = (date: Date, hour: number) => {
    // 과거 시간인지 확인
    const clickedDateTime = new Date(date);
    clickedDateTime.setHours(hour, 0, 0, 0);
    
    if (clickedDateTime < new Date()) {
      return; // 과거 시간은 예약할 수 없음
    }
    
    // 예약 모달 열기
    setReservationModal({
      isOpen: true,
      date: date,
      hour: hour
    });
  };

  return (
    <div className="space-y-6">
      {/* 달력 컴포넌트 임시 주석 처리}
      <Calendar
        mode="single"
        selected={date}
        onSelect={(newDate) => newDate && setDate(newDate)}
        locale={ko}
      />
      */}
      
      {/* 주간 시간표 그리드 */}
      <Card className="p-4">
        {/* 네비게이터와 제목을 포함한 헤더 */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setDate(addDays(date, -7))}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <h2 className="text-lg font-semibold">
            {format(weekRange.dates[0], "MM월 dd일", { locale: ko })} ~ {format(weekRange.dates[4], "dd일 (E)", { locale: ko })} 
          </h2>
          
          <button
            onClick={() => setDate(addDays(date, 7))}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="relative">
            {/* 스크롤 영역 */}
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 relative z-0">
              <div className="ml-[60px] min-w-[400px] md:min-w-0">
                {/* 헤더 - 5열로 변경 */}
                <div className="grid grid-cols-5 border-b">
                  {weekRange.dates.map((headerDate, index) => {
                    // isSelectedDate를 isToday로 변경
                    const isCurrentDay = isToday(headerDate);
                    return (
                      <div 
                        key={index} 
                        className={`p-2 font-medium text-center border-l ${
                          isCurrentDay ? 'bg-blue-100 text-blue-900' : 'bg-white-50'
                        }`}
                      >
                        <div>{format(headerDate, "E", { locale: ko })}</div>
                        <div>{format(headerDate, "MM/dd", { locale: ko })}</div>
                      </div>
                    );
                  })}
                </div>
                
                {/* 시간표 그리드 - 5열로 변경 */}
                {timeSlots.map(({ hour, label }) => (
                  <div key={hour} className="grid grid-cols-5 border-b">
                    {/* 시간 열은 제거하고 요일 열만 매핑 */}
                    {weekRange.dates.map((cellDate, dayIndex) => {
                      const dateStr = format(cellDate, 'yyyy-MM-dd');
                      const cellKey = `${dateStr}-${hour}`;
                      const cellReservations = reservationGrid[cellKey] || [];
                      
                      return (
                        <div 
                          key={dayIndex} 
                          className="border-l min-h-[80px] relative cursor-pointer hover:bg-gray-50"
                          onClick={() => handleEmptyCellClick(cellDate, hour)}
                        >
                          {cellReservations.length > 0 ? (
                            <div className="h-full">
                              {cellReservations.map((reservation, resIndex) => {
                                const kstStartTime = utcToKst(reservation.start_time);
                                const kstEndTime = utcToKst(reservation.end_time);
                                
                                // 예약 블록의 높이와 위치 계산
                                const startMinutes = kstStartTime.getMinutes();
                                const duration = (kstEndTime.getTime() - kstStartTime.getTime()) / (1000 * 60); // 분 단위
                                const heightPercentage = Math.min((duration / 60) * 100, 100); // 최대 100%
                                const topPercentage = (startMinutes / 60) * 100;
                                
                                const colors = getReservationColor(reservation.id);
                                
                                return (
                                  <div
                                    key={`${reservation.id}-${resIndex}`}
                                    className={`absolute left-0 right-0 mx-0 rounded border-l-4 ${colors.border} ${colors.bg} p-1 hover:shadow-md transition-shadow cursor-pointer`}
                                    style={{
                                      top: `${topPercentage}%`,
                                      height: `${heightPercentage}%`,
                                      zIndex: cellReservations.length - resIndex,
                                    }}
                                    onClick={(e) => handleReservationClick(reservation, e)}
                                    title={`${reservation.title} (${format(kstStartTime, 'HH:mm')}-${format(kstEndTime, 'HH:mm')})`}
                                  >
                                    <div className={`text-[10px] sm:text-xs md:text-sm`}>
                                      <div className={`font-medium ${colors.text} truncate`}>
                                        {reservation.title}
                                      </div>
                                      <div className={`${colors.textLight}`}>
                                        {format(kstStartTime, 'HH:mm')}-{format(kstEndTime, 'HH:mm')}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* 고정된 시간 열 */}
            <div className="absolute top-0 left-0 w-[60px] bg-white z-10 shadow-[0px_0_0px_rgba(0,0,0,0.1)]">
              <div className="p-3.5 font-medium text-center bg-white-50 border-r">
                시간
              </div>
              {timeSlots.map(({ hour, label }) => (
                <div 
                  key={hour} 
                  className="p-0 text-center font-medium bg-white-50 border-r min-h-[80px]"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
      
      {/* 예약 상세 정보 모달 */}
      <ReservationDetailDialog
        reservation={selectedReservation}
        isOpen={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
      />

      {/* 예약 모달 추가 */}
      <ReservationForm 
        isOpen={reservationModal.isOpen}
        onClose={() => setReservationModal({ isOpen: false })}
        initialDateTime={
          reservationModal.date && typeof reservationModal.hour === 'number'
            ? { date: reservationModal.date, hour: reservationModal.hour }
            : null
        }
      />
    </div>
  );
} 