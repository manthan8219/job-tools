import jwt from 'jsonwebtoken';
import passport from './passport.js';
import { AppError } from '../utils/index.js';
import { userRepository } from '../user/repositories/userRepository.js';
import { User } from '../user/models/user.js';
import { LoginInput } from '../auth/models/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-prod';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';

const JWT_ACCESS_EXPIRES_IN = '15m'; // Access token validity
const JWT_REFRESH_EXPIRES_IN = '7d'; // Refresh token validity

export interface PassportAuthPayload {
  accessToken: string;
  refreshToken: string;
  user: Omit<User, 'passwordHash'>;
}

export class PassportAuthService {
  /**
   * Manages user login using passport.js
   * Will throw an AppError (kill the process for the current request) if authentication fails
   */
  async login(data: LoginInput): Promise<PassportAuthPayload> {
    return new Promise((resolve, reject) => {
      // Mock Express Request object for Passport Local Strategy
      const req = { body: { email: data.email, password: data.password } } as any;
      const res = {} as any;
      const next = (err?: any) => {
        if (err) return reject(err);
      };

      passport.authenticate('local', { session: false }, (err: any, user: any, info: any) => {
        if (err) {
          return reject(err);
        }
        
        if (!user) {
          // "kill the thing if not okay"
          return reject(new AppError(info?.message || 'Authentication failed', 'UNAUTHORIZED', 401));
        }

        try {
          const accessToken = this.generateAccessToken(user.id);
          const refreshToken = this.generateRefreshToken(user.id);
          
          const { passwordHash: _, ...safeUser } = user;
          
          resolve({
            accessToken,
            refreshToken,
            user: safeUser as any
          });
        } catch (tokenErr) {
          reject(tokenErr);
        }
      })(req, res, next);
    });
  }

  /**
   * Manages user logout
   * Usually this entails invalidating the refresh token in the DB or Redis.
   * For now we return a success state.
   */
  async logout(userId: string): Promise<{ success: boolean }> {
    // Optionally: Revoke refresh token here in db/redis.
    return { success: true };
  }

  private generateAccessToken(userId: string): string {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES_IN });
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign({ userId, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
  }
}

export const passportAuthService = new PassportAuthService();
