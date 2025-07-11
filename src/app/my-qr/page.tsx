'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/lib/store/auth';
import { useQRAuth, useQRAutoRefresh } from '@/hooks/useQRAuth';
import { RefreshCw, QrCode, Clock, Shield, Share2, LogIn } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function MyQRPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [isDirectLogging, setIsDirectLogging] = useState(false);

  const {
    qrToken,
    isQRExpired,
    isGenerating,
    isRefreshing,
    generateQRToken,
    refreshQRToken,
    generateQRCodeURL,
    generateQRCodeData,
    clearQRToken,
  } = useQRAuth();

  // QR 토큰 자동 갱신 훅 연동
  useQRAutoRefresh(user?.id || null);

  // 로그인한 사용자 정보로 자동 입력
  useEffect(() => {
    if (user) {
      setEmployeeId(user.employee_id);
      setName(user.name);
    }
  }, [user]);

  // QR 코드 생성 처리
  const handleGenerateQR = () => {
    if (!employeeId || !name) {
      toast({
        title: '입력 오류',
        description: '사번과 이름을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    generateQRToken({ employeeId, name });
  };

  // QR 코드 갱신 처리
  const handleRefreshQR = () => {
    if (!employeeId || !name) {
      toast({
        title: '입력 오류',
        description: '사번과 이름을 입력해주세요.',
        variant: 'destructive',
      });
      return;
    }

    refreshQRToken({ employeeId, name });
  };

  // 직접 로그인 처리
  const handleDirectLogin = async () => {
    if (!qrToken || isQRExpired) {
      toast({
        title: '로그인 불가',
        description: 'QR 코드가 만료되었거나 유효하지 않습니다.',
        variant: 'destructive',
      });
      return;
    }

    setIsDirectLogging(true);

    try {
      // 디바이스 정보 수집
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenSize: `${screen.width}x${screen.height}`,
      };

      // QR 로그인 API 호출
      const response = await fetch('/api/auth/qr-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: qrToken.qr_token,
          deviceInfo,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'QR 로그인 실패');
      }

      const data = await response.json();
      
      // 로그인 성공 처리
      setUser(data.user);
      
      toast({
        title: '로그인 성공',
        description: `환영합니다, ${data.user.name}님!`,
      });

      // 2초 후 대시보드로 이동
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (error) {
      console.error('직접 로그인 실패:', error);
      toast({
        title: '로그인 실패',
        description: error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    } finally {
      setIsDirectLogging(false);
    }
  };

  // QR 코드 공유 처리
  const handleShareQR = async () => {
    if (!qrToken) return;

    const qrData = generateQRCodeData(qrToken.qr_token);
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: '내 QR 로그인 코드',
          text: '회의실 예약 시스템 QR 로그인',
          url: qrData,
        });
      } catch (error) {
        console.log('공유 취소됨');
      }
    } else {
      // 클립보드에 복사
      try {
        await navigator.clipboard.writeText(qrData);
        toast({
          title: '복사 완료',
          description: 'QR 코드 링크가 클립보드에 복사되었습니다.',
        });
      } catch (error) {
        toast({
          title: '복사 실패',
          description: '링크 복사에 실패했습니다.',
          variant: 'destructive',
        });
      }
    }
  };

  // 만료 시간 포맷팅
  const formatExpiryTime = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffMs <= 0) return '만료됨';
    if (diffHours > 0) return `${diffHours}시간 ${diffMinutes}분 후 만료`;
    return `${diffMinutes}분 후 만료`;
  };

  return (
    <div className="container mx-auto p-4 max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">내 QR 코드</h1>
        <p className="text-muted-foreground">
          QR 코드를 생성하고 바로 로그인하거나 다른 기기에서 스캔하세요
        </p>
      </div>

      {/* QR 코드 생성 폼 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            QR 코드 생성
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="employeeId">사번</Label>
            <Input
              id="employeeId"
              type="text"
              placeholder="사번을 입력하세요"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              disabled={isGenerating || isRefreshing}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              type="text"
              placeholder="이름을 입력하세요"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isGenerating || isRefreshing}
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerateQR}
              disabled={isGenerating || isRefreshing}
              className="flex-1"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4 mr-2" />
              )}
              {qrToken ? 'QR 코드 재생성' : 'QR 코드 생성'}
            </Button>
            
            {qrToken && (
              <Button
                onClick={handleRefreshQR}
                disabled={isGenerating || isRefreshing}
                variant="outline"
                size="icon"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* QR 코드 표시 */}
      {qrToken && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                QR 코드
              </span>
              <Badge variant={isQRExpired ? "destructive" : "secondary"}>
                {isQRExpired ? '만료됨' : '활성'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* QR 코드 이미지 */}
            <div className="flex justify-center">
              <div className="relative">
                <img
                  src={generateQRCodeURL(qrToken.qr_token)}
                  alt="QR 코드"
                  className={`w-64 h-64 border rounded-lg ${
                    isQRExpired ? 'opacity-50 grayscale' : ''
                  }`}
                />
                {isQRExpired && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                    <span className="text-white font-semibold">만료됨</span>
                  </div>
                )}
              </div>
            </div>

            {/* 만료 시간 정보 */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{formatExpiryTime(qrToken.expires_at)}</span>
            </div>

            <Separator />

            {/* 메인 로그인 버튼 */}
            <Button
              onClick={handleDirectLogin}
              disabled={isQRExpired || isDirectLogging}
              className="w-full"
              size="lg"
            >
              {isDirectLogging ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <LogIn className="w-5 h-5 mr-2" />
              )}
              {isDirectLogging ? '로그인 중...' : '이 QR로 바로 로그인'}
            </Button>

            {/* 보조 액션 버튼들 */}
            <div className="flex gap-2">
              <Button
                onClick={handleShareQR}
                variant="outline"
                className="flex-1"
                disabled={isQRExpired}
              >
                <Share2 className="w-4 h-4 mr-2" />
                다른 기기로 공유
              </Button>
              
              <Button
                onClick={() => setShowQRCode(!showQRCode)}
                variant="outline"
                className="flex-1"
              >
                {showQRCode ? '숨기기' : '크게 보기'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 사용 안내 */}
      <Card>
        <CardHeader>
          <CardTitle>사용 방법</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
              1
            </div>
            <div>
              <p className="font-medium">이 기기에서 바로 로그인</p>
              <p className="text-muted-foreground">
                QR 생성 후 "이 QR로 바로 로그인" 버튼을 클릭하세요
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center text-xs font-bold">
              2
            </div>
            <div>
              <p className="font-medium">다른 기기에서 스캔</p>
              <p className="text-muted-foreground">
                다른 기기에서 QR 코드를 스캔하거나 "공유하기"로 링크 전송
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-muted text-muted-foreground rounded-full flex items-center justify-center text-xs font-bold">
              💡
            </div>
            <div>
              <p className="font-medium">팁: 스크린샷으로도 가능</p>
              <p className="text-muted-foreground">
                QR 코드 스크린샷 후 카메라 앱의 갤러리 스캔 기능 사용
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 전체화면 QR 코드 */}
      {showQRCode && qrToken && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setShowQRCode(false)}
        >
          <div className="bg-white p-8 rounded-lg max-w-sm w-full mx-4">
            <img
              src={generateQRCodeURL(qrToken.qr_token)}
              alt="QR 코드"
              className="w-full h-auto border rounded-lg"
            />
            <p className="text-center mt-4 text-sm text-muted-foreground">
              탭하여 닫기
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 