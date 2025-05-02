import { EventData, EventHandler, EventResponse } from '@src/types';
import WebSocket from 'ws';
/**
 * Creates an event handler for a specified event name and handler logic.
 *
 * @param eventName - The name of the event to handle.
 * @param handlerLogic - A function that processes the event data and returns a response.
 * @returns An asynchronous event handler function that sends the response data via WebSocket.
 *
 * @example
 * ```typescript
 * const myEventHandler = createEventHandler('myEvent', (data) => {
 *   // Process the event data and return a response
 *   return { success: true, message: 'Event processed successfully' };
 * });
 *
 * // Use the event handler with a WebSocket
 * myEventHandler(eventData, webSocketInstance);
 * ```
 */
const createEventHandler = (
  eventName: string,
  handlerLogic: (
    data: EventData,
    ws: WebSocket
  ) => EventResponse | Promise<EventResponse>
): EventHandler => {
  return async (data: EventData, ws: WebSocket) => {
    try {
      const responseData = await handlerLogic(data, ws);

      ws.send(
        JSON.stringify({
          event: eventName,
          data: responseData,
        })
      );
    } catch (error) {
      console.error(`Failed to send message for event ${eventName}:`, error);
    }
  };
};

export default createEventHandler;
