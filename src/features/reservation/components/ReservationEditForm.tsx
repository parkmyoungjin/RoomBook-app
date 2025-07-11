'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUpdateReservation } from '@/hooks/useUpdateReservation';
import { useRooms } from '@/hooks/useRooms';
import { newReservationFormSchema, type NewReservationFormValues, timeSlots } from '@/lib/validations/schemas';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import type { Reservation } from '@/types/database';
import { logger } from '@/lib/utils/logger';
import { useAuthStore } from '@/lib/store/auth';

interface ReservationEditFormProps {
  reservation: Reservation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReservationEditForm({ reservation, open, onOpenChange }: ReservationEditFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { data: rooms = [] } = useRooms();
  const updateReservation = useUpdateReservation();
  const { user } = useAuthStore();

  const form = useForm<NewReservationFormValues>({
    resolver: zodResolver(newReservationFormSchema),
    defaultValues: {
      title: "",
      booker: "",
      purpose: "",
      startTime: "",
      endTime: "",
      roomId: "",
    },
  });

  // 예약 데이터를 폼에 설정
  useEffect(() => {
    if (reservation && open) {
      const startDate = new Date(reservation.start_time);
      const endDate = new Date(reservation.end_time);
      
      // 시간을 HH:mm 형식으로 변환
      const startTime = format(startDate, 'HH:mm');
      const endTime = format(endDate, 'HH:mm');

      logger.debug('Setting up reservation edit form');

      form.reset({
        title: reservation.title,
        booker: user?.name || '',
        purpose: reservation.purpose || '',
        date: startDate,
        startTime: startTime,
        endTime: endTime,
        roomId: reservation.room_id,
      });
    }
  }, [reservation, open, form]);

  const onSubmit = async (data: NewReservationFormValues) => {
    try {
      setIsLoading(true);
      
      // 날짜와 시간을 조합하여 Date 객체 생성
      const startDateTime = new Date(data.date);
      const [startHour, startMinute] = data.startTime.split(':').map(Number);
      startDateTime.setHours(startHour, startMinute, 0, 0);
      
      const endDateTime = new Date(data.date);
      const [endHour, endMinute] = data.endTime.split(':').map(Number);
      endDateTime.setHours(endHour, endMinute, 0, 0);

      if (endDateTime <= startDateTime) {
        toast({
          title: "입력 오류",
          description: "종료 시간은 시작 시간보다 늦어야 합니다.",
          variant: "destructive"
        });
        return;
      }

      logger.debug('Submitting reservation update');

      const updateData = {
        room_id: data.roomId,
        title: data.title.trim(),
        purpose: data.purpose?.trim() || undefined,
        start_time: startDateTime,
        end_time: endDateTime
      };

      await updateReservation.mutateAsync({
        id: reservation.id,
        data: updateData
      });

      logger.userAction('Reservation updated', true);
      toast({
        title: "예약이 수정되었습니다",
        description: "예약 정보가 성공적으로 업데이트되었습니다."
      });
      onOpenChange(false);
    } catch (error) {
      logger.error('예약 수정 실패', error);
      toast({
        title: "예약 수정 실패",
        description: "예약 수정 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>예약 수정</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>예약 제목</FormLabel>
                  <FormControl>
                    <Input placeholder="예약 제목을 입력하세요" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="booker"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>예약자</FormLabel>
                  <FormControl>
                    <Input placeholder="예약자를 입력하세요" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>날짜</FormLabel>
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date()}
                    className="rounded-md border"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>시작 시간</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="시작 시간" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>종료 시간</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="종료 시간" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeSlots.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="roomId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>회의실</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="회의실을 선택하세요" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rooms?.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name} ({room.capacity}인실)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>목적 (선택)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="회의 목적을 입력하세요"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? '수정 중...' : '수정'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 