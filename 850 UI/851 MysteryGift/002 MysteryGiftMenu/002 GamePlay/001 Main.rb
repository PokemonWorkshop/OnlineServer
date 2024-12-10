module GamePlay
  class MysteryGiftMenu < BaseCleanUpdate
    include UI::MysteryGift
    include UI::MysteryGiftMenu

    # Initialize the whole Mystery Gift UI
    # @param quests [PFM::MysteryGift] the quests to send to the Quest UI
    def initialize
      super
      @index = 0
      @running = true
    end

    def update_graphics
      @base_ui.update_background_animation
      @composition.update
    end

    private

    def create_graphics
      super
      create_base_ui
      create_composition
      Graphics.sort_z
    end

    def create_base_ui
      @base_ui = BaseUI.new(@viewport, button_texts)
    end

    def button_texts
      [ext_text(9006, 0), nil, nil, ext_text(9000, 115)]
    end

    def create_composition
      @composition = Composition.new(@viewport)
    end
  end
end

GamePlay.mystery_gift_menu_ui_class = GamePlay::MysteryGiftMenu
