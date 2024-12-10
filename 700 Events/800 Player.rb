module Online
  module Events
    module Player
      # Defines the events that will be listened to.
      LISTENERS = %i[playerCreate playerDelete]

      module_function

      # Registers event listeners for player-related events.
      #
      # This method iterates over the LISTENERS array and registers
      # each event with the Online::Client. For each event, a debug
      # log is generated when the event is triggered, and the event
      # data is resolved using the appropriate method.
      def register_events
        LISTENERS.each do |event|
          Client.register_event(event) do |data|
            # Logs the event and the associated data for debugging purposes.
            log_debug("#{event.capitalize} #{data.inspect}")

            # Resolves the event data based on the triggered event.
            Client.resolve_event_data(event, data)
          end
        end
      end
    end
  end
end
