import { Socket } from 'socket.io';
import { giftClaim } from './gift/giftClaim';
import { giftList } from './gift/giftList';

/**
 * Controller class responsible for handling gift-related operations.
 */
export class GiftController {
  public async handleGiftClaim(socket: Socket, data: unknown): Promise<void> {
    await giftClaim(socket, data);
  }
  public async handleGiftList(socket: Socket): Promise<void> {
    await giftList(socket);
  }
}
