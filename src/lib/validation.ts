import { z } from "zod";

/**
 * Strong password validation schema used across the application.
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const passwordSchema = z.string()
  .min(8, "Senha deve ter no mínimo 8 caracteres")
  .max(72, "Senha deve ter no máximo 72 caracteres")
  .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
  .regex(/[a-z]/, "Senha deve conter pelo menos uma letra minúscula")
  .regex(/[0-9]/, "Senha deve conter pelo menos um número")
  .regex(/[^A-Za-z0-9]/, "Senha deve conter pelo menos um caractere especial");

/**
 * Helper to get password requirements as display text
 */
export const PASSWORD_REQUIREMENTS = "Mínimo 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial";
