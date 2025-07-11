'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/lib/store/auth';
import { useQRAuth, useQRTokenStatus } from '@/hooks/useQRAuth';
import { CheckCircle2, XCircle, RefreshCw, QrCode, AlertCircle, User, Building2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// QR 로그인 로직을 포함한 별도 컴포넌트
function QRLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, setUser } = useAuthStore();
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const [loginStatus, setLoginStatus] = useState<'checking' | 'valid' | 'invalid' | 'expired' | 'logged-in'>('checking');

  const token = searchParams.get('token');
  const { loginWithQR, isLoggingIn } = useQRAuth();
  const { data: tokenStatus, isLoading: isCheckingToken, error: tokenError } = useQRTokenStatus(token);

  // 토큰 상태 확인 후 자동 로그인 시도
  useEffect(() => {
    if (!token) {
      setLoginStatus('invalid');
      return;
    }

    if (tokenStatus && !autoLoginAttempted) {
      setAutoLoginAttempted(true);

      if (tokenStatus.valid) {
        setLoginStatus('valid');
        // 자동 로그인 시도
        handleAutoLogin();
      } else {
        setLoginStatus('expired');
      }
    }
  }, [token, tokenStatus, autoLoginAttempted]);

  // 자동 로그인 처리
  const handleAutoLogin = async () => {
    if (!token) return;

    try {
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenSize: `${screen.width}x${screen.height}`,
      };

      const response = await fetch('/api/auth/qr-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          deviceInfo,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'QR 로그인 실패');
      }

      const data = await response.json();
      setUser(data.user);
      setLoginStatus('logged-in');
      
      toast({
        title: '로그인 성공',
        description: `환영합니다, ${data.user.name}님!`,
      });

      // 3초 후 대시보드로 이동
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);

    } catch (error) {
      console.error('자동 로그인 실패:', error);
      setLoginStatus('invalid');
      toast({
        title: '로그인 실패',
        description: error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  // 수동 로그인 시도
  const handleManualLogin = () => {
    if (!token) return;

    const deviceInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screenSize: `${screen.width}x${screen.height}`,
    };

    loginWithQR({ token, deviceInfo });
  };

  // 로그인 상태에 따른 아이콘 및 색상
  const getStatusIcon = () => {
    switch (loginStatus) {
      case 'checking':
        return <RefreshCw className="w-12 h-12 animate-spin text-blue-500" />;
      case 'valid':
        return <QrCode className="w-12 h-12 text-green-500" />;
      case 'logged-in':
        return <CheckCircle2 className="w-12 h-12 text-green-500" />;
      case 'expired':
        return <AlertCircle className="w-12 h-12 text-orange-500" />;
      case 'invalid':
        return <XCircle className="w-12 h-12 text-red-500" />;
      default:
        return <QrCode className="w-12 h-12 text-gray-500" />;
    }
  };

  // 로그인 상태에 따른 메시지
  const getStatusMessage = () => {
    switch (loginStatus) {
      case 'checking':
        return {
          title: 'QR 코드 확인 중...',
          description: '잠시만 기다려주세요',
        };
      case 'valid':
        return {
          title: '로그인 중...',
          description: '자동으로 로그인하고 있습니다',
        };
      case 'logged-in':
        return {
          title: '로그인 완료!',
          description: '곧 대시보드로 이동합니다',
        };
      case 'expired':
        return {
          title: 'QR 코드 만료',
          description: 'QR 코드가 만료되었습니다. 새로 생성해주세요',
        };
      case 'invalid':
        return {
          title: '유효하지 않은 QR 코드',
          description: 'QR 코드가 올바르지 않습니다',
        };
      default:
        return {
          title: '알 수 없는 상태',
          description: '다시 시도해주세요',
        };
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* 로고 영역 */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">회의실 예약 시스템</h1>
          <p className="text-gray-600">QR 코드 로그인</p>
        </div>

        {/* 상태 카드 */}
        <Card className="shadow-lg">
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              {/* 상태 아이콘 */}
              <div className="flex justify-center">
                {getStatusIcon()}
              </div>

              {/* 상태 메시지 */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {statusMessage.title}
                </h2>
                <p className="text-gray-600">
                  {statusMessage.description}
                </p>
              </div>

              {/* 사용자 정보 (로그인 완료 시) */}
              {loginStatus === 'logged-in' && tokenStatus?.user && (
                <div className="mt-6 p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <User className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">
                      {tokenStatus.user.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Building2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700">
                      {tokenStatus.user.department}
                    </span>
                  </div>
                </div>
              )}

              {/* 액션 버튼들 */}
              <div className="flex gap-2 justify-center">
                {loginStatus === 'checking' && (
                  <Button disabled className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    확인 중...
                  </Button>
                )}

                {loginStatus === 'valid' && (
                  <Button disabled className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    로그인 중...
                  </Button>
                )}

                {loginStatus === 'logged-in' && (
                  <Button onClick={() => router.push('/dashboard')} className="w-full">
                    대시보드로 이동
                  </Button>
                )}

                {(loginStatus === 'expired' || loginStatus === 'invalid') && (
                  <div className="w-full space-y-2">
                    <Button
                      onClick={() => router.push('/my-qr')}
                      variant="outline"
                      className="w-full"
                    >
                      새 QR 코드 생성
                    </Button>
                    <Button
                      onClick={() => router.push('/login')}
                      variant="secondary"
                      className="w-full"
                    >
                      일반 로그인
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 도움말 */}
        <Card>
          <CardContent className="p-4">
            <div className="text-center space-y-2">
              <h3 className="font-medium text-gray-900">QR 코드 로그인 안내</h3>
              <p className="text-sm text-gray-600">
                이 페이지는 QR 코드 스캔 시 자동으로 열리며, 로그인 처리가 완료됩니다.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 로딩 컴포넌트
function QRLoginFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">회의실 예약 시스템</h1>
          <p className="text-gray-600">QR 코드 로그인</p>
        </div>
        
        <Card className="shadow-lg">
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <RefreshCw className="w-12 h-12 animate-spin text-blue-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  로딩 중...
                </h2>
                <p className="text-gray-600">
                  잠시만 기다려주세요
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 메인 컴포넌트 (Suspense로 감싸기)
export default function QRLoginPage() {
  return (
    <Suspense fallback={<QRLoginFallback />}>
      <QRLoginContent />
    </Suspense>
  );
} 