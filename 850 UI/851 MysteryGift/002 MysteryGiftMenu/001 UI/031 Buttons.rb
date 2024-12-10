module UI
  module MysteryGiftMenu
    class Buttons < SpriteStack
      TEXT = {
        fr: ['Via un code ou un mot de passe', 'Via Internet', 'Voir vos Cadeaux Mystère'],
        en: ['Via a code or password', 'Via Internet', 'See your Mystery Gifts']
      }

      COORDINATE_WIN_MAIN_X = [43]
      COORDINATE_WIN_MAIN_Y = [77, 108, 139]

      TEXTURE_WIN_MAIN_HEIGHT = 25

      attr_reader :selected

      # Create the Composition of the scene
      # @param viewport [Viewport]
      # @param secondary_viewport [Viewport]
      # @param tertiary_viewport [Viewport]
      # @param mystery_gift [PFM::MysteryGift]
      def initialize(viewport, index)
        @index = index
        super(viewport, *initial_coordinates)
        create_sprites
        @selected = false
      end

      # Update all animation
      def update; end

      # Set the selected state
      def selected=(value)
        return if value == @selected

        @selected = value
      end

      # Tells if all animation are done
      # @return [Boolean]
      def done?; end

      private

      def initial_coordinates
        return COORDINATE_WIN_MAIN_X[@index % 1], COORDINATE_WIN_MAIN_Y[@index % 3]
      end

      def create_sprites
        @choices = add_sprite(0, 0, 'mystery_gift/win_main')
        @choices.src_rect.height = TEXTURE_WIN_MAIN_HEIGHT
        add_text(116, 0, 0, 21, TEXT[$trainer.game_state.options.language.to_sym][@index], 1, color: 9)
      end
    end
  end
end
