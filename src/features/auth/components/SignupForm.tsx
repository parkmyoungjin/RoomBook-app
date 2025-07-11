'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/store/auth';
import { authService } from '@/lib/services/auth';
import { signupSchema, type SignupFormData } from '@/lib/validations/schemas';
import { UserPlus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export function SignupForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuthStore();

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      employeeId: '',
      name: '',
      department: '',
    },
  });

  // 이미 로그인된 사용자는 메인 페이지로 리디렉션
  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

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

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      await authService.createUser({
        employee_id: data.employeeId,
        name: data.name,
        department: data.department,
      });
      
      toast({
        title: '회원가입 성공',
        description: '가입이 완료되었습니다. 로그인 페이지로 이동합니다.',
      });
      
      // 회원가입 성공 후 로그인 페이지로 이동
      router.push('/login');
    } catch (error) {
      toast({
        title: '회원가입 실패',
        description: error instanceof Error ? error.message : '회원가입 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-green-100 rounded-full">
              <UserPlus className="h-6 w-6 text-green-600" aria-hidden="true" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">회원가입</CardTitle>
          <CardDescription>
            사번, 이름, 부서를 입력하여 회원가입을 완료해주세요
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>사번</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="사번을 입력하세요" disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이름</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="이름을 입력하세요" disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>부서</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="부서를 입력하세요" disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    가입 중...
                  </>
                ) : (
                  '가입하기'
                )}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 mb-2">
              이미 계정이 있으신가요?
            </p>
            <Link href="/login">
              <Button variant="outline" type="button" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                로그인하기
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 