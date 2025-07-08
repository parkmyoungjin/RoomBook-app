import { z } from 'zod';

// Base schemas for enums
export const userRoleSchema = z.enum(['employee', 'admin']);
export const reservationStatusSchema = z.enum(['confirmed', 'cancelled']);

// 사번 형식 검증을 위한 커스텀 스키마
const employeeIdSchema = z.string()
  .regex(/^\d{7}$/, '사번은 7자리 숫자여야 합니다')
  .transform((val) => val.padStart(7, '0')); // 7자리 미만인 경우 앞에 0을 채움

// User schemas
export const userSchema = z.object({
  id: z.string().uuid(),
  employee_id: employeeIdSchema,
  name: z.string().min(1, '이름을 입력해주세요').max(100),
  email: z.string().email('올바른 이메일 형식이 아닙니다').max(255),
  department: z.string().min(1, '부서를 입력해주세요').max(100),
  role: userRoleSchema.default('employee'),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const userInsertSchema = userSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  role: true,
  is_active: true,
});

export const userUpdateSchema = userSchema.partial();

// Room schemas
export const roomAmenitiesSchema = z.record(z.string(), z.boolean()).default({});

export const roomSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, '회의실 이름을 입력해주세요').max(100),
  description: z.string().nullable(),
  capacity: z.number().int().min(1, '최소 1명 이상이어야 합니다').default(1),
  location: z.string().nullable(),
  amenities: roomAmenitiesSchema,
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const roomInsertSchema = roomSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  description: true,
  capacity: true,
  location: true,
  amenities: true,
  is_active: true,
});

export const roomUpdateSchema = roomSchema.partial();

// Reservation schemas
const baseReservationSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid('회의실을 선택해주세요'),
  user_id: z.string().uuid(),
  title: z.string().min(1, '예약 제목을 입력해주세요').max(255),
  purpose: z.string().nullable(),
  start_time: z.string().datetime('시작 시간을 선택해주세요'),
  end_time: z.string().datetime('종료 시간을 선택해주세요'),
  status: reservationStatusSchema.default('confirmed'),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const reservationSchema = z.object({
  room_id: z.string().uuid('올바른 회의실을 선택해주세요'),
  title: z.string().min(1, '예약 제목을 입력해주세요'),
  purpose: z.string().optional(),
  start_time: z.date(),
  end_time: z.date(),
}).refine((data) => data.end_time > data.start_time, {
  message: '종료 시간은 시작 시간보다 늦어야 합니다',
  path: ['end_time'],
});

export const reservationInsertSchema = baseReservationSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).partial({
  purpose: true,
  status: true,
}).refine(
  (data) => new Date(data.end_time) > new Date(data.start_time),
  {
    message: '종료 시간이 시작 시간보다 늦어야 합니다',
    path: ['end_time'],
  }
);

export const reservationUpdateSchema = baseReservationSchema.partial().refine(
  (data) => {
    if (data.start_time && data.end_time) {
      return new Date(data.end_time) > new Date(data.start_time);
    }
    return true;
  },
  {
    message: '종료 시간이 시작 시간보다 늦어야 합니다',
    path: ['end_time'],
  }
);

// Form schemas for UI
export const loginSchema = z.object({
  employeeId: employeeIdSchema,
  name: z.string().min(1, '이름을 입력해주세요'),
});

export const reservationFormSchema = z.object({
  room_id: z.string().uuid('회의실을 선택해주세요'),
  title: z.string().min(1, '예약 제목을 입력해주세요').max(255),
  purpose: z.string().optional(),
  start_time: z.string().datetime('시작 시간을 선택해주세요'),
  end_time: z.string().datetime('종료 시간을 선택해주세요'),
}).refine(
  (data) => new Date(data.end_time) > new Date(data.start_time),
  {
    message: '종료 시간이 시작 시간보다 늦어야 합니다',
    path: ['end_time'],
  }
);

export const roomFormSchema = z.object({
  name: z.string().min(1, '회의실 이름을 입력해주세요').max(100),
  description: z.string().optional(),
  capacity: z.number().int().min(1, '최소 1명 이상이어야 합니다').default(1),
  location: z.string().optional(),
  amenities: z.record(z.string(), z.boolean()).default({}),
});

// API parameter schemas
export const getPublicReservationsSchema = z.object({
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
});

export const dateRangeSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
}).refine(
  (data) => new Date(data.end) > new Date(data.start),
  {
    message: '종료 날짜가 시작 날짜보다 늦어야 합니다',
    path: ['end'],
  }
);

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>;
export type ReservationFormData = z.infer<typeof reservationSchema>;
export type RoomFormData = z.infer<typeof roomFormSchema>;
export type DateRange = z.infer<typeof dateRangeSchema>;

export const signupSchema = z.object({
  employeeId: employeeIdSchema,
  name: z.string().min(1, '이름을 입력해주세요'),
  department: z.string().min(1, '부서를 입력해주세요'),
});

export type SignupFormData = z.infer<typeof signupSchema>; 