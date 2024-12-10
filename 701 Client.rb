require 'socket.io-client-simple'

module Online
  module Client
    @socket = nil
    @ready = false
    @closed = false
    @@promises = {}

    @_thread = nil

    module_function

    def ready?
      return @ready
    end

    def closed?
      return @closed
    end

    def connect(url)
      return if @socket

      Online::Trainer.load_friend_code

      query = {
        playerId: $trainer.id,
        gameVersion: $trainer.game_version,
        currentVersion: $trainer.current_version,
      }

      begin
        socket = SocketIO::Client::Simple.connect(url, query)

        @_thread = Thread.new do
          sleep(0.1) until socket.state == :connect
          @socket = socket
          @ready = true
          @closed = false
          setup_default_events unless @closed
        end

      rescue Exception => e
        log_error("Error connecting to WebSocket: #{e.message}")
        @closed = true
        @ready = false
        @socket = nil
      end
    end

    def register_all_event_modules
      ObjectSpace.each_object(Module) do |mod|
        if mod.name&.start_with?("Online::Events::")
          unless mod.const_defined?(:LISTENERS)
            log_error("Error: Module #{mod.name} must define a LISTENERS constant")
            next
          end

          unless mod.respond_to?(:register_events)
            log_error("Error: Module #{mod.name} must define a register_events method")
            next
          end

          log_debug("Registering events for #{mod.name}")
          mod.register_events
        end
      end
    end

    def setup_default_events
      register_all_event_modules
      
      @socket.on :connect do
        log_debug("WebSocket connected")
        @ready = true
        @closed = false
      end

      @socket.on :disconnect do
        log_debug("Disconnected from WebSocket")
        Online::Client.disconnect
      end

      @socket.on :error do |error|
        log_error("WebSocket error: #{error}")
      end

      @socket.on :unauthorized do |message|
        log_error("Unauthorized: #{message}")
        Online::Client.disconnect
      end

      @socket.on("server_shutdown") do |message|
        log_debug("#{message}")
        Online::Client.disconnect
      end
    end

    def register_event(event_name, &block)
      log_debug("Registering event: #{event_name}")
      @socket.on(event_name, &block) if @socket
    rescue StandardError => error
      log_error("Error registering event '#{event_name}': #{error.message}")
    end

    def emit(event_name, data = {})
      return log_error("Cannot emit event: No active WebSocket connection found.") unless ready?

      begin
        if data.to_s.size > 1_000_000
          log_error("Data size exceeds limit")
          return
        end

        @socket.emit(event_name, data)
      rescue StandardError => e
        log_error("Error emitting event '#{event_name}': #{e.message}")
      end
    end

    def resolve_event_data(event_name, data)
      if @@promises[event_name]
        begin
          @@promises[event_name].call(data)
          @@promises.delete(event_name)
        rescue => e
          log_error("Error resolving data for event '#{event_name}': #{e.message}")
        end
      else
        log_error("No promise registered for event '#{event_name}'")
      end
    end    

    def get_event_data(event_name, timeout: 1)
      unless ready?
        log_error("Cannot get event data: No active WebSocket connection found.")
        return nil
      end
    
      result = nil
      promise = ->(data) { result = data }
      @@promises[event_name] = promise
    
      event_timeout = timeout
      start_time = Time.now
    
      @socket.on(event_name) do |data|
        promise.call(data)
        
        @socket.off(event_name) if @socket
    
        @@promises.delete(event_name)
      end
    
      until result || (Time.now - start_time > event_timeout)
        sleep(0.1)
      end
    
      if result.nil?
        log_error("Timeout occurred while waiting for event '#{event_name}'")
        @@promises.delete(event_name) 
      end
      
      result
    end

    def disconnect
      return if @closed
    
      begin
        if @socket&.websocket&.open?
          log_debug("Closing WebSocket connection")
          @socket.websocket.close
        end
      rescue StandardError => e
        log_error("Error during WebSocket disconnect: #{e.message}")
        log_error('Failed to properly close sockets, garbage collection will handle the issue')
      ensure
        @closed = true
        @ready = false
        remove_instance_variable(:@socket) if instance_variable_defined?(:@socket)
        Thread.kill(@_thread) if @_thread
      end
    end    
  end
end
