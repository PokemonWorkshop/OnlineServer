module GamePlay
  class MysteryGiftList < BaseCleanUpdate
    include UI::MysteryGift
    include UI::MysteryGiftList

    SELECTOR_RECT = [[0, 0, 242, 32], [0, 32, 242, 32]]
    # List of the categories of the quests
    # @return [Array<Symbol>]
    CATEGORIES = %i[primary secondary finished]
    # Initialize the whole Mystery Gift UI
    # @param quests [PFM::MysteryGift] the quests to send to the Quest UI
    def initialize(mystery_gift = PFM.game_state.mystery_gift)
      super()
      @category = :primary # Possible categories are, in order, :internet and :code
      @quest_deployed = :compact
      @deployed_mode = :descr # Possible modes are :descr, :rewards
      @last_key = nil
      @key_counter = 0
      @mystery_gift = mystery_gift
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

    def create_viewport
      super
      @secondary_viewport = Viewport.create(:main, 20_000)
      @tertiary_viewport = Viewport.create(27, 62, 272, 64, 21_000)
    end

    def create_base_ui
      @base_ui = BaseUI.new(@viewport, button_texts)
    end

    def button_texts
      [ext_text(9006, 0), nil, nil, ext_text(9000, 115)]
    end

    # Return the text for the A button
    # @return [String]
    def a_button_text
      @quest_deployed == :compact ? ext_text(9006, 0) : nil
    end

    # Return the text for the B button
    # @return [String]
    def b_button_text
      @quest_deployed == :compact ? ext_text(9000, 115) : ext_text(9006, 4)
    end

    # Return the text for the X button
    # @return [String]
    def x_button_text
      hash = { descr: ext_text(9006, 2), rewards: ext_text(9006, 3), objectives: ext_text(9006, 1) }
      hash[@deployed_mode]
    end

    def create_composition
      @composition = UI::MysteryGift::Composition.new(@viewport, @secondary_viewport, @tertiary_viewport, @mystery_gift)
    end

    # Tell if the first button is currently deployed
    # @return [Boolean]
    def deployed?
      @quest_deployed == :deployed
    end

    # Commute the variable telling if the first button is compacted or deployed
    def commute_quest_deployed
      @quest_deployed = (@quest_deployed == :compact ? :deployed : :compact)
    end
  end
end

GamePlay.mystery_gift_list_ui_class = GamePlay::MysteryGiftList
