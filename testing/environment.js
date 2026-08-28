const location = {
  protocol: 'http:',
  hostname: 'localhost',
  host: 'localhost',
  port: '',
  href: 'http://localhost/',
};

global.location = location;
global.window = global.window || global;
global.window.location = location;
global.document = global.document || { URL: 'http://localhost/' };

// Unit tests do not run against Metro, so opening a Fast Refresh WebSocket
// would only leak a handle beyond Jest teardown (especially on Node 24+).
jest.mock('expo/src/async-require/setupHMR', () => ({}));
jest.mock('expo/src/async-require/setupFastRefresh', () => ({}));
