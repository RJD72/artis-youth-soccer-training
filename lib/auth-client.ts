// This file sets up the browser-side authentication client.
// It gives the frontend a simple way to talk to the app's auth system.

"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
