module PFM
  class MysteryGift
    # The player's friend code
    # @return [String]
    attr_reader :friend_code
    # List of the received gifts of the player
    # @return [Hash{Symbol=>Array<MysteryGift::Gift>]
    attr_reader :received_gift
    # Get the game state responsive of the whole game state
    # @return [PFM::GameState]
    attr_accessor :game_state

    def initialize
      init_received_gift
    end

    # Add a received gift to the list of received gifts
    # @param gift [MysteryGift::Gift]
    # @param reason [MysteryGift::Gift] :internet by default, else any other reason
    def add_received_gift_to(gift, reason = :internet)
      @received_gift[reason] = [] unless @received_gift[reason].is_a? Array
      @received_gift[reason] << gift
    end

    private

    def init_received_gift
      @received_gift = {}
      @received_gift[:internet] = []
      @received_gift[:code] = []
    end

    def init_friend_code
      return unless @friend_code

      Online::Client.emit('playerCreate', {
                            playerId: $trainer.id.to_s,
                            playerName: $trainer.name,
                            playingGirl: $trainer.playing_girl,
                            charsetBase: $game_player.charset_base
                          })
      event_data = Online::Client.get_event_data(:playerCreate)
      @friend_code = event_data['data']
    end
  end

  class GameState
    # The mystery gift information
    # @return [PFM::MysteryGift]
    attr_accessor :mystery_gift

    safe_code('Setup Mystery Gift in GameState') do
      on_player_initialize(:mystery_gift) { @mystery_gift = PFM::MysteryGift.new }
      on_expand_global_variables(:mystery_gift) do
        @mystery_gift.game_state = self
      end
    end
  end
end
