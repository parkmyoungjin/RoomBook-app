'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { authService } from '@/lib/services/auth';
import { signupSchema, type SignupFormData } from '@/lib/validations/schemas';
import { useState } from 'react';

interface SignupDialogProps {
  onSuccess: (employeeId: string, name: string) => void;
}

export function SignupDialog({ onSuccess }: SignupDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      employeeId: '',
      name: '',
      department: '',
    },
  });

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
        description: '가입이 완료되었습니다. 로그인해주세요.',
      });
      
      setIsOpen(false);
      onSuccess(data.employeeId, data.name);
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" type="button" className="w-full mt-2">
          새로운 계정 만들기
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>회원가입</DialogTitle>
          <DialogDescription>
            사번, 이름, 부서를 입력하여 회원가입을 완료해주세요.
          </DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
} 