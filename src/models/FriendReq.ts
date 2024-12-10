import { Document, model, Schema } from 'mongoose';

interface IFriendReq extends Document {
  requesterId: string;
  receiverId: string;
  requesterName: string;
  createdAt: Date;
}

const FriendReqSchema: Schema<IFriendReq> = new Schema({
  requesterId: {
    type: 'string',
    required: true,
  },
  requesterName: {
    type: 'string',
    required: true,
  },
  receiverId: {
    type: 'string',
    required: true,
  },
  createdAt: {
    type: 'date',
    default: () => new Date(),
  },
});

const FriendReq = model<IFriendReq>('FriendReqs', FriendReqSchema);

export { FriendReq, IFriendReq };
