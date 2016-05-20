/**
 * Error class that conditionally prints out the name to MessageLoaderHeader.
 * Useful for stopping a promise chain only on a fatal error and not a minor
 * error.
 */
class FlowError extends Error {
  name = 'FlowError';

  /**
   * @param{string} message - title message for the error
   * @param{boolean} display - conditionally display the error in MessageLoaderHeader
   * @constructor
   */
  constructor(message, display = false) {
    super(message);
    Error.captureStackTrace(this, this.constructor);

    this.message = message;
    this.display = display;

    this.title = this.message;
  }
}

export default FlowError;
