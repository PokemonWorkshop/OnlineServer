module UI
  module MysteryGiftMenu
    class Composition < SpriteStack
      include UI::MysteryGift

      # Create the Composition of the scene
      # @param viewport [Viewport]
      def initialize(viewport)
        super(viewport)
        @animation_handler = Yuki::Animation::Handler.new
        create_graphics
      end

      def create_graphics
        create_frame
        create_buttons
        create_cursor
      end

      # Update all animation
      def update
        @cursor.update
        return if @animation_handler.empty?

        @animation_handler.update
      end

      # Tells if all animation are done
      # @return [Boolean]
      def done?
        return @animation_handler.done?
      end

      # Update the coordinates of the cursor depending on the current button selected
      # @param index [Integer] index of the button
      def update_cursor_coordinates(index)
        @cursor.update_coordinates(@buttons[index].x, @buttons[index].y)
      end

      private

      def create_frame
        @frame = Frame.new(@viewport)
      end

      def create_buttons
        @buttons = Array.new(3) { |i| Buttons.new(@viewport, i) }
      end

      def create_cursor
        @cursor = Cursor.new(@viewport)
      end
    end
  end
end
