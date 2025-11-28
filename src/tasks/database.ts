import { connect, connection } from 'mongoose';

/**
 * Establishes a connection to the MongoDB database using environment variables for configuration.
 *
 * @async
 * @function database_connection
 * @returns {Promise<void>} A promise that resolves when the connection is successfully established.
 * @throws Will throw an error if the connection to the database fails.
 *
 * @example
 * // Ensure the following environment variables are set:
 * // process.env.DB_NAME - The name of the database.
 * // process.env.DB_HOST - The host address of the database.
 * // process.env.DB_PORT - The port number of the database.
 * // process.env.DB_USER - The username for database authentication.
 * // process.env.DB_PSWD - The password for database authentication.
 *
 * database_connection()
 *   .then(() => console.log('Database connection established'))
 *   .catch((error) => console.error('Database connection failed', error));
 */
const database_connection = async () => {
  const { DB_NAME, DB_HOST, DB_PORT, DB_USER, DB_PSWD } = process.env;

  if (!DB_NAME || !DB_HOST || !DB_PORT) {
    throw new Error('Missing one or more required DB environment variables');
  }

  const uri = `mongodb://${DB_HOST}:${DB_PORT}`;

  if (connection.readyState === 1) {
    console.info('Already connected to the database');
    return;
  }

  try {
    await connect(uri, {
      dbName: DB_NAME,
      auth: {
        username: DB_USER,
        password: DB_PSWD,
      },
      authSource: DB_NAME,
      retryWrites: true,
      w: 'majority',
      connectTimeoutMS: 10000,
    });
    console.info(`Connected to the database "${DB_NAME}"`);
  } catch (error) {
    console.error('Failed to connect to the database:', error);
  }

  connection.on('error', (err) =>
    console.error('Mongoose connection error:', err)
  );
};

/**
 * Closes the database connection.
 *
 * This function attempts to close the active database connection.
 * If the connection is closed successfully, a success message is logged to the console.
 * If an error occurs while closing the connection, an error message is logged to the console.
 *
 * @async
 * @function database_close
 * @returns {Promise<void>} A promise that resolves when the connection is closed.
 */
const database_close = async () => {
  try {
    await connection.close();
    console.info('Database connection closed successfully');
  } catch (error) {
    console.error('Failed to close the database connection:', error);
  }
};

export { database_connection, database_close };
