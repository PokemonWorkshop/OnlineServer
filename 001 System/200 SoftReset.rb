module Yuki
  class SoftReset
    def main
      if Online::WebSocketClient.socket?
        Online::WebSocketClient.close
      end
      
      Scheduler.start(:on_transition)

      Audio.__reset__
      ObjectSpace.each_object(::Viewport) { |v| v.dispose unless v.disposed? }
      GC.start
      ObjectSpace.each_object(::Sprite) { |s| s.dispose unless s.disposed? }
      ObjectSpace.each_object(::Text) { |t| t.dispose unless t.disposed? }
      ObjectSpace.each_object(::Texture) { |b| b.dispose unless b.disposed? }
      Pathfinding.debug = false
      PFM.game_state = nil
      GC.start
      ts = 0.1
  
      sleep(ts) while Input::Keyboard.press?(Input::Keyboard::F12)
    end
  end
end