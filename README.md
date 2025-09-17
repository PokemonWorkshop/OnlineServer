# PSDK-Online

## Description

**PSDK-Online** is a multiplayer server dedicated to the PSDK project, where players can send friend requests, participate in real-time battles, trade creatures, and discover surprise gifts. Using WebSockets and MongoDB, PSDK-Online offers a dynamic and interactive environment that allows players to connect.

## Features

- **Real-Time Communication**: Uses WebSockets for real-time, bidirectional communication between clients and the server.
- **Player Management**: Allows for adding friends, engaging in real-time battles, trading creatures, and discovering surprise gifts.
- **Dynamic and Interactive Environment**: Provides an engaging and interactive experience with features such as real-time notifications and updates.
- **Modular Architecture**: Built with a modular architecture, including controllers and handlers to manage different aspects of the game.

## Running the server (using Docker)

### Prerequisite

Make sure you have Docker installed. Also, on Windows and MacOS, launching Docker Desktop is a mandatory step.

### Configuration

**Create a `.env` file**: In the project root, copy or rename the file `example.env` to `.env`. Then, make sure you modify these values:

- DB_NAME : the name of your database inside MongoDB. A good name could be `nameofproject_online`.
- DB_PORT : defaulted to 27017, in the context of **this** Docker this does not need to be changed. Change it if your MongoDB isn't managed by this Docker.
- DB_HOST : in the case of **this** Docker without any change, the only valid input is `mongodb`. Change this to the URL or IP address if your MongoDB instance isn't managed by this Docker.
- DB_USER : the username used by the server to connect to the database. This user can only access `DB_NAME`.
- DB_PSWD : the password user by the server to connect to the database. Make sure to input a strong enough password. See [Strong Password Generator](https://bitwarden.com/password-generator/#password-generator) to generate a strong password.
- MONGO_INITDB_ROOT_USERNAME : the username of the root user of the database. This is your own access point as a server administrator, never share this with anyone.
- MONGO_INITDB_ROOT_PASSWORD : the password of the root user of the database. Again, input a VERY strong password. Seriously.

### Launch the Docker

After making sure you correctly modified your .env file, open a terminal at the root of this repository, then type `docker compose up -d` to launch the containers in the background. If everything goes well, 3 green lines should be displayed at some point => the server successfully connecter to the database.

### Get the SERVER_TOKEN

As the server service is containerized, this means the TOKEN_SERVER (which is used to connect to the server) is only available as part of the container. There is two ways to access the container:

- On Windows and Mac, using Docker Desktop: open the Container tab, click on the running container, then on the server container. Click on the Exec tab, then in the console, type `cat .env`. You can now copy the content of the TOKEN_SERVER env.
- On any OS with a CLI: open a terminal at the root of the repository. Type `docker exec -it psdk_online_server-online-1 sh -c "cat .env"`. If you're getting a `Error response from daemon: No such container`, type `docker ps` to check the `NAMES` part of the online container, use that instead of `psdk_online_server-online-1` in the earlier command. If the command succeeds, you'll have the result in the console directly, you can now copy the TOKEN_SERVICE.

### Shut the server down

To shut down the server and the database, you only need to type `docker compose down` in the terminal.

## Running the server locally (no Docker)

### Install Dependencies

Ensure you are in the project directory, then run:

```bash
npm install
```

### Install MongoDB

1. **Download and Install MongoDB**: Go to the [MongoDB download page](https://www.mongodb.com/try/download/community) and download the appropriate version for your operating system.

2. **Follow the Installation Instructions**: Follow the installation instructions provided for your operating system. You can find detailed installation guides on the [MongoDB Documentation](https://docs.mongodb.com/manual/installation/).

3. **Start MongoDB**: After installation, start the MongoDB server. You can usually do this by running:

Ensure MongoDB is running before starting the application.

### Configuration

1. **Modify a `.env File`**: In the project root, rename the file example.env to .env and add the following variables:

   ```
   # Database configuration
   DB_NAME=PocketNet
   DB_HOST=localhost
   DB_PORT=27017
   DB_USER=
   DB_PSWD=
   ```

2. **Set Up Environment Variables**: Make sure to replace the placeholder values with your actual configuration as needed.

### Usage

To start the application, run:

```bash
npm start
```

Modify the `SERVER_PORT` variable in your `.env` file to specify the port on which the server will be available. By default, it starts on port `8080`.

---

### 📚 Generate Documentation

To install and generate project documentation with TypeDoc, use:

```bash
npm run install:doc
npm run generate:doc
```

This will generate documentation output into the `docs/` folder, based on your TypeScript source files.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
