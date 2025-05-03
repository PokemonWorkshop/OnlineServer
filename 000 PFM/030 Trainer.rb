module PFM
  # Class representing a Trainer.
  class Trainer
    # @return [String, nil] the friend code of the trainer.
    attr_accessor :friend_code

    # Checks if the trainer has a friend code.
    # @return [Boolean] true if the trainer has a friend code, false otherwise.
    def friend_code?
      !@friend_code.nil?
    end

    # Resets the friend code to nil, effectively removing it.
    # @return [void]
    def reset_friend_code
      @friend_code = nil
    end
  end
end
