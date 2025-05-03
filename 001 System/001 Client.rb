require 'socket'
require 'openssl'
require 'json'
require 'uri'
require 'base64'

# Online Client for Ruby

# This module defines a WebSocket client implementation that enables bidirectional communication with WebSocket servers. 
# It supports both secure (wss) and non-secure (ws) connections and is designed for high-level event-driven communication.

# Features:
# - Connection handling to WebSocket servers (both secure and non-secure).
# - Handshake with the server, including WebSocket-specific headers.
# - Sending and receiving WebSocket frames with proper masking.
# - Callback registration for handling events such as receiving messages, connection close, etc.
# - Threaded listening mechanism for receiving incoming WebSocket frames and processing messages.
# - Handling of incoming messages as JSON objects, invoking appropriate registered callbacks based on event type.

# Usage:
# - Call `connect(url, headers)` to establish a WebSocket connection.
# - Use `on(event, &block)` to register callbacks for specific events.
# - Use `on_message(&block)` to register a callback for received messages.
# - Use `emit(event, data, &callback)` to send events to the server with optional response handling.
# - Call `close` to terminate the connection and clean up resources.

# Author: Ota

module Online
  module WebSocketClient
    @socket = nil
    @host = nil
    @port = nil
    @ssl = false
    @event_callbacks = {}
    @pending_callbacks = {}
    @on_message = nil
    @on_close = nil
    @running = false
    @listening_thread = nil

    module_function

    # Establishes a WebSocket connection to the specified URL.
    #
    # @param url [String] the WebSocket URL to connect to. Defaults to "ws://localhost:8080".
    # @param headers [Array] an array of headers to include in the connection handshake. Defaults to an empty array.
    # @return [void]
    def connect(url = 'ws://localhost:8080', headers: [])
      return if @running

      uri = URI.parse(url)
      @host = uri.host
      @port = uri.port || default_port(uri.scheme)
      @ssl = uri.scheme == 'wss'
      setup_connection
      handshake(uri, headers)
      listen
    end

    # Registers a callback block to be executed when a specified event occurs.
    #
    # @param event [Symbol] the event to listen for.
    # @param block [Proc] the block to be executed when the event occurs.
    # @return [void]
    def on(event, &block)
      @event_callbacks[event] = block
    end

    # Registers a block to be called when a message is received.
    #
    # @yield [message] Gives the received message to the block.
    # @yieldparam [Object] message The message received.
    def on_message(&block)
      @on_message = block
    end

    # Registers a block to be called when the connection is closed.
    # The block will be stored in an instance variable and can be executed later.
    #
    # @yield [block] The block to be executed when the connection is closed.
    def on_close(&block)
      @on_close = block
    end

    # Sends an event with associated data to the server and optionally registers a callback.
    #
    # @param event [String] the name of the event to send.
    # @param data [Hash] the data to send with the event.
    # @param callback [Proc] an optional block to be called when a response is received.
    # @return [void]
    def emit(event, data, &callback)
      return unless socket?

      send_frame({ event: event, data: data }.to_json)
      @pending_callbacks[event] = callback if callback
    end

    # Starts a new thread to listen for incoming messages on the socket.
    # The thread runs in a loop, receiving frames and handling messages
    # until the @running flag is set to false. If an error occurs, it logs
    # the error message. When the thread is stopped, it ensures the socket
    # is closed and logs the closure. If an error occurs while closing the
    # socket, it logs the error message.
    #
    # @return [void]
    def listen
      @running = true
      @listening_thread = Thread.new do
        begin
          loop do
            break unless @running
            frame = receive_frame
            handle_message(frame) if frame
          end
        rescue => e
          log_error(e.message)
        ensure
          if @socket && !@socket.closed?
            begin
              @socket.close
              @running = false
              sleep 0.3
              log_info('Socket closed')
              @listening_thread.exit if @listening_thread&.alive?
            rescue => e
              log_error "Error closing socket: #{e.message}"
            end
          end
        end
      end
    end

    # Checks if the socket is open and not closed.
    #
    # @return [Boolean] true if the socket is open and not closed, false otherwise.
    def socket?
      return !!@socket && !@socket.closed?
    end

    # Closes the client connection.
    #
    # This method stops the client from running by setting the @running flag to false,
    # kills the listening thread if it exists, and closes the socket connection if it is open.
    # If an on_close callback is defined, it will be called after the socket is closed.
    def close
      @running = false
      @listening_thread.exit if @listening_thread&.alive?

      if @socket && !@socket.closed?
        begin
          @socket.close
          sleep 0.3
          log_info('Socket successfully closed')
        rescue => e
          log_error "Error closing socket: #{e.message}"
        end
      else
        log_info('The socket was already closed.')
      end

      @on_close&.call
    end

    # Determines the default port number based on the given scheme.
    #
    # @param scheme [String] The scheme to check, either 'wss' for WebSocket Secure or any other scheme.
    # @return [Integer] Returns 443 if the scheme is 'wss', otherwise returns 80.
    def default_port(scheme)
      scheme == 'wss' ? 443 : 80
    end

    # Establishes a connection to the server using TCP.
    # If SSL is enabled, it wraps the socket with SSL.
    #
    # @return [void]
    def setup_connection
      @socket = TCPSocket.new(@host, @port)
      @socket = setup_ssl(@socket) if @ssl
    end

    # Sets up an SSL connection on the given socket.
    #
    # @param socket [TCPSocket] The socket to wrap with SSL.
    # @return [OpenSSL::SSL::SSLSocket] The SSL socket.
    # @raise [OpenSSL::SSL::SSLError] If the SSL connection fails.
    def setup_ssl(socket)
      ssl_context = OpenSSL::SSL::SSLContext.new
      ssl_socket = OpenSSL::SSL::SSLSocket.new(socket, ssl_context)
      ssl_socket.sync_close = true
      ssl_socket.connect
      ssl_socket
    end

    # Establishes a WebSocket handshake with the given URI and headers.
    #
    # @param uri [URI] the URI to connect to.
    # @param headers [Array<String>] additional headers to include in the handshake request.
    # @return [void]
    # @raise [HandshakeError] if the handshake validation fails.
    def handshake(uri, headers)
      path = uri.path.empty? ? '/' : uri.path
      key = Base64.encode64(Random.new.bytes(16)).strip

      request_headers = default_headers(path, key) + headers + ['', '']
      @socket.write(request_headers.join("\r\n"))
      validate_handshake
    end

    # Generates the default headers required for establishing a WebSocket connection.
    #
    # @param path [String] the path for the WebSocket connection.
    # @param key [String] the security key for the WebSocket connection.
    # @return [Array<String>] an array of strings representing the HTTP headers.
    def default_headers(path, key)
      [
        "GET #{path} HTTP/1.1",
        "Host: #{@host}:#{@port}",
        'Upgrade: websocket',
        'Connection: Upgrade',
        "Sec-WebSocket-Key: #{key}",
        'Sec-WebSocket-Version: 13',
        'Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXJ2ZXIiOiJQU0RLX09OTElORV9WMiIsImlhdCI6MTc0MzA4NzkyMn0.p54CBe0LtcIR3HgSg7-CCQUUGeWSUo66_zLwS693Tp0'
      ]
    end

    # Validates the handshake response from the server.
    #
    # This method reads a partial response from the socket and checks if it includes
    # the "101 Switching Protocols" status code, which indicates a successful handshake.
    # If the response does not include this status code, an exception is raised.
    #
    # @raise [RuntimeError] if the handshake response does not include "101 Switching Protocols".
    def validate_handshake
      response = @socket.readpartial(1024)
      raise "Handshake failed: #{response}" unless response.include?('101 Switching Protocols')
    end

    # Sends a frame of data over the socket connection.
    #
    # @param data [String] The data to be sent.
    # @return [void]
    # @raise [IOError] If the socket is not available.
    #
    # The method constructs a WebSocket frame with the given data, applies a mask to the data,
    # and writes the frame to the socket. The frame includes an initial byte indicating that
    # this is a text frame, followed by the length of the data, a randomly generated mask key,
    # and the masked data itself.
    def send_frame(data)
      return unless socket?

      frame = ''
      frame << 0x81.chr
      length = data.bytesize

      frame << frame_length(length)
      mask_key = Array.new(4) { rand(0..255) }
      frame << mask_key.pack('C*')
      frame << apply_mask(data, mask_key).pack('C*')

      @socket.write(frame)
    end

    # Calculates the frame length for a WebSocket frame.
    #
    # @param length [Integer] the length of the frame payload.
    # @return [String] the encoded frame length as a binary string.
    # @note If the length is 125 or less, it returns a single byte with the length.
    #       If the length is between 126 and 65535, it returns a two-byte length indicator.
    #       If the length is greater than 65535, it returns an eight-byte length indicator.
    def frame_length(length)
      return (0x80 | length).chr if length <= 125
      return [0xFE, length].pack('Cn') if length <= 65535

      [0xFF, length >> 32, length & 0xFFFFFFFF].pack('CNN')
    end

    # Applies a mask to the given data using the provided mask key.
    #
    # @param data [String] the data to be masked
    # @param mask_key [Array<Integer>] an array of integers representing the mask key
    # @return [Array<Integer>] an array of integers representing the masked data
    def apply_mask(data, mask_key)
      data.bytes.each_with_index.map { |byte, i| byte ^ mask_key[i % 4] }
    end

    # Receives a frame from the socket, processes it, and returns the payload.
    #
    # @return [String, nil] The unmasked payload as a string, or nil if the first byte is not received.
    #
    # @example
    #   payload = receive_frame
    #   puts payload unless payload.nil?
    #
    # @note This method reads the first byte to determine the opcode and then reads the length and mask key.
    #       It reads the payload based on the length and unmasks it if a mask key is present.
    def receive_frame
      first_byte = @socket.read(1)&.ord
      return nil unless first_byte

      # opcode = first_byte & 0x0F
      length, mask_key = read_length_and_mask
      payload = @socket.read(length)&.bytes || []
      mask_key ? unmask_payload(payload, mask_key) : payload.pack('C*')
    end

    # Reads the length and mask key from the socket.
    #
    # This method reads the second byte from the socket to determine the length
    # of the payload and whether a mask key is present. The length can be encoded
    # in different formats based on the value of the second byte:
    # - If the length is 126, the next 2 bytes represent the length.
    # - If the length is 127, the next 8 bytes represent the length.
    # - Otherwise, the length is represented by the lower 7 bits of the second byte.
    #
    # The method also checks if the mask bit (the most significant bit of the second byte)
    # is set. If it is, the next 4 bytes are read as the mask key.
    #
    # @return [Array<(Integer, Array<Integer>|nil)>] A tuple containing the length of the payload
    #   and the mask key (if present), or [0, nil] if the second byte could not be read.
    def read_length_and_mask
      second_byte = @socket.read(1)&.ord
      return [0, nil] unless second_byte

      length = second_byte & 0x7F
      length = @socket.read(2)&.unpack1('n') if length == 126
      length = @socket.read(8)&.unpack1('Q>') if length == 127
      mask_key = (second_byte & 0x80) == 0 ? nil : @socket.read(4)&.bytes
      [length, mask_key]
    end

    # Unmasks a masked payload using the provided mask key.
    #
    # @param payload [Array<Integer>] The masked payload as an array of bytes.
    # @param mask_key [Array<Integer>] The mask key as an array of 4 bytes.
    # @return [String] The unmasked payload as a string of bytes.
    def unmask_payload(payload, mask_key)
      payload.map.with_index { |byte, i| byte ^ mask_key[i % 4] }.pack('C*')
    end

    # Handles incoming messages by parsing the JSON data and triggering the appropriate callbacks.
    #
    # @param message [String] the incoming message in JSON format.
    # @return [void]
    #
    # The method performs the following steps:
    # 1. Returns immediately if the message is nil or empty.
    # 2. Attempts to parse the message as JSON. If parsing fails, returns immediately.
    # 3. Extracts the 'event' from the parsed data.
    # 4. If an event callback exists for the event, it calls the callback with the event data.
    # 5. If a pending callback exists for the event, it calls the callback with the event data and removes the callback from the pending list.
    # 6. Calls the @on_message callback with the original message if @on_message is defined.
    def handle_message(message)
      return unless message && !message.empty?

      data = JSON.parse(message) rescue nil
      return unless data

      event = data['event']

      if event == 'error'
        raise StandardError.new("#{data['data']['error']} : #{data['data']['message']}")
      end 

      if @event_callbacks.key?(event)
        @event_callbacks[event].call(data['data'])
      elsif @pending_callbacks.key?(event)
        @pending_callbacks[event].call(data['data'])
        @pending_callbacks.delete(event)
      end

      @on_message&.call(message)
    end
  end
end
