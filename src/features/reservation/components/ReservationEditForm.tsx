'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parseISO, isWeekend, startOfToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useEffect } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateReservation } from '@/hooks/useReservations';
import { useRooms } from '@/hooks/useRooms';
import { ReservationFormData, reservationSchema } from '@/lib/validations/schemas';
import { Reservation } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

// 예약 수정용 폼 스키마
const editReservationSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요'),
  room_id: z.string().uuid('회의실을 선택해주세요'),
  date: z.date({
    required_error: '날짜를 선택해주세요',
  }),
  start_time: z.string().min(1, '시작 시간을 선택해주세요'),
  end_time: z.string().min(1, '종료 시간을 선택해주세요'),
  purpose: z.string().optional(),
});

type EditReservationFormData = z.infer<typeof editReservationSchema>;

// Generate time slots from 09:00 to 18:00
const timeSlots = Array.from({ length: 19 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minute}`;
});

interface ReservationEditFormProps {
  reservation: Reservation;
  isOpen: boolean;
  onClose: () => void;
}

export function ReservationEditForm({ reservation, isOpen, onClose }: ReservationEditFormProps) {
  const { mutate: updateReservation, isPending } = useUpdateReservation();
  const { data: rooms } = useRooms();
  const { toast } = useToast();

  // 시간 값 파싱 및 디버깅
  const startDate = new Date(reservation.start_time);
  const endDate = new Date(reservation.end_time);
  
  // 한국 시간으로 변환
  const startTime = format(startDate, 'HH:mm');
  const endTime = format(endDate, 'HH:mm');
  
  console.log('Reservation data:', reservation);
  console.log('Start date object:', startDate);
  console.log('End date object:', endDate);
  console.log('Parsed start time:', startTime);
  console.log('Parsed end time:', endTime);
  console.log('Start time ISO:', reservation.start_time);
  console.log('End time ISO:', reservation.end_time);

  const form = useForm<EditReservationFormData>({
    resolver: zodResolver(editReservationSchema),
    defaultValues: {
      title: reservation.title,
      room_id: reservation.room_id,
      date: new Date(reservation.start_time),
      start_time: startTime,
      end_time: endTime,
      purpose: reservation.purpose || '',
    },
  });

  // reservation이 변경될 때마다 form 값 업데이트
  useEffect(() => {
    if (reservation && isOpen) {
      const newStartDate = new Date(reservation.start_time);
      const newEndDate = new Date(reservation.end_time);
      const newStartTime = format(newStartDate, 'HH:mm');
      const newEndTime = format(newEndDate, 'HH:mm');
      
      console.log('Resetting form with:', {
        start_time: newStartTime,
        end_time: newEndTime,
        room_id: reservation.room_id
      });
      
      form.reset({
        title: reservation.title,
        room_id: reservation.room_id,
        date: newStartDate,
        start_time: newStartTime,
        end_time: newEndTime,
        purpose: reservation.purpose || '',
      });
    }
  }, [reservation, isOpen, form]);

  const onSubmit = (data: EditReservationFormData) => {
    const formattedDate = format(data.date, "yyyy-MM-dd");
    
    // 날짜와 시간을 합쳐서 Date 객체 생성
    const startLocal = new Date(`${formattedDate}T${data.start_time}:00`);
    const endLocal = new Date(`${formattedDate}T${data.end_time}:00`);
    
    console.log('Form data:', data);
    console.log('Start local:', startLocal);
    console.log('End local:', endLocal);
    console.log('Start ISO:', startLocal.toISOString());
    console.log('End ISO:', endLocal.toISOString());
    
    if (startLocal < new Date()) {
      toast({
        variant: "destructive",
        title: "수정 실패",
        description: "현재 시간 이후로만 예약할 수 있습니다.",
      });
      return;
    }
    
    // 시간 검증
    if (startLocal >= endLocal) {
      toast({
        variant: "destructive",
        title: "수정 실패",
        description: "종료 시간은 시작 시간보다 늦어야 합니다.",
      });
      return;
    }

    // ReservationFormData 형식으로 데이터 준비
    const updateFormData: Partial<ReservationFormData> = {
      title: data.title,
      room_id: data.room_id,
      start_time: startLocal, // Date 객체
      end_time: endLocal,     // Date 객체
      purpose: data.purpose,
    };
    
    console.log('Update data to be sent:', updateFormData);

    updateReservation(
      { 
        id: reservation.id, 
        data: updateFormData
      },
      {
        onSuccess: () => {
          onClose();
          form.reset();
          toast({
            title: "수정 완료",
            description: "예약이 성공적으로 수정되었습니다.",
          });
        },
        onError: (error: Error) => {
          if (error.message.includes("duplicate") || error.message.includes("valid_time_range")) {
            toast({
              variant: "destructive",
              title: "수정 실패",
              description: "해당 시간에 이미 다른 예약이 있습니다.",
            });
          } else {
            toast({
              variant: "destructive",
              title: "수정 실패",
              description: "네트워크 오류가 발생했습니다. 다시 시도해주세요.",
            });
          }
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>예약 수정</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>제목</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="room_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>회의실</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={isPending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="회의실을 선택하세요" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rooms?.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          {room.name}
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
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>날짜</FormLabel>
                  <FormControl>
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) => 
                        date < startOfToday() || 
                        isWeekend(date)
                      }
                      className="rounded-md border"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>시작 시간</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={isPending}
                    >
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
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>종료 시간</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={isPending}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="종료 시간" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timeSlots
                          .filter(time => time > form.getValues("start_time"))
                          .map((time) => (
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
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>목적</FormLabel>
                  <FormControl>
                    <Textarea {...field} disabled={isPending} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={onClose} disabled={isPending}>
                취소
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? '수정 중...' : '수정'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 