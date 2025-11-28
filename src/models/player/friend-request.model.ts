/**
 * Represents a friend request sent by a user.
 *
 * @interface IFriendRequest
 * @property {string} from - The username or identifier of the user who sent the friend request.
 * @property {Date} date - The date and time when the friend request was sent.
 */
export interface IFriendRequest {
  from: string;
  date: Date;
}

