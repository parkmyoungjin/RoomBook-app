"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReservationCalendarView from "./ReservationCalendarView";
import ReservationListView from "./ReservationListView";
import { ReservationForm } from "./ReservationForm";
import { useRealtimeSubscription, usePollingFallback } from "@/hooks/useRealtimeSubscription";

export default function ReservationView() {
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState<{ date: Date; hour: number } | null>(null);
  
  // Enable real-time updates with polling fallback
  useRealtimeSubscription();
  usePollingFallback(5000); // 5 second polling interval

  const handleCellClick = (date: Date, hour: number) => {
    setSelectedDateTime({ date, hour });
    setIsReservationModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsReservationModalOpen(false);
    setSelectedDateTime(null);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">회의실 예약</h1>
        <ReservationForm />
      </div>
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="calendar">캘린더</TabsTrigger>
          <TabsTrigger value="list">목록</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar">
          <ReservationCalendarView onCellClick={handleCellClick} />
        </TabsContent>
        <TabsContent value="list">
          <ReservationListView />
        </TabsContent>
      </Tabs>
      
      {/* 빈 셀 클릭으로 열리는 예약 모달 */}
      <ReservationForm 
        isOpen={isReservationModalOpen}
        onClose={handleCloseModal}
        initialDateTime={selectedDateTime}
      />
    </div>
  );
} 