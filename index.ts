import { configDotenv } from 'dotenv';
configDotenv();
import { author, version, name } from '@root/package.json';
import { SERVER_HOST, SERVER_PORT, SOCKET_PORT } from '@config/pocketnet.json';
import { connect } from 'mongoose';
import { resolve } from 'path';

import KoaServer from '@api/KoaServer';
import SocketServer, { SocketServerOptions } from './src/ws/SocketServer';
import TaskScheduler from './src/utils/TaskScheduler';
import { ensureToken } from '@src/services/token';

displayProjectTitle(name, version, author);

import './src/utils/Logger';

async function initializeApplication(): Promise<void> {
  try {
    await ensureToken(resolve('./.env'));
    await initializeDatabaseConnection();
    await initializeServer();
    new TaskScheduler();
  } catch (error) {
    handleError('Error initializing application', error);
  }
}

async function initializeDatabaseConnection(): Promise<void> {
  const { DB_NAME, DB_HOST, DB_PORT, DB_USER, DB_PSWD } = process.env;
  const mongoUri = `mongodb://${DB_HOST}:${DB_PORT}`;

  try {
    await connect(mongoUri, {
      dbName: DB_NAME,
      auth: {
        username: DB_USER,
        password: DB_PSWD,
      },
    });
    console.log('Connected to MongoDB');
  } catch (error) {
    handleError('Failed to connect to MongoDB', error);
    throw error;
  }
}

async function initializeServer(): Promise<void> {
  try {
    await KoaServer.init({
      port: SERVER_PORT,
      host: SERVER_HOST,
      routes: await KoaServer.defaultRoutes(),
    });

    const socketOptions: SocketServerOptions = {
      port: SOCKET_PORT,
      host: SERVER_HOST,
    };
    new SocketServer(socketOptions);
  } catch (error) {
    handleError('Failed to initialize server', error);
  }
}

function displayProjectTitle(
  name: string,
  version: string,
  author: string
): void {
  console.log(
    `
    ██████╗       ██████╗  ██████╗  ██████╗██╗  ██╗███████╗████████╗
   ██╔═══██╗      ██╔══██╗██╔═══██╗██╔════╝██║ ██╔╝██╔════╝╚══██╔══╝
   ██║   ██║█████╗██████╔╝██║   ██║██║     █████╔╝ █████╗     ██║   
   ██║   ██║╚════╝██╔═══╝ ██║   ██║██║     ██╔═██╗ ██╔══╝     ██║   
   ╚██████╔╝      ██║     ╚██████╔╝╚██████╗██║  ██╗███████╗   ██║   
    ╚═════╝       ╚═╝      ╚═════╝  ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝                                                                               
    PROJECT: \x1b[36m${name}\x1b[0m
    VERSION: \x1b[36m${version}\x1b[0m
    AUTHOR : \x1b[36m${author}\x1b[0m
    `
  );
}

function handleError(context: string, error: unknown): void {
  console.error(`${context}:`, error);
}

initializeApplication();
