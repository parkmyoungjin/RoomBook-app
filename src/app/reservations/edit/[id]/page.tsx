'use client';

import { useRouter, useParams } from 'next/navigation';
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
import { useUpdateReservation } from "@/hooks/useUpdateReservation";
import { useAuthStore } from "@/lib/store/auth";
import { useMyReservations } from "@/hooks/useReservations";
import { format } from "date-fns";
import type { ReservationWithDetails } from "@/types/database";
import { 
  newReservationFormSchema, 
  type NewReservationFormValues,
  timeSlots 
} from "@/lib/validations/schemas";
import { logger } from '@/lib/utils/logger';

export default function EditReservationPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { data: rooms } = useRooms();
  const { mutate: updateReservation, isPending } = useUpdateReservation();

  // 인증 가드 적용
  const { isAuthenticated, isLoading: authLoading } = useAuthGuard();

  const [isLoading, setIsLoading] = useState(true);
  const [reservation, setReservation] = useState<ReservationWithDetails | null>(null);

  const reservationId = params.id as string;

  // 예약 정보 가져오기 - 내 예약 목록에서 찾기
  const { data: myReservations } = useMyReservations();

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

  // 예약 정보 로딩 및 폼 설정
  useEffect(() => {
    if (!isAuthenticated || !user || !myReservations || !reservationId) return;

    // 내 예약 중에서 해당 ID 찾기
    const targetReservation = myReservations.find(r => r.id === reservationId);
    
    if (!targetReservation) {
      toast({
        variant: "destructive",
        title: "예약을 찾을 수 없습니다",
        description: "해당 예약이 존재하지 않거나 접근 권한이 없습니다.",
      });
      router.push('/reservations/my');
      return;
    }

    // 본인의 예약인지 확인 (보안)
    if (targetReservation.user_id !== user.id && user.role !== 'admin') {
      toast({
        variant: "destructive",
        title: "접근 권한이 없습니다",
        description: "본인의 예약만 수정할 수 있습니다.",
      });
      router.push('/reservations/my');
      return;
    }

    // 취소된 예약은 수정 불가
    if (targetReservation.status === 'cancelled') {
      toast({
        variant: "destructive",
        title: "수정할 수 없습니다",
        description: "취소된 예약은 수정할 수 없습니다.",
      });
      router.push('/reservations/my');
      return;
    }

    setReservation(targetReservation);

    // 폼에 예약 데이터 설정
    const startDate = new Date(targetReservation.start_time);
    const endDate = new Date(targetReservation.end_time);
    
    const startTime = format(startDate, 'HH:mm');
    const endTime = format(endDate, 'HH:mm');

    logger.debug('Setting up reservation edit form');

    form.reset({
      title: targetReservation.title,
      booker: user.name || '',
      purpose: targetReservation.purpose || '',
      date: startDate,
      startTime: startTime,
      endTime: endTime,
      roomId: targetReservation.room_id,
    });

    setIsLoading(false);
  }, [isAuthenticated, user, myReservations, reservationId, form, toast, router]);

  // 로딩 중일 때
  if (authLoading || isLoading) {
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
  if (!isAuthenticated || !user || !reservation) {
    return null;
  }

  async function onSubmit(data: NewReservationFormValues) {
    if (!user || !reservation) {
      toast({
        variant: "destructive",
        title: "인증 오류",
        description: "로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.",
      });
      router.push('/login');
      return;
    }

    try {
      // 날짜와 시간을 조합하여 Date 객체 생성
      const startDateTime = new Date(data.date);
      const [startHour, startMinute] = data.startTime.split(':').map(Number);
      startDateTime.setHours(startHour, startMinute, 0, 0);
      
      const endDateTime = new Date(data.date);
      const [endHour, endMinute] = data.endTime.split(':').map(Number);
      endDateTime.setHours(endHour, endMinute, 0, 0);

      if (endDateTime <= startDateTime) {
        toast({
          variant: "destructive",
          title: "입력 오류",
          description: "종료 시간은 시작 시간보다 늦어야 합니다.",
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

      updateReservation({
        id: reservation.id,
        data: updateData
      }, {
        onSuccess: () => {
          logger.userAction('Reservation updated', true);
          toast({
            title: "예약이 수정되었습니다",
            description: "예약 정보가 성공적으로 업데이트되었습니다."
          });
          router.push('/reservations/my');
        },
        onError: (error) => {
          logger.error('예약 수정 실패', error);
          toast({
            variant: "destructive",
            title: "예약 수정 실패",
            description: "예약 수정 중 오류가 발생했습니다. 다시 시도해주세요.",
          });
        }
      });
    } catch (error) {
      logger.error('Form submission error:', error);
      toast({
        variant: "destructive",
        title: "예약 수정에 실패했습니다",
        description: "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader title="예약 수정" showBackButton />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>예약 수정</CardTitle>
            <CardDescription>
              예약 정보를 수정하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
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

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/reservations/my')}
                    className="flex-1"
                  >
                    취소
                  </Button>
                  <Button type="submit" disabled={isPending} className="flex-1">
                    {isPending ? '수정 중...' : '수정 완료'}
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