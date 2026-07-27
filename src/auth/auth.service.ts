import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Hardcoded credentials for local development.
// In production, this would use OAuth2 / Keycloak / a real user store.
const USERS = [
  { username: 'admin', password: 'admin', role: 'admin' },
  { username: 'operator', password: 'operator', role: 'operator' },
] as const;

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(
    username: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const user = USERS.find(
      (u) => u.username === username && u.password === password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.username, role: user.role };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
