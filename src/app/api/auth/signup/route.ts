import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

const signupSchema = z.object({
  employee_id: z.string().min(1),
  name: z.string().min(1),
  department: z.string().min(1),
  role: z.enum(['employee', 'admin']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userData = signupSchema.parse(body);

    // ✅ 서버에서만 패스워드 생성 (클라이언트에 노출되지 않음)
    const email = `emp${userData.employee_id}@gmail.com`;
    const password = `${userData.employee_id}_${userData.name}_${process.env.AUTH_SECRET_SALT || 'fallback_salt'}`;

    const supabase = await createClient();

    // Supabase Auth 회원가입
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          employee_id: userData.employee_id,
          name: userData.name,
          department: userData.department,
          role: userData.role || 'employee'
        }
      }
    });

    if (signUpError || !authData.user) {
      // ✅ 서버 로그에만 상세 에러 기록, 클라이언트에는 안전한 메시지만
      logger.server.error('Auth signup failed', signUpError);
      return NextResponse.json(
        { error: '회원가입에 실패했습니다' },
        { status: 400 }
      );
    }

    // 트리거 실행을 위한 대기
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 사용자 정보 조회
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select()
      .eq('auth_id', authData.user.id)
      .single();

    if (fetchError || !user) {
      // ✅ 서버 로그에만 상세 에러 기록
      logger.server.error('User fetch failed after signup', fetchError);
      return NextResponse.json(
        { error: '사용자 정보 조회에 실패했습니다' },
        { status: 500 }
      );
    }

    logger.userAction('User signup', true);
    // ✅ 패스워드는 절대 반환하지 않음
    return NextResponse.json({ user });

  } catch (error) {
    // ✅ 서버 로그에만 상세 에러 기록
    logger.server.error('Signup API unexpected error', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    );
  }
} 