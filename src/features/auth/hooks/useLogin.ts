'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { authService } from '@/lib/services/auth';
import { useToast } from '@/hooks/use-toast';
import { LoginFormData } from '@/lib/validations/schemas';

export function useLogin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const setUser = useAuthStore((state) => state.setUser);

  const login = async (credentials: LoginFormData) => {
    setIsLoading(true);
    
    try {
      const user = await authService.login({
        employeeId: credentials.employeeId,
        name: credentials.name,
      });
      
      if (user) {
        setUser(user);
        toast({
          title: '로그인 성공',
          description: `${user.name}님, 환영합니다!`,
        });
        
        // 메인 페이지로 리디렉션
        router.push('/');
        return { success: true, user };
      }
      
      return { success: false, error: '로그인에 실패했습니다.' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.';
      
      toast({
        title: '로그인 실패',
        description: errorMessage,
        variant: 'destructive',
      });
      
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    authService.logout();
    useAuthStore.getState().logout();
    toast({
      title: '로그아웃 완료',
      description: '안전하게 로그아웃되었습니다.',
    });
    router.push('/login');
  };

  return {
    login,
    logout,
    isLoading,
  };
} 