'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { startOfToday } from 'date-fns';
import { useAuthGuard } from '@/features/auth/hooks/useAuthGuard';
import MobileHeader from '@/components/ui/mobile-header';
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatDateTimeForDatabase2 } from "@/lib/utils/date";
import { 
  newReservationFormSchema, 
  type NewReservationFormValues,
  timeSlots 
} from "@/lib/validations/schemas";

export default function NewReservationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { data: rooms } = useRooms();
  const { mutate: createReservation, isPending } = useCreateReservation();

  // 인증 가드 적용
  const { isAuthenticated, isLoading } = useAuthGuard();

  // 쿼리 파라미터 로딩 상태 추가
  const [isParamsReady, setIsParamsReady] = useState(false);

  // 쿼리 파라미터에서 날짜/시간 정보 가져오기
  const dateParam = searchParams.get('date');
  const hourParam = searchParams.get('hour');

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

  // 쿼리 파라미터 로딩 감지
  useEffect(() => {
    // 약간의 지연을 두어 클라이언트 사이드 라우팅 완료 대기
    const timer = setTimeout(() => {
      setIsParamsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // 사용자 정보와 쿼리 파라미터 처리
  useEffect(() => {
    if (!isAuthenticated || !user || !isParamsReady) return;

    // 쿼리 파라미터가 있으면 폼에 자동 설정
    if (dateParam && hourParam) {
      try {
        const date = new Date(dateParam);
        const hour = parseInt(hourParam);
        
        // 유효한 날짜와 시간인지 확인
        if (!isNaN(date.getTime()) && hour >= 8 && hour <= 18) {
          const startTime = `${hour.toString().padStart(2, '0')}:00`;
          const endTime = hour < 18 ? `${(hour + 1).toString().padStart(2, '0')}:00` : "19:00";
          
          // reset으로 폼 전체를 새로 설정
          form.reset({
            title: user.department || "",
            booker: user.name || "",
            purpose: "",
            date: date,
            startTime: startTime,
            endTime: endTime,
            roomId: "",
          });
        }
      } catch (error) {
        console.error('Invalid query parameters:', error);
      }
    } else {
      // 쿼리 파라미터가 없을 때는 부서명과 예약자 설정
      if (user.department) {
        form.setValue('title', user.department);
      }
      if (user.name) {
        form.setValue('booker', user.name);
      }
    }
  }, [isAuthenticated, user, dateParam, hourParam, form, isParamsReady]);

  // 로딩 중일 때
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 인증되지 않은 경우 null 반환 (useAuthGuard가 리다이렉트 처리)
  if (!isAuthenticated || !user) {
    return null;
  }

  async function onSubmit(data: NewReservationFormValues) {
    // 함수 실행 시점에서 user 재검증
    if (!user) {
      toast({
        variant: "destructive",
        title: "인증 오류",
        description: "로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.",
      });
      router.push('/login');
      return;
    }

    try {
      const startTimeUTC = formatDateTimeForDatabase2(data.date, data.startTime);
      const endTimeUTC = formatDateTimeForDatabase2(data.date, data.endTime);

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
        purpose: data.purpose || undefined,
        status: "confirmed",
        user_id: user.id,
      };

      createReservation(reservationData, {
        onSuccess: () => {
          toast({
            title: "예약 완료",
            description: "회의실 예약이 성공적으로 완료되었습니다.",
          });
          router.push('/');
        },
        onError: (error: Error) => {
          console.error("Reservation creation failed:", error);
          toast({
            variant: "destructive",
            title: "예약 실패",
            description: "예약 생성에 실패했습니다. 다시 시도해주세요.",
          });
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
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="새 예약" showBackButton />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>회의실 예약</CardTitle>
            <CardDescription>
              회의실 예약은 평일 오전 8시부터 오후 7시까지 가능합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>부서명</FormLabel>
                      <FormControl>
                        <Input placeholder="부서명을 입력하세요" {...field} />
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
              </div>
                
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
                        disabled={(date) => date < startOfToday()}
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
                
                <div className="flex gap-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => router.back()}
                  >
                    취소
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isPending}>
                    {isPending ? "예약 중..." : "예약하기"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 