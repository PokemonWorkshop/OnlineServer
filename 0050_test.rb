module Online
  module PlayerManager
    module_function
  
    def create_player
      Client.emit('playerCreate', { 
        playerId: $trainer.id.to_s, 
        playerName: $trainer.name,
        playingGirl: $trainer.playing_girl,
        charsetBase: $game_player.charset_base
      })
  
      event_data = Client.get_event_data(:playerCreate)
  
      Trainer.save_friend_code(event_data['data'])
  
      puts "Le code ami save est : #{$friend_code}"
  
    end
  end
end



#Online::Client.connect('ws://localhost:3011')
#PlayerManager.create_player
#Online::Client.disconnect