import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

const qrLoginSchema = z.object({
  token: z.string().min(1, 'QR 토큰이 필요합니다'),
  deviceInfo: z.object({
    userAgent: z.string().optional(),
    platform: z.string().optional(),
    screenSize: z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, deviceInfo } = qrLoginSchema.parse(body);

    const supabase = await createClient();
    
    // 1. QR 토큰 검증
    const { data: validationResult, error: validationError } = await supabase
      .rpc('validate_qr_token', { token });

    if (validationError) {
      logger.server.error('QR 토큰 검증 실패', validationError);
      return NextResponse.json(
        { error: 'QR 토큰 검증에 실패했습니다' },
        { status: 400 }
      );
    }

    if (!validationResult || validationResult.length === 0) {
      logger.server.info('유효하지 않은 QR 토큰 사용 시도', { token: token.substring(0, 8) + '...' });
      return NextResponse.json(
        { error: '유효하지 않은 QR 토큰입니다' },
        { status: 401 }
      );
    }

    const validation = validationResult[0];
    
    if (!validation.is_valid) {
      logger.server.info('만료된 QR 토큰 사용 시도', { 
        token: token.substring(0, 8) + '...',
        user_id: validation.user_id 
      });
      return NextResponse.json(
        { error: 'QR 코드가 만료되었거나 유효하지 않습니다' },
        { status: 401 }
      );
    }

    // 2. 사용 기록 저장
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    const recordDeviceInfo = {
      userAgent: deviceInfo?.userAgent || userAgent,
      platform: deviceInfo?.platform || 'unknown',
      screenSize: deviceInfo?.screenSize || 'unknown',
      timestamp: new Date().toISOString(),
      loginMethod: 'qr'
    };

    const { data: recordResult, error: recordError } = await supabase
      .rpc('record_qr_usage', {
        token,
        device_info: recordDeviceInfo,
        ip_address: clientIP,
        user_agent: userAgent
      });

    if (recordError) {
      logger.server.error('QR 사용 기록 저장 실패', recordError);
      // 기록 실패해도 로그인은 계속 진행
    }

    // 3. 사용자 정보 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', validation.user_id)
      .single();

    if (userError || !user) {
      logger.server.error('QR 로그인 후 사용자 정보 조회 실패', userError);
      return NextResponse.json(
        { error: '사용자 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 4. 성공 로그
    logger.userAction(`QR 로그인 성공 - ${user.name} (${user.employee_id})`, true);
    
    return NextResponse.json({ 
      user,
      message: 'QR 로그인 성공',
      loginTime: new Date().toISOString()
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.server.error('QR 로그인 요청 데이터 검증 실패', error.errors);
      return NextResponse.json(
        { error: '요청 데이터가 올바르지 않습니다' },
        { status: 400 }
      );
    }

    logger.server.error('QR 로그인 API 예상치 못한 오류', error);
    return NextResponse.json(
      { error: '로그인 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// QR 토큰 상태 확인 (GET 요청)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'QR 토큰이 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    
    const { data: validationResult, error: validationError } = await supabase
      .rpc('validate_qr_token', { token });

    if (validationError) {
      logger.server.error('QR 토큰 상태 확인 실패', validationError);
      return NextResponse.json(
        { error: 'QR 토큰 상태 확인에 실패했습니다' },
        { status: 400 }
      );
    }

    if (!validationResult || validationResult.length === 0) {
      return NextResponse.json(
        { valid: false, message: '유효하지 않은 QR 토큰입니다' },
        { status: 200 }
      );
    }

    const validation = validationResult[0];
    
    return NextResponse.json({
      valid: validation.is_valid,
      user: validation.is_valid ? {
        employee_id: validation.employee_id,
        name: validation.name,
        department: validation.department,
        role: validation.role
      } : null,
      message: validation.is_valid ? '유효한 QR 토큰입니다' : 'QR 토큰이 만료되었습니다'
    });

  } catch (error) {
    logger.server.error('QR 토큰 상태 확인 API 오류', error);
    return NextResponse.json(
      { error: '토큰 상태 확인 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
} 