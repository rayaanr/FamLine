import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { db } from "@/db";
import { ac, roles } from "@/lib/permissions";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "@/lib/email";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      void sendPasswordResetEmail(user.email, url);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      void sendVerificationEmail(user.email, url);
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
  },
  plugins: [
    admin({
      ac,
      roles,
      defaultRole: "user",
      adminRoles: ["super_admin"],
    }),
  ],
});
