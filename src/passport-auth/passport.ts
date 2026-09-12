import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as OpenIDConnectStrategy } from 'passport-openidconnect';
import bcrypt from 'bcrypt';
import { userRepository } from '../user/repositories/userRepository.js';

passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const user = await userRepository.findByEmail(email);
        
        if (!user || !user.passwordHash) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        
        if (!isPasswordValid) {
          return done(null, false, { message: 'Invalid email or password' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

import jwt from 'jsonwebtoken';

passport.use('zitadel', new OpenIDConnectStrategy({
  issuer: process.env.ZITADEL_ISSUER || 'https://your-instance.zitadel.cloud',
  authorizationURL: `${process.env.ZITADEL_ISSUER || 'https://your-instance.zitadel.cloud'}/oauth/v2/authorize`,
  tokenURL: `${process.env.ZITADEL_ISSUER || 'https://your-instance.zitadel.cloud'}/oauth/v2/token`,
  userInfoURL: `${process.env.ZITADEL_ISSUER || 'https://your-instance.zitadel.cloud'}/oidc/v1/userinfo`,
  clientID: process.env.ZITADEL_CLIENT_ID || 'your-client-id',
  clientSecret: process.env.ZITADEL_CLIENT_SECRET || 'your-client-secret',
  callbackURL: process.env.ZITADEL_CALLBACK_URL || 'http://localhost:3000/auth/callback',
  scope: ['openid', 'profile', 'email']
}, async (issuer: any, profile: any, context: any, idToken: any, accessToken: any, refreshToken: any, params: any, done: any) => {
  try {
    // 1. Decode the raw ID Token. Zitadel ALWAYS puts the email here.
    const decodedToken = (idToken ? jwt.decode(idToken) : {}) as any || {};

    // 2. Try to find the email in the decoded token, or fallback to the profile.
    const email = decodedToken.email || profile.emails?.[0]?.value || profile._json?.email || profile._json?.preferred_username;
    
    if (!email) {
      const debugInfo = JSON.stringify({
        decodedIdToken: decodedToken,
        profile: profile,
        rawIdTokenString: !!idToken
      });
      console.error("DEBUG INFO:", debugInfo);
      return done(new Error(`No email found in Zitadel profile. Make sure your Zitadel user has an email address. DEBUG PAYLOAD: ${debugInfo}`));
    }

    let user = await userRepository.findByEmail(email);
    
    if (!user) {
      // Fallback name from email if Zitadel didn't provide given_name
      const emailPrefix = email.split('@')[0];
      const defaultFirstName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);

      // Auto-register user from Zitadel
      user = await userRepository.create({
        email: email,
        firstName: decodedToken.given_name || profile.name?.givenName || profile.displayName || defaultFirstName,
        lastName: decodedToken.family_name || profile.name?.familyName || 'User',
        passwordHash: '' // No password needed for OIDC users
      });
    }
    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

// Setup serialization for express-session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await userRepository.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
