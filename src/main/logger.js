const log = require('electron-log');

// Configure logger with simple settings
log.transports.file.level = 'info';
log.transports.console.level = 'info';
log.transports.file.encoding = 'utf8';

// Simple formatting
log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';

// Export logger
module.exports = log;