import createEventHandler from '@logic/createEventHandler';

/**
 * Handles error events by creating an event handler for the 'error' event.
 *
 * @param data - The data object containing error information.
 * @param data.error - The error object.
 * @param data.message - An optional message describing the error. Defaults to 'An error occurred.' if not provided.
 * @returns An object containing the error and the message.
 */
const errorHandler = createEventHandler('error', (data) => {
  const { error, message } = data;
  return {
    error,
    message: message || 'An error occurred.',
  };
});

export default errorHandler;
