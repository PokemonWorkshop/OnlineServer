module GamePlay
  # Class that describes the Mystery Gift Menu screen
  class MysteryGiftMenu
    # List of method called by automatic_input_update when pressing on a key
    AIU_KEY2METHOD = {
      A: :action_a,
      B: :action_b,
      DOWN: :action_down,
      UP: :action_up
    }

    # Update the input of scene
    def update_inputs
      return false unless @composition.done?

      return false unless automatic_input_update(AIU_KEY2METHOD)
    end

    # Action that happens when you press the A button
    def action_a
      case @index
      when 0
        # TODO : Call the next scene (MysteryGiftRequest in Internet mode)
      when 1
        # TODO : Call the next scene (MysteryGiftRequest in Code mode)
      when 2
        # TODO : Call the next scene (MysteryGiftList)
      end
    end

    # Action that happens when you press the B button
    def action_b
      @running = false
    end

    # Action that happens when you press the DOWN button
    def action_down
      @index += 1
      @index = 0 if @index >= 3
      @composition.update_cursor_coordinates(@index)
    end

    # Action that happens when you press the UP button
    def action_up
      @index -= 1
      @index = 2 if @index < 0
      @composition.update_cursor_coordinates(@index)
    end
  end
end
