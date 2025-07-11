// Database Types for Meeting Room Booking System
// Generated from Supabase schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          auth_id: string
          employee_id: string
          name: string
          email: string
          department: string
          role: 'employee' | 'admin'
          is_active: boolean
          qr_token?: string | null
          qr_expires_at?: string | null
          qr_last_used?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          auth_id: string
          employee_id: string
          name: string
          email: string
          department: string
          role?: 'employee' | 'admin'
          is_active?: boolean
          qr_token?: string | null
          qr_expires_at?: string | null
          qr_last_used?: string | null
        }
        Update: {
          auth_id?: string
          employee_id?: string
          name?: string
          email?: string
          department?: string
          role?: 'employee' | 'admin'
          is_active?: boolean
          qr_token?: string | null
          qr_expires_at?: string | null
          qr_last_used?: string | null
        }
      }
      rooms: {
        Row: {
          id: string
          name: string
          description?: string
          capacity: number
          location?: string
          amenities: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          name: string
          description?: string
          capacity: number
          location?: string
          amenities?: Json
          is_active?: boolean
        }
        Update: {
          name?: string
          description?: string
          capacity?: number
          location?: string
          amenities?: Json
          is_active?: boolean
        }
      }
      reservations: {
        Row: {
          id: string
          room_id: string
          user_id: string
          title: string
          purpose?: string
          start_time: string
          end_time: string
          status: 'confirmed' | 'cancelled'
          cancellation_reason?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          room_id: string
          user_id: string
          title: string
          purpose?: string
          start_time: string
          end_time: string
          status?: 'confirmed' | 'cancelled'
          cancellation_reason?: string
        }
        Update: {
          room_id?: string
          user_id?: string
          title?: string
          purpose?: string
          start_time?: string
          end_time?: string
          status?: 'confirmed' | 'cancelled'
          cancellation_reason?: string
        }
      }
      qr_login_sessions: {
        Row: {
          id: string
          user_id: string | null
          qr_token: string
          device_info: Json
          ip_address?: string | null
          user_agent?: string | null
          is_active: boolean
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id?: string | null
          qr_token: string
          device_info?: Json
          ip_address?: string | null
          user_agent?: string | null
          is_active?: boolean
          expires_at: string
        }
        Update: {
          user_id?: string | null
          qr_token?: string
          device_info?: Json
          ip_address?: string | null
          user_agent?: string | null
          is_active?: boolean
          expires_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_reservations: {
        Args: {
          start_date: string;
          end_date: string;
        };
        Returns: PublicReservation[];
      }
      generate_qr_token_for_user: {
        Args: {
          user_id: string;
        };
        Returns: QRTokenInfo[];
      }
      validate_qr_token: {
        Args: {
          token: string;
        };
        Returns: QRValidationResult[];
      }
      create_qr_login_session: {
        Args: {
          p_user_id: string;
          p_qr_token: string;
          p_device_info?: Json;
          p_ip_address?: string;
          p_user_agent?: string;
        };
        Returns: string;
      }
      cleanup_expired_qr_sessions: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      }
      get_user_qr_status: {
        Args: {
          p_user_id: string;
        };
        Returns: QRStatusInfo[];
      }
      invalidate_user_qr_token: {
        Args: {
          p_user_id: string;
        };
        Returns: boolean;
      }
      schedule_qr_cleanup: {
        Args: Record<PropertyKey, never>;
        Returns: void;
      }
    }
    Enums: {
      user_role: 'employee' | 'admin'
      reservation_status: 'confirmed' | 'cancelled'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export type User = Tables<'users'>
export type Room = Tables<'rooms'>
export type Reservation = Tables<'reservations'>
export type QRLoginSession = Tables<'qr_login_sessions'>

// Application Types
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type RoomInsert = Database['public']['Tables']['rooms']['Insert']
export type RoomUpdate = Database['public']['Tables']['rooms']['Update']

export type ReservationInsert = Database['public']['Tables']['reservations']['Insert']
export type ReservationUpdate = Database['public']['Tables']['reservations']['Update']

export type QRLoginSessionInsert = Database['public']['Tables']['qr_login_sessions']['Insert']
export type QRLoginSessionUpdate = Database['public']['Tables']['qr_login_sessions']['Update']

// ✅ PublicReservation 타입 명확한 정의 (get_public_reservations 함수 반환값과 일치)
export type PublicReservation = {
  id: string
  room_id: string
  user_id: string
  title: string
  purpose: string | null
  department: string
  start_time: string
  end_time: string
  is_mine: boolean
}

// QR 관련 타입들
export type QRTokenInfo = {
  qr_token: string
  expires_at: string
}

export type QRValidationResult = {
  user_id: string | null
  employee_id: string | null
  name: string | null
  department: string | null
  role: string | null
  is_valid: boolean
}

export type QRStatusInfo = {
  has_active_token: boolean
  token_expires_at: string | null
  last_used_at: string | null
  active_sessions_count: number
}

export type QRDeviceInfo = {
  userAgent?: string
  platform?: string
  screenSize?: string
  [key: string]: string | undefined
}

// Enums
export type UserRole = Database['public']['Enums']['user_role']
export type ReservationStatus = Database['public']['Enums']['reservation_status']

// Extended types with relations
export type ReservationWithDetails = Reservation & {
  room: Room
  user: User
}

export type RoomAmenities = {
  projector?: boolean
  whiteboard?: boolean
  wifi?: boolean
  tv?: boolean
  microphone?: boolean
  speakers?: boolean
  [key: string]: boolean | undefined
}

// QR 관련 확장 타입들
export type UserWithQRStatus = User & {
  qr_status?: QRStatusInfo
}

export type QRLoginSessionWithUser = QRLoginSession & {
  user?: User
} 