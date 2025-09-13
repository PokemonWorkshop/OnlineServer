import { readFile, writeFile } from 'fs/promises';
import { sign } from 'jsonwebtoken';
import { randomBytes } from 'crypto';

const TOKEN_SERVER_KEY = 'TOKEN_SERVER';
const TOKEN_API_KEY = 'TOKEN_API';
const SECRET_KEY_SERVER = process.env.SECRET_KEY || generateRandomKey();
const SECRET_KEY_API = process.env.SECRET_KEY_API || generateRandomKey();

/**
 * Generates a random 256-bit key in hexadecimal format.
 * @returns {string} - A random 256-bit hexadecimal key.
 */
function generateRandomKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Ensures that the necessary authentication tokens are present in the environment variables
 * and updates the specified .env file with new tokens if they are missing.
 *
 * @param {string} pathDir - The path to the .env file.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 *
 * @throws Will log an error message if the operation fails.
 *
 * @remarks
 * This function performs the following steps:
 * 1. Reads the content of the .env file.
 * 2. Checks if the server token is present in the environment variables. If not, generates a new token,
 *    updates the environment variables, and writes the new token to the .env file.
 * 3. Checks if the API token is present in the environment variables. If not, generates a new token,
 *    updates the environment variables, and writes the new token to the .env file.
 * 4. If any tokens were updated, logs a warning message and exits the process to prompt a server restart.
 *
 * @example
 * ```typescript
 * await ensureToken('/path/to/.env');
 * ```
 */
async function ensureToken(pathDir: string): Promise<void> {
  try {
    const envFileContent = await readFile(pathDir, 'utf-8');
    let tokenUpdated = false;
    let updatedEnvContent = envFileContent;

    // Generate and update SECRET_KEY if missing
    if (!process.env[TOKEN_SERVER_KEY] && SECRET_KEY_SERVER) {
      const tokenServer = sign({ server: 'PSDK_ONLINE_V2' }, SECRET_KEY_SERVER);
      process.env[TOKEN_SERVER_KEY] = tokenServer;
      tokenUpdated = true;

      const tokenPatternServer = new RegExp(`^${TOKEN_SERVER_KEY}=.*$`, 'm');
      if (tokenPatternServer.test(envFileContent)) {
        updatedEnvContent = updatedEnvContent.replace(
          tokenPatternServer,
          `${TOKEN_SERVER_KEY}=${tokenServer}`
        );
      } else {
        updatedEnvContent += `\n${TOKEN_SERVER_KEY}=${tokenServer}`;
      }

      // Update the SECRET_KEY line, or add if it doesn't exist
      const secretKeyPattern = /^SECRET_KEY=.*/m;
      if (secretKeyPattern.test(updatedEnvContent)) {
        updatedEnvContent = updatedEnvContent.replace(
          secretKeyPattern,
          `SECRET_KEY=${SECRET_KEY_SERVER}`
        );
      } else {
        updatedEnvContent += `\nSECRET_KEY=${SECRET_KEY_SERVER}`;
      }
    }

    // Generate and update SECRET_KEY_API if missing
    if (!process.env[TOKEN_API_KEY] && SECRET_KEY_API) {
      const tokenApi = sign({ api: 'PSDK_ONLINE_V2' }, SECRET_KEY_API);
      process.env[TOKEN_API_KEY] = tokenApi;
      tokenUpdated = true;

      const tokenPatternApi = new RegExp(`^${TOKEN_API_KEY}=.*$`, 'm');
      if (tokenPatternApi.test(updatedEnvContent)) {
        updatedEnvContent = updatedEnvContent.replace(
          tokenPatternApi,
          `${TOKEN_API_KEY}=${tokenApi}`
        );
      } else {
        updatedEnvContent += `\n${TOKEN_API_KEY}=${tokenApi}`;
      }

      // Update the SECRET_KEY_API line, or add if it doesn't exist
      const secretKeyApiPattern = /^SECRET_KEY_API=.*/m;
      if (secretKeyApiPattern.test(updatedEnvContent)) {
        updatedEnvContent = updatedEnvContent.replace(
          secretKeyApiPattern,
          `SECRET_KEY_API=${SECRET_KEY_API}`
        );
      } else {
        updatedEnvContent += `\nSECRET_KEY_API=${SECRET_KEY_API}`;
      }
    }

    // Write the updated content to the .env file
    if (tokenUpdated) {
      await writeFile(pathDir, updatedEnvContent, 'utf8');

      // Notify about the update
      console.warn(`
        =======================================================================
        ⚠️  Important Notice: New authentication tokens have been generated. ⚠️

        - The API token is used for handling HTTP requests.
        - The Server token is used for managing WebSocket connections for the game client.

        For the API and server to function properly, please restart the server now.

        The new tokens can be found in the .env file located at the root of 
        the server. These tokens are required for making requests.

        Failure to restart the server will prevent the processing of API 
        requests and WebSocket connections.

        Thank you for your prompt attention to this matter.
        =======================================================================
      `);

      process.exit(1);
    }
  } catch (error) {
    console.error(`Failed to ensure tokens: ${error}`);
  }
}

export { ensureToken };
