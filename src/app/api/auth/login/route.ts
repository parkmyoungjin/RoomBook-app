import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/utils/logger';

const loginSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, name } = loginSchema.parse(body);

    const email = `emp${employeeId}@gmail.com`;
    const supabase = await createClient();

    // 🔄 점진적 업그레이드: 기존 패턴으로 먼저 시도
    const legacyPassword = `${employeeId}_${name}`;
    const newPassword = `${employeeId}_${name}_${process.env.AUTH_SECRET_SALT || 'fallback_salt'}`;

    let authData = null;
    let shouldUpgradePassword = false;

    // 1단계: 새로운 보안 패턴으로 먼저 시도
    logger.server.info('Attempting login with new password pattern');
    const { data: newAuthData, error: newSignInError } = await supabase.auth.signInWithPassword({
      email,
      password: newPassword,
    });

    if (newAuthData?.user && !newSignInError) {
      // 새로운 패턴으로 성공
      authData = newAuthData;
      logger.server.info('Login successful with new password pattern');
    } else {
      // 2단계: 기존 패턴으로 시도 (호환성)
      logger.server.info('Attempting login with legacy password pattern');
      const { data: legacyAuthData, error: legacySignInError } = await supabase.auth.signInWithPassword({
        email,
        password: legacyPassword,
      });

      if (legacyAuthData?.user && !legacySignInError) {
        // 기존 패턴으로 성공 - 업그레이드 필요
        authData = legacyAuthData;
        shouldUpgradePassword = true;
        logger.server.info('Login successful with legacy password - will upgrade');
      } else {
        // 둘 다 실패
        logger.server.error('Login failed with both patterns', { 
          employeeId, 
          newError: newSignInError?.message,
          legacyError: legacySignInError?.message 
        });
        return NextResponse.json(
          { error: '사번 또는 이름이 일치하지 않습니다' },
          { status: 401 }
        );
      }
    }

    // 사용자 정보 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select()
      .eq('auth_id', authData.user.id)
      .single();

    if (userError || !user) {
      logger.server.error('User data fetch failed after login', userError);
      return NextResponse.json(
        { error: '사용자 정보를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 🔐 보안 업그레이드: 기존 패턴으로 로그인한 경우 새로운 패턴으로 업데이트
    if (shouldUpgradePassword) {
      try {
        logger.server.info('Upgrading user password to new secure pattern');
        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword
        });
        
        if (updateError) {
          logger.server.error('Password upgrade failed', updateError);
          // 업그레이드 실패해도 로그인은 성공으로 처리
        } else {
          logger.server.info('Password successfully upgraded to new pattern');
        }
      } catch (upgradeError) {
        logger.server.error('Password upgrade process failed', upgradeError);
        // 업그레이드 실패해도 로그인은 성공으로 처리
      }
    }

    logger.userAction('User login', true);
    return NextResponse.json({ user });

  } catch (error) {
    logger.server.error('Login API unexpected error', error);
    return NextResponse.json(
      { error: '로그인 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
} 