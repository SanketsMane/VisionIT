import bcrypt from 'bcryptjs';
import { env } from '@config/env';

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'very weak' | 'weak' | 'fair' | 'strong' | 'very strong';
  suggestions: string[];
}

export const assessPasswordStrength = (password: string): PasswordStrength => {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else suggestions.push('Use at least 8 characters');
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else suggestions.push('Mix uppercase and lowercase letters');
  if (/\d/.test(password)) score += 1;
  else suggestions.push('Add at least one number');
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else suggestions.push('Add a symbol for extra strength');

  const normalized = Math.min(4, score) as PasswordStrength['score'];
  const labels: PasswordStrength['label'][] = [
    'very weak',
    'weak',
    'fair',
    'strong',
    'very strong',
  ];

  return { score: normalized, label: labels[normalized], suggestions };
};
