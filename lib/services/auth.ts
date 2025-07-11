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
  role?: 'employee' | 'admin';
};

export const authService = {
  async createUser(userData: CreateUserData): Promise<User> {
    // ✅ 클라이언트에서는 패스워드 생성하지 않고 서버 API 호출
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '회원가입에 실패했습니다');
    }

    const { user } = await response.json();
    return user;
  },

  async login(data: LoginData): Promise<User> {
    // ✅ 클라이언트에서는 패스워드 생성하지 않고 서버 API 호출
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '로그인에 실패했습니다');
    }

    const { user } = await response.json();
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