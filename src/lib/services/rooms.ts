'use client';

import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { RoomInsert, RoomUpdate, RoomAmenities } from '@/types/database';
import { RoomFormData } from '@/lib/validations/schemas';
import { authService } from './auth';

export type Room = Database["public"]["Tables"]["rooms"]["Row"];

export class RoomService {
  private static instance: RoomService;

  private constructor() {}

  static getInstance(): RoomService {
    if (!RoomService.instance) {
      RoomService.instance = new RoomService();
    }
    return RoomService.instance;
  }

  async getActiveRooms(): Promise<Room[]> {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      throw error;
    }

    return data;
  }

  async createRoom(data: RoomFormData): Promise<Room> {
    const roomData: RoomInsert = {
      name: data.name,
      description: data.description,
      capacity: data.capacity,
      location: data.location,
      amenities: data.amenities,
    };

    const { data: room, error } = await supabase
      .from('rooms')
      .insert(roomData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return room;
  }

  async updateRoom(id: string, data: Partial<RoomFormData>): Promise<Room> {
    const updateData: RoomUpdate = {
      ...(data.name && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.capacity && { capacity: data.capacity }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.amenities && { amenities: data.amenities }),
    };

    const { data: room, error } = await supabase
      .from('rooms')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return room;
  }

  async deleteRoom(id: string): Promise<void> {
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  async getAllRoomsIncludingInactive(): Promise<Room[]> {
    // Admin only function
    if (!authService.isAdmin()) {
      throw new Error('관리자 권한이 필요합니다');
    }

    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('name');

    if (error) {
      throw new Error(`전체 회의실 목록 조회 실패: ${error.message}`);
    }

    return data;
  }

  async getRoomById(id: string): Promise<Room | null> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Get room error:', error);
      return null;
    }

    return data;
  }

  async deactivateRoom(id: string): Promise<Room> {
    // Admin only function
    if (!authService.isAdmin()) {
      throw new Error('관리자 권한이 필요합니다');
    }

    try {
      const { data, error } = await supabase
        .from('rooms')
        .update({ is_active: false })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`회의실 비활성화 실패: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Deactivate room error:', error);
      throw error;
    }
  }

  async activateRoom(id: string): Promise<Room> {
    // Admin only function
    if (!authService.isAdmin()) {
      throw new Error('관리자 권한이 필요합니다');
    }

    try {
      const { data, error } = await supabase
        .from('rooms')
        .update({ is_active: true })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`회의실 활성화 실패: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Activate room error:', error);
      throw error;
    }
  }

  async getRoomAvailability(
    roomId: string,
    startDate: string,
    endDate: string
  ): Promise<{ available: boolean; conflictingReservations: any[] }> {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .eq('room_id', roomId)
      .eq('status', 'confirmed')
      .or(`start_time.lt.${endDate},end_time.gt.${startDate}`);

    if (error) {
      throw new Error(`회의실 가용성 확인 실패: ${error.message}`);
    }

    return {
      available: data.length === 0,
      conflictingReservations: data,
    };
  }

  // Get room amenities as a typed object
  getRoomAmenities(room: Room): RoomAmenities {
    return (room.amenities as RoomAmenities) || {};
  }

  // Update room amenities
  async updateRoomAmenities(id: string, amenities: RoomAmenities): Promise<Room> {
    // Admin only function
    if (!authService.isAdmin()) {
      throw new Error('관리자 권한이 필요합니다');
    }

    try {
      const { data, error } = await supabase
        .from('rooms')
        .update({ amenities })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`회의실 편의시설 수정 실패: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Update room amenities error:', error);
      throw error;
    }
  }

  // Search rooms by name or location
  async searchRooms(query: string): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,location.ilike.%${query}%`)
      .order('name');

    if (error) {
      throw new Error(`회의실 검색 실패: ${error.message}`);
    }

    return data;
  }

  // Get rooms by capacity
  async getRoomsByCapacity(minCapacity: number): Promise<Room[]> {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .gte('capacity', minCapacity)
      .order('capacity');

    if (error) {
      throw new Error(`수용인원별 회의실 조회 실패: ${error.message}`);
    }

    return data;
  }

  // Realtime subscription for rooms
  subscribeToRooms(callback: (payload: any) => void): () => void {
    const channel = supabase
      .channel('rooms')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'rooms' },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}

export const roomService = RoomService.getInstance(); 