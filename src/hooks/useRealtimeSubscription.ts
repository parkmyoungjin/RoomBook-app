"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

/**
 * Subscribes to real-time updates for reservations.
 * Includes automatic polling fallback when WebSocket connection fails.
 */
export function useRealtimeSubscription() {
  const queryClient = useQueryClient();
  const isConnectedRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    const channel = supabase
      .channel("reservations_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations" },
        (payload) => {
          console.log("Realtime event received:", payload);
          queryClient.invalidateQueries({ queryKey: ["reservations"] });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log("Realtime channel subscribed.");
          isConnectedRef.current = true;
          // Stop polling when realtime is connected
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
        if (status === 'CHANNEL_ERROR') {
          console.error("Realtime channel error:", err);
          isConnectedRef.current = false;
          // Start polling fallback
          startPollingFallback();
        }
        if (status === 'CLOSED') {
          console.log("Realtime channel closed.");
          isConnectedRef.current = false;
          // Start polling fallback
          startPollingFallback();
        }
      });

    // Function to start polling fallback
    const startPollingFallback = () => {
      if (pollingIntervalRef.current) return; // Already polling
      
      console.log("Starting polling fallback...");
      pollingIntervalRef.current = setInterval(() => {
        if (!isConnectedRef.current) {
          console.log("Polling for reservation updates...");
          queryClient.invalidateQueries({ queryKey: ["reservations"] });
        }
      }, 30000); // 30초 간격으로 폴링 (더 긴 간격으로 조정)
    };

    // Start polling fallback after 5 seconds if not connected
    const fallbackTimer = setTimeout(() => {
      if (!isConnectedRef.current) {
        startPollingFallback();
      }
    }, 5000);

    return () => {
      clearTimeout(fallbackTimer);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      supabase.removeChannel(channel);
      isConnectedRef.current = false;
    };
  }, [queryClient]);
}

/**
 * @deprecated Use useRealtimeSubscription() instead which includes automatic polling fallback
 */
export function usePollingFallback(interval: number) {
  console.warn("usePollingFallback is deprecated. Use useRealtimeSubscription() instead.");
}
