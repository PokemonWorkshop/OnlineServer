/**
 * Fluent documentation builder — attach OpenAPI metadata directly to a route.
 *
 * Usage:
 * ```ts
 * import { doc } from '../doc';
 *
 * router.post('/api/v1/auth/register',
 *   doc('Register or re-login')
 *     .tags('Auth')
 *     .auth('apiKey')
 *     .desc(`
 *       **First login** → creates the player and returns a friendCode (HTTP 201).
 *       **Re-login**    → updates lastSeen, returns existing info (HTTP 200).
 *     `)
 *     .body('RegisterBody')
 *     .response(201, 'RegisterResponse', 'New player created.')
 *     .response(200, 'RegisterResponse', 'Player already existed.')
 *     .response(400, 'ValidationError')
 *     .response(401)
 *     .build(),
 *   async (req, res) => { ... }
 * );
 * ```
 */

// ─── Public types ─────────────────────────────────────────────────────────────

/** Authentication scheme for a route. */
export type AuthMode =
  | 'apiKey'    // x-api-key only (default)
  | 'playerKey' // x-api-key + x-player-id
  | 'adminKey'  // x-admin-key only
  | 'none';     // public, no key required

export interface ResponseMeta {
  status:      number;
  /** Schema name from `components.schemas`, or undefined for no body. */
  schema?:     string;
  description: string;
}

/** Finished metadata attached to a route. Consumed by swagger.ts. */
export interface RouteMeta {
  summary:      string;
  /** Markdown supported, trimmed at build time. */
  description?: string;
  tags:         string[];
  auth:         AuthMode;
  /** Schema name from `components.schemas` for the request body. */
  body?:        string;
  responses:    ResponseMeta[];
}

// ─── Builder ──────────────────────────────────────────────────────────────────

class DocBuilder {
  private readonly _meta: RouteMeta;

  constructor(summary: string) {
    this._meta = { summary, tags: [], auth: 'apiKey', responses: [] };
  }

  /**
   * Markdown description shown below the summary in Swagger UI.
   * Template literals with indentation are automatically trimmed.
   *
   * @example
   * ```ts
   * .desc(`
   *   **First login** → creates the player (HTTP 201).
   *   **Re-login**    → updates lastSeen (HTTP 200).
   * `)
   * ```
   */
  desc(text: string): this {
    // Dedent: strip leading/trailing blank lines and common indentation
    const lines = text.split('\n');
    const nonEmpty = lines.filter((l) => l.trim().length > 0);
    const indent   = nonEmpty.reduce((min, l) => {
      const match = l.match(/^(\s*)/);
      return Math.min(min, match ? match[1].length : 0);
    }, Infinity);
    this._meta.description = nonEmpty
      .map((l) => l.slice(indent === Infinity ? 0 : indent))
      .join('\n')
      .trim();
    return this;
  }

  /**
   * Tag names that group this route in the Swagger UI sidebar.
   * Pass multiple tags as separate arguments.
   *
   * @example `.tags('Auth')` or `.tags('Mystery Gift (Admin)')`
   */
  tags(...names: string[]): this {
    this._meta.tags.push(...names);
    return this;
  }

  /**
   * Authentication mode for this route.
   *
   * | Mode          | Headers required                  |
   * |---------------|-----------------------------------|
   * | `'apiKey'`    | `x-api-key` (default)             |
   * | `'playerKey'` | `x-api-key` + `x-player-id`      |
   * | `'adminKey'`  | `x-admin-key`                     |
   * | `'none'`      | none (public route)               |
   */
  auth(mode: AuthMode): this {
    this._meta.auth = mode;
    return this;
  }

  /**
   * Reference a request body schema from `components.schemas`.
   *
   * @param schemaName - Key in `components.schemas` (e.g. `'RegisterBody'`).
   */
  body(schemaName: string): this {
    this._meta.body = schemaName;
    return this;
  }

  /**
   * Document a response status code.
   *
   * - `schema`      optional — key in `components.schemas`
   * - `description` optional — falls back to a standard phrase for common codes
   *
   * @example
   * ```ts
   * .response(201, 'RegisterResponse', 'New player created.')
   * .response(400, 'ValidationError')   // description auto-filled
   * .response(401)                       // no body, description auto-filled
   * ```
   */
  response(status: number, schema?: string, description?: string): this {
    this._meta.responses.push({
      status,
      schema,
      description: description ?? defaultStatusDesc(status),
    });
    return this;
  }

  /**
   * Finalises the builder and returns the `RouteMeta` object.
   * Pass the result as the second argument to `router.get/post/delete()`.
   *
   * Auto-fills sensible default responses (200 + 401) if none were declared.
   */
  build(): RouteMeta {
    if (this._meta.responses.length === 0) {
      this._meta.responses.push({ status: 200, description: 'Success.' });
      this._meta.responses.push({ status: 401, description: 'Unauthorized.' });
      if (this._meta.auth === 'playerKey')
        this._meta.responses.push({ status: 400, description: 'Missing X-Player-Id header.' });
    }
    return { ...this._meta };
  }
}

// ─── Factory function ─────────────────────────────────────────────────────────

/**
 * Creates a documentation builder for a route.
 *
 * @param summary - One-line route title shown in Swagger UI.
 *
 * Chain `.tags()`, `.auth()`, `.desc()`, `.body()`, `.response()` then call
 * `.build()` to get the finished `RouteMeta`.
 */
export function doc(summary: string): DocBuilder {
  return new DocBuilder(summary);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function defaultStatusDesc(status: number): string {
  const phrases: Record<number, string> = {
    200: 'Success.',
    201: 'Created.',
    204: 'No content.',
    400: 'Bad request.',
    401: 'Unauthorized.',
    403: 'Forbidden.',
    404: 'Not found.',
    409: 'Conflict.',
    422: 'Unprocessable entity.',
    500: 'Internal server error.',
  };
  return phrases[status] ?? `HTTP ${status}.`;
}
