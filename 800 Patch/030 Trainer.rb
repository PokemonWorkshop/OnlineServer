module Online
  module Trainer
    $friend_code = nil

    module_function

    def simple_encrypt(text, shift = 3)
      encrypted = text.chars.map do |char|
        if char =~ /[a-zA-Z]/
          base = char.ord < 91 ? 'A'.ord : 'a'.ord
          ((char.ord - base + shift) % 26 + base).chr
        else
          char
        end
      end
      encrypted.join
    end

    def simple_decrypt(text, shift = 3)
      simple_encrypt(text, -shift)
    end

    def load_friend_code
      if File.exist?("saves/online_#{$trainer.id}.dat")
        file_content = File.binread("saves/online_#{$trainer.id}.dat")
        decrypted_content = simple_decrypt(file_content)
        $friend_code = decrypted_content
      else
        $friend_code = nil  
      end
    end

    def save_friend_code(friend_code)
      encrypted_code = simple_encrypt(friend_code)

      File.open("saves/online_#{$trainer.id}.dat", "wb") do |file|
        file.write(encrypted_code)  
      end
      $friend_code = friend_code
    end
    
  end
end
