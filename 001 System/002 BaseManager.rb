module Online
  class BaseManager
    # Emits an event over WebSocket and waits for a response
    #
    # @param event_name [String] The name of the WebSocket event
    # @param data [Hash] Payload for the event
    # @param timeout [Integer] Max seconds to wait for the response
    # @return [Object] Response from server
    def sync_socket(event_name, data = {}, timeout: 5)
      response = nil
      cv = ConditionVariable.new
      mutex = Mutex.new

      WebSocketClient.emit(event_name, data) do |res|
        log_debug("[#{event_name}] Response: #{res}")
        @response_hook&.call(event_name, res)

        mutex.synchronize do
          response = res
          cv.signal
        end
      end

      mutex.synchronize do
        unless cv.wait(mutex, timeout)
          raise Timeout::Error, "Timeout waiting for #{event_name} (#{timeout}s)"
        end
      end

      response
    end

    # Emits an event asynchronously (fire and forget)
    #
    # @param event_name [String]
    # @param data [Hash]
    def async_socket(event_name, data = {})
      WebSocketClient.emit(event_name, data) do |res|
        log_debug("[#{event_name}] Async response: #{res}")
        @response_hook&.call(event_name, res)
      end
    end

    # Tries to send a sync event and retries if it fails by timeout
    #
    # @param retries [Integer] Number of retry attempts
    def sync_with_retry(event_name, data = {}, retries: 3)
      attempts = 0
      begin
        sync_socket(event_name, data)
      rescue Timeout::Error => e
        attempts += 1
        log_debug("Attempt #{attempts} failed: #{e.message}")
        retry if attempts < retries
        raise e
      end
    end

    # Returns true if response contains { success: true }
    #
    # @param event_name [String] The name of the event to check
    # @param data [Hash] The data to be sent with the event
    def emit_successfully?(event_name, data = {})
      res = sync_socket(event_name, data)
      res.is_a?(Hash) && res['success'] == true
    end

    # Hook to run code after every WebSocket response
    def with_response_hook(&block)
      @response_hook = block
    end
  end
end
