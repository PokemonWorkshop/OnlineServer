module Online
  class PlayerManager < BaseManager
    # Creates a new player entry by sending player data to the server
    #
    # This method gathers the player's information, including their ID, name,
    # gender, and character set base, and sends it to the server for player creation
    # If the server responds with success, the player's friend code is updated
    #
    # @return [Hash] The response from the server, containing success status and other data
    def create
      data = {
        id: $trainer.id.to_s,
        name: $trainer.name,
        is_girl: $trainer.playing_girl,
        charset_base: $game_player.charset_base
      }

      response = sync_socket('playerCreate', data)
      $trainer.friend_code = response['friend_code'] if response['success']

      return response
    end

    # Deletes the player data by synchronizing with the server
    # This method sends a 'playerDelete' command through the socket
    # to notify the server to remove the player's data
    def delete
      return emit_successfully?('playerDelete')
    end

    # Updates the player data by synchronizing it with the server
    #
    # @param data [Hash] The data to be updated. Must be a non-empty hash
    # @return [void] Returns nothing if the data is valid; otherwise, the method exits early
    def update(data)
      return unless data.is_a?(Hash) && !data.empty?

      sync_socket('playerUpdate', data)
    end
  end
end

Online::PlayerManager.new

# Example usage:
# manager = Online::PlayerManager.new
# manager.create
# manager.delete