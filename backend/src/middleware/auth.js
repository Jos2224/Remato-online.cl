import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized } from '../lib/api-error.js';

function readBearerToken(request) {
  const authorization = request.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice(7).trim();
}

function decodeToken(token) {
  const payload = jwt.verify(token, config.jwtSecret);
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
  };
}

export function requireAuth(request, _response, next) {
  const token = readBearerToken(request);
  if (!token) return next(unauthorized());

  try {
    request.user = decodeToken(token);
    return next();
  } catch {
    return next(unauthorized('La sesión es inválida o expiró.'));
  }
}

export function optionalAuth(request, _response, next) {
  const token = readBearerToken(request);
  if (!token) return next();

  try {
    request.user = decodeToken(token);
  } catch {
    request.user = undefined;
  }
  return next();
}

export function signAccessToken(user) {
  return jwt.sign(
    { email: user.email, role: user.role },
    config.jwtSecret,
    { subject: user.id, expiresIn: config.jwtExpiresIn },
  );
}
