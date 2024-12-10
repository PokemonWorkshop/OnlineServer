module Online
  module Events
    module Friend
      LISTENERS = %i[friendReqAdd friendReqResponse friendReqList friendReqListPending]

      module_function

      def register_events
        LISTENERS.each do |event|
          Client.register_event(event) do |data|
            log_debug("#{event.capitalize} #{data.inspect}")
            Client.resolve_event_data(event, data)
          end
        end
      end
    end
  end
end