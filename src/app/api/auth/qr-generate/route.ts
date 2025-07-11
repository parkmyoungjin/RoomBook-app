import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

const qrGenerateSchema = z.object({
  employeeId: z.string().min(1, '사번이 필요합니다'),
  name: z.string().min(1, '이름이 필요합니다'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, name } = qrGenerateSchema.parse(body);

    const supabase = await createClient();
    
    // 1. 사용자 인증 (사번과 이름으로 확인)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('name', name)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      logger.server.info('QR 토큰 생성 시 사용자 인증 실패', { 
        employeeId: employeeId,
        name: name,
        error: userError?.message 
      });
      return NextResponse.json(
        { error: '사번 또는 이름이 일치하지 않습니다' },
        { status: 401 }
      );
    }

    // 2. QR 토큰 생성
    const { data: tokenResult, error: tokenError } = await supabase
      .rpc('generate_qr_token_for_user', { user_id: user.id });

    if (tokenError) {
      logger.server.error('QR 토큰 생성 실패', tokenError);
      return NextResponse.json(
        { error: 'QR 토큰 생성에 실패했습니다' },
        { status: 500 }
      );
    }

    if (!tokenResult || tokenResult.length === 0) {
      logger.server.error('QR 토큰 생성 결과 없음', { user_id: user.id });
      return NextResponse.json(
        { error: 'QR 토큰 생성 결과가 없습니다' },
        { status: 500 }
      );
    }

    const tokenInfo = tokenResult[0];
    
    // 3. QR 코드 URL 생성
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const qrData = `${baseUrl}/qr-login?token=${tokenInfo.qr_token}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

    // 4. 성공 로그
    logger.userAction(`QR 토큰 생성 성공 - ${user.name} (${user.employee_id})`, true);

    return NextResponse.json({
      qr_token: tokenInfo.qr_token,
      expires_at: tokenInfo.expires_at,
      qr_data: qrData,
      qr_image_url: qrImageUrl,
      user: {
        id: user.id,
        employee_id: user.employee_id,
        name: user.name,
        department: user.department,
        role: user.role
      },
      message: 'QR 토큰 생성 성공'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.server.error('QR 토큰 생성 요청 데이터 검증 실패', error.errors);
      return NextResponse.json(
        { error: '요청 데이터가 올바르지 않습니다' },
        { status: 400 }
      );
    }

    logger.server.error('QR 토큰 생성 API 예상치 못한 오류', error);
    return NextResponse.json(
      { error: 'QR 토큰 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

// QR 토큰 갱신 (PUT 요청)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, name } = qrGenerateSchema.parse(body);

    const supabase = await createClient();
    
    // 1. 사용자 인증
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('name', name)
      .eq('is_active', true)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: '사번 또는 이름이 일치하지 않습니다' },
        { status: 401 }
      );
    }

    // 2. 기존 QR 토큰 만료 (새 토큰 생성으로 자동 교체됨)
    const { data: tokenResult, error: tokenError } = await supabase
      .rpc('generate_qr_token_for_user', { user_id: user.id });

    if (tokenError) {
      logger.server.error('QR 토큰 갱신 실패', tokenError);
      return NextResponse.json(
        { error: 'QR 토큰 갱신에 실패했습니다' },
        { status: 500 }
      );
    }

    if (!tokenResult || tokenResult.length === 0) {
      return NextResponse.json(
        { error: 'QR 토큰 갱신 결과가 없습니다' },
        { status: 500 }
      );
    }

    const tokenInfo = tokenResult[0];
    
    // 3. QR 코드 URL 생성
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const qrData = `${baseUrl}/qr-login?token=${tokenInfo.qr_token}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrData)}`;

    // 4. 성공 로그
    logger.userAction(`QR 토큰 갱신 성공 - ${user.name} (${user.employee_id})`, true);

    return NextResponse.json({
      qr_token: tokenInfo.qr_token,
      expires_at: tokenInfo.expires_at,
      qr_data: qrData,
      qr_image_url: qrImageUrl,
      user: {
        id: user.id,
        employee_id: user.employee_id,
        name: user.name,
        department: user.department,
        role: user.role
      },
      message: 'QR 토큰 갱신 성공'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.server.error('QR 토큰 갱신 요청 데이터 검증 실패', error.errors);
      return NextResponse.json(
        { error: '요청 데이터가 올바르지 않습니다' },
        { status: 400 }
      );
    }

    logger.server.error('QR 토큰 갱신 API 예상치 못한 오류', error);
    return NextResponse.json(
      { error: 'QR 토큰 갱신 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
} 