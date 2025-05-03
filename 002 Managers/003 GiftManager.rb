module Online
  class GiftManager < BaseManager
    # Retrieves a list of available gifts by synchronizing with the server
    # This method sends a 'giftList' request through the sync_socket
    # @return [void]
    def list
      sync_socket('giftList')
    end

    # Claims a gift by its unique identifier.
    #
    # @param id [String] The unique identifier of the gift to be claimed
    # @return [void]
    def claim_by_id(id)
      sync_socket('giftClaim', { id: id })
    end

    # Claims a gift using a provided code by communicating with the server
    #
    # @param code [String] The unique code used to claim the gift
    # @return [void]
    def claim_by_code(code)
      sync_socket('giftClaim', { code: code })
    end
  end
end

#manager = Online::GiftManager.new
#manager.list
#manager.claim_by_id("gift-abc123")
#manager.claim_by_code("MYSTERY2025")
