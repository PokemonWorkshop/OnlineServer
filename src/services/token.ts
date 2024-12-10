import { readFile, writeFile } from 'fs/promises';
import { SERVER_SECRET } from '@config/pocketnet.json';
import { sign } from 'jsonwebtoken';

const TOKEN_KEY = 'TOKEN_Online';
const SECRET_KEY = SERVER_SECRET;

async function ensureToken(pathDir: string): Promise<void> {
  try {
    const envFileContent = await readFile(pathDir, 'utf-8');
    let tokenUpdated = false;

    if (!process.env[TOKEN_KEY]) {
      const token = sign({ server: 'PocketNet' }, SECRET_KEY);

      process.env[TOKEN_KEY] = token;

      tokenUpdated = true;

      let envContent = envFileContent;
      const tokenPattern = new RegExp(`^${TOKEN_KEY}=.*$`, 'm');

      if (tokenPattern.test(envFileContent)) {
        envContent = envFileContent.replace(
          tokenPattern,
          `${TOKEN_KEY}=${token}`
        );
      } else {
        envContent += `\n${TOKEN_KEY}=${token}`;
      }

      await writeFile(pathDir, envContent, 'utf8');
    }

    if (tokenUpdated) {
      console.warn(`
        =======================================================================
        ⚠️  Important Notice: A new authentication token has been generated. ⚠️
      
        For the API to function properly, please restart the server now.
      
        The new token can be found in the .env file located at the root of 
        the server. This token is required for making requests to the API.
      
        Failure to restart the server will prevent the processing of all API 
        requests.
      
        Thank you for your prompt attention to this matter.
        =======================================================================
      `);

      process.exit(1);
    }
  } catch (error) {
    console.error(`Failed to ensure ${TOKEN_KEY}: ${error}`);
  }
}

export { ensureToken };
