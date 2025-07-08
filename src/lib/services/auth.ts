'use client';

import { supabase } from '@/lib/supabase/client';
import type { User, UserInsert } from '@/types/database';

type LoginData = {
  employeeId: string;
  name: string;
};

type CreateUserData = {
  employee_id: string;
  name: string;
  department: string;
};

export const authService = {
  async createUser(userData: CreateUserData): Promise<User> {
    const email = `emp${userData.employee_id}@gmail.com`;
    const password = `${userData.employee_id}_${userData.name}`;

    console.log('회원가입 시작:', userData);

    // metadata와 함께 회원가입
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          employee_id: userData.employee_id,
          name: userData.name,
          department: userData.department
        }
      }
    });

    if (signUpError || !authData.user) {
      console.error('Auth 에러:', signUpError);
      throw new Error(`회원가입 실패: ${signUpError?.message || '사용자 생성 실패'}`);
    }

    console.log('Auth 성공, 트리거로 사용자 데이터 자동 삽입됨');
    
    // 트리거 실행을 위한 짧은 대기
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select()
      .eq('auth_id', authData.user.id)
      .single();

    if (fetchError || !user) {
      console.error('사용자 조회 에러:', fetchError);
      throw new Error(`사용자 정보 조회 실패: ${fetchError?.message || '알 수 없는 오류'}`);
    }

    return user;
  },

  async login(data: LoginData): Promise<User> {
    const email = `emp${data.employeeId}@gmail.com`;
    const password = `${data.employeeId}_${data.name}`;

    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      throw new Error('사번 또는 이름이 일치하지 않습니다.');
    }

    // auth_id로 사용자 정보 조회
    const { data: user, error: userError } = await supabase
      .from('users')
      .select()
      .eq('auth_id', authData.user.id)
      .single();

    if (userError || !user) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }

    return user;
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  async getCurrentUser(): Promise<User | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data: user } = await supabase
      .from('users')
      .select()
      .eq('auth_id', session.user.id)
      .single();

    return user;
  },

  async isAdmin(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user?.role === 'admin';
  },

  async getAllUsers(): Promise<User[]> {
    const { data } = await supabase.from('users').select('*');
    return data || [];
  },

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
};