export interface Room {
  id: number;
  room_number: number;
  title: string | null;
  tutor: string | null;
  initial_time: number | null;
  remaining_time: number | null;
  participants: string[];
  password?: string;
  is_active: boolean;
  creator_socket_id: string | null;
  speaking_order: string[];
  timer_running: boolean;
}

export interface RoomSyncData {
  remaining_time?: number;
  timer_running?: boolean;
  speaking_order?: string[];
}
