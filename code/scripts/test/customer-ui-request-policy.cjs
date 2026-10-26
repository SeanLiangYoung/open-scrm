'use strict';
function forbiddenMessagingDependency(request) {
  const pathname = new URL(request.path, 'http://127.0.0.1').pathname;
  const messaging = pathname.startsWith('/api/message') || pathname.startsWith('/api/notification') || pathname.startsWith('/api/v1/messages');
  if (!messaging) return false;
  return !(request.method === 'GET' && /^\/api\/v1\/messages\/consents\/customer\/[1-9]\d*$/.test(pathname));
}
module.exports = { forbiddenMessagingDependency };
