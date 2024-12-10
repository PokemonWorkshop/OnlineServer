module Online
  module Util
    
    module_function

    def convert_hash_creature(json)
      hash = {}
      tab_key = [
        :id, # basic
        :level, # basic
        :shiny, # basic
        :form, # adve
        :given_name, # adve
        :captured_with, # adve
        :captured_in, # adve
        :egg_in, # adve
        :egg_at, # adve
        :gender, # basic
        :nature, # basic
        :stats, # adve
        :bonus, # adve
        :item, # basic
        :ability, # basic
        :loyalty, # adve
        :moves, # basic
        :trainer_name, # adve
        :trainer_id # adve
      ]
    
      json.each do |key, value|
        symbol_key = key.to_sym
    
        next unless tab_key.include?(symbol_key)
        next if value.nil? || (value.is_a?(Array) && value.empty?)
    
        if symbol_key == :moves && value.is_a?(Array)
          hash_moves = value.map do |move|
            if move.is_a?(String) && move.start_with?(':')
              move[1..-1].to_sym
            end
          end
          hash[:moves] = hash_moves
        elsif value.is_a?(String) && value.start_with?(':')
          hash[symbol_key] = value[1..-1].to_sym
        else
          hash[symbol_key] = value
        end
      end
    
      return hash
    end
  end
end
