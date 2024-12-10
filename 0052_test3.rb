module FriendManager
  module_function

  def list_friend
    Online::Client.emit('friendReqList')

    event_data = Online::Client.get_event_data(:friendReqList)
  end

  def list_pending
    Online::Client.emit('friendReqListPending')

    event_data = Online::Client.get_event_data(:friendReqListPending)
  end

  def add_friend(code)
    Online::Client.emit('friendReqAdd', code)

    event_data = Online::Client.get_event_data(:friendReqAdd);
  end

  def res_friend(id, res = true)
    Online::Client.emit('friendReqResponse', { requesterID: id, isAccepted: res })

    event_data = Online::Client.get_event_data(:friendReqResponse)
  end
end

#Online::Client.connect('ws://localhost:3011')

#FriendManager.list_friend
#FriendManager.list_pending
#FriendManager.add_friend()
#FriendManager.add_friend('spq8faow')
#FriendManager.add_friend('11n1sdgm')
#FriendManager.res_friend() 655457806
#FriendManager.res_friend('655457806')

#Online::Client.disconnect