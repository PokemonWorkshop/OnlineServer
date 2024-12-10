module UI
  module MysteryGiftMenu
    class Cursor < SpriteSheet

      # Initialize the Cursor component
      # @param viewport [Viewport]
      def initialize(viewport)
        super(viewport, 1, 2)
        @index = 0
        # @type [Yuki::Animation::TimedLoopAnimation]
        @animation = nil
        init_sprite
        init_animation
      end

      # Update the animation of the button
      def update
        @animation.update
      end

      # Update the coordinates of the button with an offset
      # @param button_x [Integer]
      # @param button_y [Integer]
      def update_coordinates(button_x, button_y)
        set_position(button_x - 4, button_y - 4)
      end

      private

      def init_sprite
        set_bitmap('mystery_gift/cursor_main', :interface)
        set_position(39, 73)
      end

      def init_animation
        duration = 1
        @animation = Yuki::Animation::TimedLoopAnimation.new(duration)
        @animation.parallel_add(Yuki::Animation::DiscreetAnimation.new(duration, self, :sy=, 0, 1))
        @animation.start
      end
    end
  end
end
