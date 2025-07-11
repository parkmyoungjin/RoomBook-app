'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth';
import { toast } from '@/hooks/use-toast';
import { qrAuthService, QRTokenInfo } from '@/lib/services/qr-auth';

interface QRGenerateData {
  employeeId: string;
  name: string;
}

interface QRLoginData {
  token: string;
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    screenSize?: string;
  };
}

export const useQRAuth = () => {
  const [qrToken, setQrToken] = useState<QRTokenInfo | null>(null);
  const [isQRExpired, setIsQRExpired] = useState(false);
  const { setUser } = useAuthStore();

  // QR 토큰 생성 mutation
  const qrGenerateMutation = useMutation({
    mutationFn: async (data: QRGenerateData) => {
      const response = await fetch('/api/auth/qr-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'QR 토큰 생성 실패');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setQrToken({
        qr_token: data.qr_token,
        expires_at: data.expires_at,
      });
      setIsQRExpired(false);
      toast({
        title: '성공',
        description: 'QR 코드가 생성되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '오류',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // QR 토큰 갱신 mutation
  const qrRefreshMutation = useMutation({
    mutationFn: async (data: QRGenerateData) => {
      const response = await fetch('/api/auth/qr-generate', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'QR 토큰 갱신 실패');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setQrToken({
        qr_token: data.qr_token,
        expires_at: data.expires_at,
      });
      setIsQRExpired(false);
      toast({
        title: '성공',
        description: 'QR 코드가 갱신되었습니다.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '오류',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // QR 로그인 mutation
  const qrLoginMutation = useMutation({
    mutationFn: async (data: QRLoginData) => {
      const response = await fetch('/api/auth/qr-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'QR 로그인 실패');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setUser(data.user);
      toast({
        title: '성공',
        description: 'QR 로그인 성공',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '로그인 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // QR 토큰 만료 체크
  useEffect(() => {
    if (!qrToken) return;

    const checkExpiration = () => {
      const now = new Date();
      const expiresAt = new Date(qrToken.expires_at);
      
      if (now >= expiresAt) {
        setIsQRExpired(true);
        toast({
          title: '알림',
          description: 'QR 코드가 만료되었습니다. 새로 생성해주세요.',
          variant: 'destructive',
        });
      }
    };

    // 즉시 체크
    checkExpiration();

    // 1분마다 체크
    const interval = setInterval(checkExpiration, 60000);

    return () => clearInterval(interval);
  }, [qrToken]);

  // QR 토큰 자동 갱신 (만료 10분 전)
  useEffect(() => {
    if (!qrToken) return;

    const autoRefresh = () => {
      const now = new Date();
      const expiresAt = new Date(qrToken.expires_at);
      const tenMinutesBeforeExpiry = new Date(expiresAt.getTime() - 10 * 60 * 1000);
      
      if (now >= tenMinutesBeforeExpiry && !isQRExpired) {
        // 자동 갱신은 사용자 정보가 필요하므로 알림만 표시
        toast({
          title: '알림',
          description: 'QR 코드가 곧 만료됩니다. 갱신해주세요.',
        });
      }
    };

    const interval = setInterval(autoRefresh, 60000);
    return () => clearInterval(interval);
  }, [qrToken, isQRExpired]);

  // QR 코드 URL 생성
  const generateQRCodeURL = (token: string) => {
    const baseUrl = window.location.origin;
    const qrData = `${baseUrl}/qr-login?token=${token}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
  };

  // QR 코드 데이터 생성
  const generateQRCodeData = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/qr-login?token=${token}`;
  };

  return {
    // 상태
    qrToken,
    isQRExpired,
    
    // 로딩 상태
    isGenerating: qrGenerateMutation.isPending,
    isRefreshing: qrRefreshMutation.isPending,
    isLoggingIn: qrLoginMutation.isPending,
    
    // 함수
    generateQRToken: qrGenerateMutation.mutate,
    refreshQRToken: qrRefreshMutation.mutate,
    loginWithQR: qrLoginMutation.mutate,
    generateQRCodeURL,
    generateQRCodeData,
    
    // 상태 초기화
    clearQRToken: () => {
      setQrToken(null);
      setIsQRExpired(false);
    },
  };
};

// QR 토큰 상태 확인 훅
export const useQRTokenStatus = (token: string | null) => {
  return useQuery({
    queryKey: ['qr-token-status', token],
    queryFn: async () => {
      if (!token) return null;
      
      const response = await fetch(`/api/auth/qr-login?token=${token}`);
      
      if (!response.ok) {
        throw new Error('QR 토큰 상태 확인 실패');
      }
      
      return response.json();
    },
    enabled: !!token,
    refetchInterval: 30000, // 30초마다 상태 확인
  });
};

// QR 토큰 자동 갱신 훅 (Service Worker 연동)
export const useQRAutoRefresh = (userId: string | null) => {
  useEffect(() => {
    if (!userId) return;

    const handleQRTokenUpdate = (event: CustomEvent) => {
      const newToken = event.detail;
      console.log('QR 토큰 자동 갱신됨:', newToken);
      
      toast({
        title: '알림',
        description: 'QR 코드가 자동으로 갱신되었습니다.',
      });
    };

    // Service Worker에서 발생하는 QR 갱신 이벤트 리스너
    window.addEventListener('qr-token-updated', handleQRTokenUpdate as EventListener);

    return () => {
      window.removeEventListener('qr-token-updated', handleQRTokenUpdate as EventListener);
    };
  }, [userId]);
}; 