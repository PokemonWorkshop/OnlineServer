module UI
  module MysteryGiftMenu
    class Cursor < Sprite
      CURSOR_RECT = [[0, 0, 242, 32], [0, 32, 242, 32]]

      # Initialize the Cursor component
      # @param viewport [Viewport]
      def initialize(viewport)
        super(viewport)
        @index = 0
        # @type [Yuki::Animation::TimedLoopAnimation]
        @animation = nil
        init_sprite
        init_animation
      end

      # Update the animation of the button
      def update
        @animation&.update
      end

      # Update the coordinates of the button with an offset
      # @param button_x [Integer]
      # @param button_y [Integer]
      def update_coordinates(button_x, button_y)
        set_position(button_x - 4, button_y - 4)
      end

      private

      def init_sprite
        set_position(39, 73)
        set_bitmap('mystery_gift/cursor_main', :interface)
        src_rect.set(*CURSOR_RECT[0])
      end

      def init_animation
        ya = Yuki::Animation
        anim = ya::TimedLoopAnimation.new(1)
        anim.play_before(ya.send_command_to(src_rect, :set, *CURSOR_RECT[0]))
        anim.play_before(ya.wait(1))
        anim.play_before(ya.send_command_to(src_rect, :set, *CURSOR_RECT[1]))
        anim.play_before(ya.wait(1))
        anim.resolver = self
        anim.start
        @animation = anim
      end
    end
  end
end
