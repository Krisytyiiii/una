import { z } from "zod";

/** Shared auth validation — imported by web + mobile forms, never redefined per-app. */
export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerStudentSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(120),
  email: z.string().email("Enter a valid university email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
      "Use upper and lower case letters and a number",
    ),
  studentNo: z
    .string()
    .trim()
    // DOrSU student numbers are year-prefixed: 20YY-XXXX (e.g. 2021-0001).
    .regex(/^20\d{2}-\d{4}$/, "Use the format 20YY-XXXX (e.g. 2021-0001)"),
  program: z.string().min(2, "Program is required").max(120),
  yearLevel: z.string().min(1, "Year level is required").max(32),
  /**
   * Optional demographic fields (00079). The official referral form asks for
   * gender + age; filling them once at signup lets the referral form autofill
   * instead of making faculty retype them. Blank = not provided.
   */
  gender: z.enum(["male", "female", "prefer_not_to_say"]).optional(),
  birthdate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD for the birthdate")
    // Round-trip through UTC so impossible dates (Feb 30, Apr 31) are rejected
    // instead of silently rolling over into the next month.
    .refine((value) => {
      const [year, month, day] = value.split("-").map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      );
    }, "That date doesn't exist — check the month and day")
    // Student records start at the 2000 cohort.
    .refine((value) => Number(value.slice(0, 4)) >= 2000, "Birth year must be 2000 or later")
    .refine(
      (value) => new Date(`${value}T00:00:00Z`).getTime() <= Date.now(),
      "Birthdate can't be in the future",
    )
    .optional(),
});
export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;

export const registerStaffSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, "Include upper and lower case letters and a number"),
  role: z.enum(["counselor", "faculty", "guidance_head"]),
  employeeNo: z.string().max(32).optional(),
  department: z.string().max(120).optional(),
  specialization: z.string().max(120).optional(),
});
export type RegisterStaffInput = z.infer<typeof registerStaffSchema>;

/**
 * Public self-signup (email or Google). Only the credentials are collected up
 * front — the role is chosen on /register/role afterwards, and staff complete
 * their details once a guidance head approves the account.
 */
export const selfSignupSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
      "Use upper and lower case letters and a number",
    ),
});
export type SelfSignupInput = z.infer<typeof selfSignupSchema>;

/**
 * Roles a first-time web user may choose for themselves. The staff portal is
 * for counselors and faculty only; students register in the mobile app.
 */
export const oauthProfileSchema = z.object({
  role: z.enum(["faculty", "counselor"], {
    errorMap: () => ({ message: "Choose faculty or guidance counselor." }),
  }),
});
export type OAuthProfileInput = z.infer<typeof oauthProfileSchema>;

/**
 * Details a self-registered counselor/faculty fills in after the guidance head
 * approves them. Students use the mobile profile instead.
 */
export const completeStaffProfileSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(120),
  employeeNo: z
    .string()
    .max(32)
    .regex(/^[A-Za-z0-9-]*$/, "Letters, numbers and dashes only")
    .optional()
    .or(z.literal("")),
  department: z.string().max(120).optional().or(z.literal("")),
  specialization: z.string().max(120).optional().or(z.literal("")),
});
export type CompleteStaffProfileInput = z.infer<typeof completeStaffProfileSchema>;

export const resetPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const updatePasswordSchema = z
  .object({
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
