# PSDK-Online Client Setup

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
