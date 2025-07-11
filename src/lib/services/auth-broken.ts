// 임시 간단한 auth 서비스 (문제 해결용)
'use client';

import { supabase } from '@/lib/supabase/client';

export const authService = {
  async createUser(userData: any) {
    const email = `emp${userData.employee_id.padStart(7, '0')}@company.local`;
    const password = `${userData.employee_id}_${userData.name}`;

    try {
      // 1. Supabase Auth 회원가입 (이메일 확인 비활성화)
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: undefined,
        }
      });

      if (signUpError) {
        throw new Error(`회원가입 실패: ${signUpError.message}`);
      }

      // 2. users 테이블에 직접 삽입 시도
      try {
        const { data: user, error: insertError } = await supabase
          .from('users')
          .insert({
            employee_id: userData.employee_id,
            name: userData.name,
            department: userData.department,
            role: userData.role || 'employee',
            is_active: true,
            // auth_id와 email이 있으면 추가
            ...(authData.user && { auth_id: authData.user.id }),
            email: email
          })
          .select()
          .single();

        if (insertError) {
          console.warn('Users 테이블 삽입 실패:', insertError);
          // 실패해도 계속 진행
        }

        return user || { employee_id: userData.employee_id, name: userData.name };
      } catch (insertErr) {
        console.warn('사용자 데이터 삽입 실패:', insertErr);
        return { employee_id: userData.employee_id, name: userData.name };
      }

    } catch (error) {
      console.error('회원가입 에러:', error);
      throw error;
    }
  },

  async login(data: any) {
    const email = `emp${data.employeeId.padStart(7, '0')}@company.local`;
    const password = `${data.employeeId}_${data.name}`;

    try {
      // 1. Supabase Auth 로그인 시도
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw new Error('사번 또는 이름이 일치하지 않습니다. 먼저 회원가입을 해주세요.');
      }

      // 2. users 테이블에서 사용자 조회 시도 (실패해도 기본 정보 반환)
      try {
        const { data: user, error: userError } = await supabase
          .from('users')
          .select()
          .eq('employee_id', data.employeeId)
          .single();

        if (user) {
          return user;
        }
      } catch (userErr) {
        console.warn('사용자 조회 실패:', userErr);
      }

      // 기본 사용자 정보 반환
      return {
        id: authData.user?.id || 'temp-id',
        employee_id: data.employeeId,
        name: data.name,
        department: 'Unknown',
        role: 'employee',
        is_active: true
      };

    } catch (error) {
      console.error('로그인 에러:', error);
      throw error;
    }
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('로그아웃 에러:', error);
    }
  },

  async getCurrentUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      // users 테이블 조회 시도
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('employee_id', session.user.email?.replace(/^emp0*/, '').replace('@company.local', '') || '')
        .single();

      return user || {
        id: session.user.id,
        employee_id: session.user.email?.replace(/^emp0*/, '').replace('@company.local', '') || '',
        name: 'Unknown',
        department: 'Unknown',
        role: 'employee',
        is_active: true
      };
    } catch (error) {
      console.error('현재 사용자 조회 에러:', error);
      return null;
    }
  },

  async isAdmin() {
    const user = await this.getCurrentUser();
    return user?.role === 'admin';
  },

  async getAllUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true);

      return data || [];
    } catch (error) {
      console.error('사용자 목록 조회 에러:', error);
      return [];
    }
  },

  async updateUser(userId: string, updates: any) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('사용자 업데이트 에러:', error);
      throw error;
    }
  }
};
