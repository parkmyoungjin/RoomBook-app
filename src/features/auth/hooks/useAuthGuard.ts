'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { authService } from '@/lib/services/auth';

export function useAuthGuard() {
  const router = useRouter();
  const { user, setUser, setLoading, isLoading } = useAuthStore();
  const hasCheckedAuth = useRef(false);
  const isRedirecting = useRef(false);

  useEffect(() => {
    const checkAuth = async () => {
      // 이미 체크했거나 리다이렉트 중이면 스킵
      if (hasCheckedAuth.current || isRedirecting.current) {
        return;
      }

      // 사용자 정보가 있으면 추가 체크 없이 종료
      if (user) {
        hasCheckedAuth.current = true;
        return;
      }

      try {
        setLoading(true);
        hasCheckedAuth.current = true;
        
        // localStorage나 세션에서 사용자 정보 확인
        const currentUser = await authService.getCurrentUser();
        
        if (currentUser) {
          setUser(currentUser);
        } else if (!isRedirecting.current) {
          // 로그인되지 않은 경우 로그인 페이지로 리디렉션
          isRedirecting.current = true;
          router.replace('/login');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (!isRedirecting.current) {
          isRedirecting.current = true;
          router.replace('/login');
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, setUser, setLoading, user]);

  return { user, isAuthenticated: !!user, isLoading };
}

export function useRequireAuth() {
  return useAuthGuard();
} 