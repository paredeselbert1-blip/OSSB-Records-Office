const { getUserByToken } = require('./store');

function getTokenFromRequest(req) {
  const auth = String(req.headers.get('authorization') || '');
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }

  try {
    return String(req.cookies?.get('transmittal_token')?.value || '').trim();
  } catch {
    return '';
  }
}

function getAuthUser(req) {
  const token = getTokenFromRequest(req);
  if (!token) return { error: 'Authentication required', status: 401 };

  const user = getUserByToken(token);
  if (!user) return { error: 'Authentication required', status: 401 };
  return { user };
}

module.exports = {
  getAuthUser,
  getTokenFromRequest
};
