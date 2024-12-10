module GiftManager
  module_function

  def list_gift
    Online::Client.emit('giftList')

    event_data = Online::Client.get_event_data(:giftList)
  end

  def claim_gift(data)
    Online::Client.emit('giftClaim', data)

    event_data = Online::Client.get_event_data(:giftClaim)

    if event_data["status"]["code"] != 200
      return log_debug(event_data["status"]["message"])
    end

    item = event_data["data"]["items"]

    log_debug(item[0]["id"].to_sym)

    item_symbol = item[0]["id"][1..-1].to_sym
    item_count = item[0]["count"].to_i

    log_debug(item_symbol)
    log_debug(item_count)

    $bag.add_item(item_symbol, item_count)
  end 
end

#Online::Client.connect('ws://localhost:3011')
#GiftManager.list_gift
#GiftManager.claim_gift({ code: "ITEM" })
#GiftManager.claim_gift({ giftID: "gift-hlrxdg4i"})
#GiftManager.claim_gift({ code: "ITEM"})
#Online::Client.disconnect
