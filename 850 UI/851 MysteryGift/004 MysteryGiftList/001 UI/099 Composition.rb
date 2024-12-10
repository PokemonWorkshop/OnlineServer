module UI
  module MysteryGiftList
    class Composition < SpriteStack
      # Create the Composition of the scene
      # @param viewport [Viewport]
      # @param secondary_viewport [Viewport]
      # @param tertiary_viewport [Viewport]
      # @param mystery_gift [PFM::MysteryGift]
      def initialize(viewport, secondary_viewport, tertiary_viewport, mystery_gift)
        super(viewport)
        @viewport = viewport
        @secondary_viewport = secondary_viewport
        @tertiary_viewport = tertiary_viewport
        @mystery_gift = mystery_gift
        @animation_handler = Yuki::Animation::Handler.new
        @category = :primary
        @state = :compact # Possible states being :compact and :deployed
        create_frame
        create_buttons
      end

      # Update all animation
      def update
        return if @animation_handler.empty?

        @animation_handler.update
      end

      # Tells if all animation are done
      # @return [Boolean]
      def done?
        return @animation_handler.done?
      end

      private

      def create_frame
        @frame = Frame.new(@viewport)
      end

      def create_buttons
        @buttons = Array.new(3) { |i| Buttons.new(@viewport, i) }
      end
    end
  end
end
