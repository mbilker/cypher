// Error class to not print a stack trace
// Useful for stopping a Promise chain
class FlowError extends Error {
  name = 'FlowError';

  constructor(message, display = false) {
    super(message);
    Error.captureStackTrace(this, arguments.callee);

    this.message = message;
    this.display = display;

    this.title = this.message;
  }
}

export default FlowError;
