// server/middleware/validate.js
import { z } from 'zod';

/**
 * Express middleware для валидации payload
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body'|'query'|'params'} [source='body']
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message
      }));
      return res.status(400).json({
        error: issues[0]?.message || 'Ошибка валидации данных',
        details: issues
      });
    }
    req[source] = result.data;
    next();
  };
}

// Схемы, используемые в server/routes/auth.js
export const RegisterSchema = z.object({
  name: z.string().trim().min(2, 'Имя должно содержать от 2 символов').max(24, 'Имя не должно превышать 24 символов').optional(),
  phone: z.string().trim().min(10, 'Укажите корректный номер телефона'),
  pin: z.string().regex(/^\d{4}$/, 'PIN-код должен состоять ровно из 4 цифр').optional(),
  code: z.string().optional(),
  consent: z.union([z.literal(0), z.literal(1), z.boolean()]).optional()
}).passthrough();

export const LoginSchema = z.object({
  phone: z.string().trim().min(10, 'Укажите номер телефона'),
  pin: z.string().regex(/^\d{4}$/, 'PIN-код должен состоять из 4 цифр').optional(),
  otp: z.string().optional()
}).passthrough();

export const SetupPinSchema = z.object({
  phone: z.string().trim().optional(),
  pin: z.string().regex(/^\d{4}$/, 'PIN — ровно 4 цифры')
}).passthrough();

export const ActivateCodeSchema = z.object({
  code: z.string().trim().min(1, 'Введите код активации')
}).passthrough();
