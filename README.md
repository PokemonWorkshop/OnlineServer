
# PSDK-Online

## Description

**PSDK-Online** is a multiplayer server dedicated to the PSDK project, where players can send friend requests, participate in real-time battles, trade creatures, and discover surprise gifts. Using WebSockets and MongoDB, PSDK-Online offers a dynamic and interactive environment that allows players to connect.

## Features

- **Real-Time Communication**: Uses WebSockets for real-time, bidirectional communication between clients and the server.
- **Player Management**: Allows for adding friends, engaging in real-time battles, trading creatures, and discovering surprise gifts.
- **Dynamic and Interactive Environment**: Provides an engaging and interactive experience with features such as real-time notifications and updates.
- **Modular Architecture**: Built with a modular architecture, including controllers and handlers to manage different aspects of the game.

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

## Usage

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

### 📚 Overall Documentation

[Les requetes socket](/docs/socket.md)

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
