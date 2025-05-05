const log = require('electron-log');

// Configure main logger with simple settings
log.transports.file.level = 'info';
log.transports.console.level = 'info';
log.transports.file.encoding = 'utf8';

// Simple formatting for regular application logs (no special prefix)
log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}';

// Create AI logger that writes to a separate file named 'ai.log'
const aiLog = require('electron-log');
// Configure AI logger to write to a separate file
aiLog.transports.file.resolvePath = () => 'ai.log'; // Specify the file name for AI logs
aiLog.transports.file.level = 'info';
aiLog.transports.console.level = 'info';

// Special formatting with AI identifier only for Gemini-related logs
aiLog.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}] [AI] [{level}] {text}';
aiLog.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [AI] [{level}] {text}';

// Export loggers
module.exports = {
  main: log,
  ai: aiLog
};