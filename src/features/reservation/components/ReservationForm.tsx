"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, startOfToday, isWeekend, parseISO, set } from "date-fns";
import { ko } from "date-fns/locale";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRooms } from "@/hooks/useRooms";
import { useCreateReservation } from "@/hooks/useCreateReservation";
import { useAuthStore } from "@/lib/store/auth";
import type { ReservationInsert } from "@/types/database";
import { formatDateTimeForDatabase2, isCurrentTimeBusinessHours } from "@/lib/utils/date";

// Generate time slots from 08:00 to 19:00
const timeSlots = Array.from({ length: 23 }, (_, i) => {
  const hour = 8 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? "00" : "30";
  return `${hour.toString().padStart(2, "0")}:${minute}`;
});

// Zod schema for form validation
const reservationFormSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요"),
  date: z.date({
    required_error: "날짜를 선택해주세요",
  }).refine(
    (date) => !isWeekend(date),
    "주말에는 예약할 수 없습니다"
  ).refine(
    (date) => date >= startOfToday(),
    "오늘 이전 날짜는 선택할 수 없습니다"
  ),
  startTime: z.string({
    required_error: "시작 시간을 선택해주세요",
  }),
  endTime: z.string({
    required_error: "종료 시간을 선택해주세요",
  }),
  roomId: z.string({
    required_error: "회의실을 선택해주세요",
  }),
  purpose: z.string().optional(),
}).refine((data) => {
  const start = new Date(`${format(data.date, "yyyy-MM-dd")}T${data.startTime}`);
  const end = new Date(`${format(data.date, "yyyy-MM-dd")}T${data.endTime}`);
  return end > start;
}, {
  message: "종료 시간은 시작 시간보다 늦어야 합니다",
  path: ["endTime"],
}).refine((data) => {
  const startHour = parseInt(data.startTime.split(":")[0], 10);
  const endHour = parseInt(data.endTime.split(":")[0], 10);
  return startHour >= 8 && endHour <= 19;
}, {
  message: "예약은 오전 8시부터 오후 7시까지만 가능합니다",
  path: ["startTime"],
}).refine((data) => {
  // 한국 시간 기준으로 현재 시간 이후인지 확인
  const now = new Date();
  const selectedDateTime = new Date(`${format(data.date, "yyyy-MM-dd")}T${data.startTime}`);
  return selectedDateTime > now;
}, {
  message: "현재 시간 이후로만 예약할 수 있습니다",
  path: ["startTime"],
});

type ReservationFormValues = z.infer<typeof reservationFormSchema>;

interface ReservationFormProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialDateTime?: { date: Date; hour: number } | null;
}

export function ReservationForm({ isOpen, onClose, initialDateTime }: ReservationFormProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { data: rooms, isLoading: isLoadingRooms } = useRooms();
  const { mutate: createReservation, isPending } = useCreateReservation();

  // 외부에서 제어하는 경우와 내부에서 제어하는 경우를 구분
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = onClose !== undefined ? 
    (newOpen: boolean) => {
      if (!newOpen) onClose();
    } : 
    setInternalOpen;

  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationFormSchema),
    defaultValues: {
      title: department,
      purpose: "",
    },
  });

  // initialDateTime이 변경될 때 폼 값 설정
  useEffect(() => {
    if (initialDateTime && open) {
      const { date, hour } = initialDateTime;
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = hour < 18 ? `${(hour + 1).toString().padStart(2, '0')}:00` : "18:00";
      
      form.reset({
        title: "",
        purpose: "",
        date: date,
        startTime: startTime,
        endTime: endTime,
      });
    }
  }, [initialDateTime, open, form]);

  async function onSubmit(data: ReservationFormValues) {
    console.log("Form submitted with data:", data);
    
    if (!user) {
      toast({
        variant: "destructive",
        title: "로그인이 필요합니다",
        description: "예약하기 전에 로그인해주세요",
      });
      return;
    }

    try {
      // 한국 시간을 올바르게 변환하여 데이터베이스에 저장
      const startTimeUTC = formatDateTimeForDatabase2(data.date, data.startTime);
      const endTimeUTC = formatDateTimeForDatabase2(data.date, data.endTime);

      console.log("Converted times:", { startTimeUTC, endTimeUTC });
      console.log("Original form data:", {
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime
      });
      
      // 시간 검증 추가
      if (startTimeUTC >= endTimeUTC) {
        toast({
          variant: "destructive",
          title: "예약 실패",
          description: "종료 시간은 시작 시간보다 늦어야 합니다.",
        });
        return;
      }

      const reservationData: ReservationInsert = {
        title: data.title,
        room_id: data.roomId,
        start_time: startTimeUTC,
        end_time: endTimeUTC,
        purpose: data.purpose ? data.purpose : undefined,
        status: "confirmed",
        user_id: user.id,
      };

      console.log("Reservation data to be sent:", reservationData);

      createReservation(reservationData, {
        onSuccess: () => {
          console.log("Reservation created successfully");
          setOpen(false);
          form.reset();
        },
        onError: (error: Error) => {
          console.error("Reservation creation failed:", error);
          // 오류 메시지를 좋게 처리할 수 있도록 추가 로직
          if (error.message.includes("valid_time_range")) {
            toast({
              variant: "destructive",
              title: "예약 실패",
              description: "시작 시간과 종료 시간을 다시 확인해주세요.",
            });
          }
        },
      });
    } catch (error) {
      console.error("Form submission error:", error);
      toast({
        variant: "destructive",
        title: "예약에 실패했습니다",
        description: "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* 외부에서 제어하지 않는 경우에만 트리거 버튼 렌더링 */}
      {isOpen === undefined && (
        <DialogTrigger asChild>
          <Button>회의실 예약</Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>회의실 예약</DialogTitle>
          <DialogDescription>
            회의실 예약은 평일 오전 8시부터 오후 7시까지 가능합니다.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>부서명</FormLabel>
                  <FormControl>
                    <Input placeholder="부서명 입력하세요" {...field} />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "예약 중..." : "예약하기"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
} 
