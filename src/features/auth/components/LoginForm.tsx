'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/store/auth';
import { authService } from '@/lib/services/auth';
import { loginSchema, type LoginFormData } from '@/lib/validations/schemas';
import { LogIn, User, IdCard, UserPlus, QrCode, Smartphone } from 'lucide-react';
import Link from 'next/link';

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, setUser } = useAuthStore();

  /* ✅ 훅은 조건문 밖에서 무조건 실행 */
  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { employeeId: '', name: '' },
  });

  /* ✅ 로그인되어 있으면 렌더 직후에 라우팅 */
  useEffect(() => {
    if (user) {
      router.replace('/');   // push 대신 replace 권장 (히스토리 정리)
    }
  }, [user, router]);

  // 이미 로그인된 사용자는 메인 페이지로 리디렉션
  if (user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">대시보드로 이동 중...</p>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    
    try {
      const user = await authService.login({
        employeeId: data.employeeId,
        name: data.name,
      });
      setUser(user);
      toast({
        title: '로그인 성공',
        description: `${user.name}님, 환영합니다!`,
      });
      
      // 메인 페이지로 리디렉션
      router.push('/');
    } catch (error) {
      toast({
        title: '로그인 실패',
        description: error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQRLogin = () => {
    router.push('/my-qr');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-full">
              <LogIn className="h-6 w-6 text-blue-600" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">회의실 예약 시스템</CardTitle>
          <CardDescription>
            사번과 이름을 입력하여 로그인해주세요
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="employeeId">사번</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <IdCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" aria-hidden="true" />
                        <Input
                          {...field}
                          id="employeeId"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]{7}"
                          maxLength={7}
                          placeholder="7자리 사번을 입력하세요"
                          className="pl-10"
                          disabled={isLoading}
                          autoComplete="username"
                          aria-describedby={form.formState.errors.employeeId ? "employeeId-error" : undefined}
                        />
                      </div>
                    </FormControl>
                    <FormMessage id="employeeId-error" />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="name">이름</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" aria-hidden="true" />
                        <Input
                          {...field}
                          id="name"
                          type="text"
                          placeholder="이름을 입력하세요"
                          className="pl-10"
                          disabled={isLoading}
                          autoComplete="name"
                          aria-describedby={form.formState.errors.name ? "name-error" : undefined}
                        />
                      </div>
                    </FormControl>
                    <FormMessage id="name-error" />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
                aria-describedby="login-description"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    로그인 중...
                  </>
                ) : (
                  '로그인'
                )}
              </Button>
              
              <div id="login-description" className="sr-only">
                사번과 이름을 입력하여 회의실 예약 시스템에 로그인합니다
              </div>
            </form>
          </Form>
          
          {/* QR 코드 로그인 구분선 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-gray-50 px-2 text-gray-500">또는</span>
            </div>
          </div>

          {/* QR 코드 로그인 옵션 */}
          <div className="space-y-4">
            <Button 
              type="button" 
              variant="outline" 
              className="w-full"
              onClick={handleQRLogin}
              disabled={isLoading}
            >
              <QrCode className="h-4 w-4 mr-2" />
              QR 코드 로그인
            </Button>
            
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-2">
                <Smartphone className="inline h-3 w-3 mr-1" />
                모바일에서 더 편리하게 사용하세요
              </p>
              <p className="text-xs text-gray-400">
                QR 코드를 생성하여 다른 기기에서 스캔하면 바로 로그인할 수 있습니다
              </p>
            </div>
          </div>
          
          <Separator className="my-6" />
          
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">
              처음 사용하시나요?
            </p>
            <Link href="/signup">
              <Button variant="outline" type="button" className="w-full">
                <UserPlus className="h-4 w-4 mr-2" />
                새로운 계정 만들기
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 