// This file connects the app's authentication system to Next.js API routes.
// It lets Better Auth handle all auth requests that come into this endpoint.

import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
