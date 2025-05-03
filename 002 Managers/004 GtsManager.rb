module Online
  class GtsManager < BaseManager
    # Sends a creature to the GTS (Global Trade Station) for trading
    #
    # @param creature [Hash] The creature data to be sent
    # @param require_conditions [Array] The conditions required for the trade
    def add(creature, require_conditions)
      sync_socket('gtsAdd', {
        creature: creature,
        require_conditions: require_conditions
      })
    end

    # Retrieves the list of available trades from the GTS
    #
    # @note This method communicates with the server using the 'gtsAllList' command
    # @note to fetch the current list of trades.
    # @param filters [Hash] The filtering criteria for the trade list
    def list(filters = {})
      sync_socket('gtsAllList', filters)
    end

    # Retrieves the list of trades that the player has made
    #
    # @param player_a_id [String] The ID of the player whose trades are being retrieved
    # @param offered_creature [Hash] The creature being offered in the trade
    def trade(player_sender_id, offered_creature)
      sync_socket('gtsTrade', {
        playerA_id: player_sender_id,
        offeredCreature: offered_creature
      })
    end

    # Remove a creature from the GTS
    def remove
      sync_socket('gtsRemove')
    end
  end
end
