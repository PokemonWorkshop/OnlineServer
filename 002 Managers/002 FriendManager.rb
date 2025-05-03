module Online
  class FriendManager < BaseManager
    # Sends a friend request to the specified friend code
    #
    # @param to_friend_code [String] The friend code of the recipient
    # @return [void]
    def send(to_friend_code)
      sync_socket('friendRequest', { toFriendCode: to_friend_code })
    end

    # Accepts a friend request from a specified sender
    #
    # @param sender_id [String] The ID of the user sending the friend request
    # @return [void]
    def accept(sender_id)
      sync_socket('friendAccept', { senderId: sender_id })
    end

    # Declines a friend request from a specified sender
    #
    # @param sender_id [String] The ID of the sender whose friend request is being declined
    # @return [void]
    def decline(sender_id)
      sync_socket('friendDecline', { senderId: sender_id })
    end

    # Removes a friend from the friend list by their unique identifier
    #
    # @param friend_id [String] The unique identifier of the friend to be removed
    # @return [void]
    def remove(friend_id)
      sync_socket('friendRemove', { friendId: friend_id })
    end

    # Retrieves the list of friends by synchronizing with the server
    # This method communicates with the server using the 'friendList' command
    # to fetch the current list of friends.
    #
    # @return [Object] The response from the server containing the friend list
    def friends
      sync_socket('friendList')
    end

    # Retrieves the list of pending friend requests by communicating with the server
    #
    # @return [Array] A list of pending friend requests, as provided by the server
    def pending
      sync_socket('friendPending')
    end
  end
end

#manager = Online::FriendManager.new
#manager.send("FR123456")         # → Send a friend request
#manager.accept("player567")      # → Accept a request
#manager.decline("player789")     # → Refuses a request
#manager.remove("friend123")      # → Delete a friend
#manager.friends                  # → List of friends
#manager.pending                  # → Pending friend requests