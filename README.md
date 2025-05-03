# PSDK-Online Client Setup

## 📦 Server Installation

1. **Clone the Repository**  
   Clone or download the `v2` branch of the GitHub repository:  
   👉 [PokemonWorkshop/OnlineServer at v2](https://github.com/PokemonWorkshop/OnlineServer/tree/v2)

2. **Configure the `.env` File**  
   Update your database connection details:
   - `DB_NAME`
   - `DB_HOST`
   - `DB_PORT`
   - `DB_USER`
   - `DB_PSWD`

   **⚠️ IMPORTANT:**  
   - `SECRET_KEY` and `TOKEN_SERVER` must be empty on the first launch.  
   - `SECRET_KEY_API` and `TOKEN_API` must also be empty.  
   - Set `MAX_LEVEL=200` default (100) according to your game configuration.

3. **Install Dependencies**

```bash
npm install
```

4. **First Server Launch**

```bash
npm start
```

This first launch will generate the necessary keys in the `.env` file.

5. **Second Server Launch**

```bash
npm start
```

If everything is correctly configured, you should see a message like:

```
[INFO] TIMESTAMP: Connected to the database "DB_NAME"
```

---

## 🖥️ Client Installation

1. **Get the Client Scripts**  
   Clone or download the client scripts from the repository:  
   👉 [PokemonWorkshop/OnlineClient](https://github.com/PokemonWorkshop/OnlineServer/tree/psdk_client)  
   Place them inside the `/scripts` folder of your PSDK project.

2. **Edit the Client Configuration File**  

In `scripts\800 OnlineV2\001 system\001 Client.rb`, modify the following lines:

- **Line 49**: Update the WebSocket URL if needed (e.g., for localhost)
  ```ruby
  url = "ws://localhost:8080"
  ```

- **Line 228**: Set the correct token
  ```ruby
  Authorization: TOKEN_SERVER
  ```

3. **Launch the Game with PSDK**  
   Use the following command to start the game in debug mode:

```bash
psdk debug
```

4. **Connect to the Server**  
   Start a new game or load an existing save file, then run this command in the in-game console:

```ruby
Online::WebSocketClient.connect(headers: ["Player-ID: #{$trainer.id}"])
```

If everything is working correctly, you should see output similar to:

```
#<Thread:0x14dd67a0 PATH_CLIENT_SCRIPT.rb:109 run>
```
