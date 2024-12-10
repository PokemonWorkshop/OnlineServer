module UI
  module MysteryGift
    class Frame < Sprite
      FILENAME = 'mystery_gift/frame'
      # Initialize the graphism for the frame
      # @param viewport [Viewport] viewport in which the Sprite will be displayed
      def initialize(viewport)
        super(viewport)
        set_bitmap(FILENAME, :interface)
      end
    end
  end
end
