'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { authService } from '@/lib/services/auth';

export function useAuthGuard() {
  const router = useRouter();
  const { user, setUser, setLoading, isLoading } = useAuthStore();
  const hasCheckedAuth = useRef(false);

  useEffect(() => {
    const checkAuth = async () => {
      // 이미 체크했거나 사용자 정보가 있으면 스킵
      if (hasCheckedAuth.current || user) {
        return;
      }

      try {
        setLoading(true);
        hasCheckedAuth.current = true;
        
        // localStorage나 세션에서 사용자 정보 확인
        const currentUser = await authService.getCurrentUser();
        
        if (currentUser) {
          setUser(currentUser);
        } else {
          // 로그인되지 않은 경우 로그인 페이지로 리디렉션
          router.push('/login');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, setUser, setLoading]); // user 제거

  return { user, isAuthenticated: !!user, isLoading };
}

export function useRequireAuth() {
  return useAuthGuard();
} 