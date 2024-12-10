module GamePlay
  class << self
    # Get the mystery gift scene
    # @return [Class<MysteryGift>]
    attr_accessor :mystery_gift_menu_ui_class

    # Open the menu class
    def open_mystery_gift_menu_ui
      current_scene.call_scene(mystery_gift_menu_ui_class)
    end

    # Get the mystery gift internet request scene
    # @return [Class<MysteryGift>]
    attr_accessor :mystery_gift_request_internet_ui_class

    # Open the menu class
    def open_mystery_gift_request_internet_ui
      current_scene.call_scene(mystery_gift_request_internet_ui_class)
    end

    # Get the mystery gift code request scene
    # @return [Class<MysteryGift>]
    attr_accessor :mystery_gift_request_code_ui_class

    # Open the menu class
    # @yieldparam menu_scene [MysteryGiftMixin]
    def open_mystery_gift_request_code_ui
      current_scene.call_scene(mystery_gift_request_code_ui_class)
    end

    # Get the mystery gift list scene
    # @return [Class<MysteryGift>]
    attr_accessor :mystery_gift_list_ui_class

    # Open the menu class
    # @param mystery_gift [PFM::MysteryGift]
    def open_mystery_gift_list_ui(mystery_gift = PFM.game_state.mystery_gift)
      current_scene.call_scene(mystery_gift_list_ui_class, mystery_gift)
    end
  end
end

# GamePlay.open_mystery_gift_menu_ui <==== Start la scene
