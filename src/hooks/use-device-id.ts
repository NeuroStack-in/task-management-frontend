"use client";

import { useEffect, useState } from "react";
import { getDeviceId } from "@/lib/device";

/**
 * This browser's stable device id, resolved on the client. Empty during SSR and the first paint
 * (localStorage isn't available server-side — see `lib/device.ts`), then filled in an effect. Used to
 * flag the "This device" row in the sessions list.
 */
export function useDeviceId(): string {
  const [id, setId] = useState("");
  useEffect(() => setId(getDeviceId()), []);
  return id;
}
