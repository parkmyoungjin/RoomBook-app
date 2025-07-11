'use client';

import { supabase } from '@/lib/supabase/client';
import { User } from '@/types/database';

export interface QRTokenInfo {
  qr_token: string;
  expires_at: string;
}

export interface QRValidationResult {
  user_id: string;
  employee_id: string;
  name: string;
  department: string;
  role: 'employee' | 'admin';
  is_valid: boolean;
}

export interface QRLoginData {
  token: string;
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    screenSize?: string;
  };
}

export const qrAuthService = {
  /**
   * 사용자의 QR 토큰을 생성합니다.
   * @param userId - 사용자 ID
   * @returns QR 토큰 정보
   */
  async generateQRToken(userId: string): Promise<QRTokenInfo> {
    const { data, error } = await supabase
      .rpc('generate_qr_token_for_user', { user_id: userId });

    if (error) {
      console.error('QR 토큰 생성 실패:', error);
      throw new Error('QR 토큰 생성에 실패했습니다.');
    }

    if (!data || data.length === 0) {
      throw new Error('QR 토큰 생성 결과가 없습니다.');
    }

    return data[0];
  },

  /**
   * QR 토큰을 검증합니다.
   * @param token - QR 토큰
   * @returns 검증 결과
   */
  async validateQRToken(token: string): Promise<QRValidationResult> {
    const { data, error } = await supabase
      .rpc('validate_qr_token', { token });

    if (error) {
      console.error('QR 토큰 검증 실패:', error);
      throw new Error('QR 토큰 검증에 실패했습니다.');
    }

    if (!data || data.length === 0) {
      throw new Error('유효하지 않은 QR 토큰입니다.');
    }

    return data[0];
  },

  /**
   * QR 코드로 로그인합니다.
   * @param loginData - QR 로그인 데이터
   * @returns 사용자 정보
   */
  async loginWithQR(loginData: QRLoginData): Promise<User> {
    try {
      // 1. QR 토큰 검증
      const validation = await this.validateQRToken(loginData.token);
      
      if (!validation.is_valid) {
        throw new Error('QR 코드가 만료되었거나 유효하지 않습니다.');
      }

      // 2. 사용 기록 저장
      const deviceInfo = {
        userAgent: loginData.deviceInfo?.userAgent || navigator.userAgent,
        platform: loginData.deviceInfo?.platform || navigator.platform,
        screenSize: loginData.deviceInfo?.screenSize || `${screen.width}x${screen.height}`,
        timestamp: new Date().toISOString()
      };

      const { data: recordResult, error: recordError } = await supabase
        .rpc('record_qr_usage', {
          token: loginData.token,
          device_info: deviceInfo,
          ip_address: null, // 클라이언트에서는 IP 주소를 알 수 없음
          user_agent: deviceInfo.userAgent
        });

      if (recordError) {
        console.error('QR 사용 기록 저장 실패:', recordError);
        // 기록 실패해도 로그인은 계속 진행
      }

      // 3. 사용자 정보 조회
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', validation.user_id)
        .single();

      if (userError || !user) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }

      return user;
    } catch (error) {
      console.error('QR 로그인 실패:', error);
      throw error;
    }
  },

  /**
   * QR 코드 URL을 생성합니다.
   * @param token - QR 토큰
   * @returns QR 코드 URL
   */
  generateQRCodeURL(token: string): string {
    // QR 코드 생성 서비스 사용 (예: qr-server.com)
    const baseUrl = window.location.origin;
    const qrData = `${baseUrl}/qr-login?token=${token}`;
    
    // QR 코드 생성 API 사용
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;
  },

  /**
   * QR 코드 데이터를 생성합니다.
   * @param token - QR 토큰
   * @returns QR 코드 데이터
   */
  generateQRCodeData(token: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/qr-login?token=${token}`;
  },

  /**
   * 사용자의 QR 세션들을 조회합니다.
   * @param userId - 사용자 ID
   * @returns QR 세션 목록
   */
  async getQRSessions(userId: string) {
    const { data, error } = await supabase
      .from('qr_login_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('QR 세션 조회 실패:', error);
      throw new Error('QR 세션 조회에 실패했습니다.');
    }

    return data || [];
  },

  /**
   * 만료된 QR 토큰들을 정리합니다.
   * @returns 정리된 토큰 수
   */
  async cleanupExpiredTokens(): Promise<number> {
    const { data, error } = await supabase
      .rpc('cleanup_expired_qr_tokens');

    if (error) {
      console.error('만료된 QR 토큰 정리 실패:', error);
      throw new Error('만료된 QR 토큰 정리에 실패했습니다.');
    }

    return data || 0;
  },

  /**
   * QR 갱신 이벤트를 처리합니다.
   * @param userId - 사용자 ID
   * @returns 새로운 QR 토큰 정보
   */
  async refreshQRToken(userId: string): Promise<QRTokenInfo> {
    try {
      console.log('QR 토큰 갱신 시작:', userId);
      
      // 기존 토큰 무효화 후 새 토큰 생성
      const newToken = await this.generateQRToken(userId);
      
      console.log('QR 토큰 갱신 완료:', newToken);
      
      // 커스텀 이벤트 발생 (UI 업데이트용)
      window.dispatchEvent(new CustomEvent('qr-token-updated', {
        detail: newToken
      }));
      
      return newToken;
    } catch (error) {
      console.error('QR 토큰 갱신 실패:', error);
      throw error;
    }
  }
}; 