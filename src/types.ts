import { IncomingMessage, ServerResponse } from 'http';
import { WebSocket } from 'ws';

/**
 * Represents a generic event data object where keys are strings and values can be of any type.
 *
 * @interface EventData
 * @property {unknown} [key: string] - A property of the event data object with a string key and a value of any type.
 */
export interface EventData {
  [key: string]: unknown;
}

/**
 * Represents a response from an event handler.
 *
 * This interface allows for dynamic properties where the key is a string
 * and the value can be of any type.
 *
 * @interface EventResponse
 * @property {unknown} [key: string] - A property of the event response with a string key and a value of any type.
 */
export interface EventResponse {
  [key: string]: unknown;
}

/**
 * Type definition for an event handler function.
 *
 * @param data - The event data to be processed by the handler.
 * @param ws - The WebSocket instance associated with the event.
 */
export type EventHandler = (data: EventData, ws: WebSocket) => Promise<void>;

/**
 * A dictionary of event handlers where the key is the event name and the value is the corresponding event handler.
 *
 * @interface EventHandlers
 * @property {EventHandler} [event] - The event handler for the specified event.
 */
export interface EventHandlers {
  [event: string]: EventHandler;
}

/**
 * Represents a handler function for processing HTTP requests.
 *
 * @typedef RequestHandler
 * @param req - The incoming HTTP request object.
 * @param res - The outgoing HTTP response object.
 * @returns A promise that resolves to void or void directly.
 */
export type RequestHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<void> | void;

/**
 * Represents a mapping of HTTP methods to their respective route handlers.
 *
 * Each HTTP method (e.g., "GET", "POST") is associated with an object that maps
 * route paths (e.g., "/users", "/products/:id") to their corresponding request handlers.
 *
 * @typeParam method - The HTTP method as a string (e.g., "GET", "POST").
 * @typeParam path - The route path as a string (e.g., "/users", "/products/:id").
 * @typeParam RequestHandler - The type of the function that handles the request for a given route.
 */
export type RouteMap = {
  [method: string]: {
    [path: string]: RequestHandler;
  };
};

/**
 * Represents latency data for a server or connection.
 *
 * @property lastPing - The timestamp of the last ping in milliseconds since the Unix epoch.
 * @property latency - The measured latency in milliseconds.
 */
export type LatencyData = {
  lastPing: number;
  latency: number;
};

/**
 * Represents a middleware function used in an HTTP server.
 *
 * @typedef Middleware
 * @param req - The incoming HTTP request object.
 * @param res - The outgoing HTTP response object.
 * @param next - A function to invoke the next middleware in the chain.
 *               Returns a promise that resolves when the next middleware completes.
 * @returns A promise that resolves when the middleware completes, or void if no asynchronous operations are performed.
 */
export type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => Promise<void>
) => Promise<void> | void;
