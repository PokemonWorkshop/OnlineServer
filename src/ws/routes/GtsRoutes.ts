import { GtsController } from '@ws/controllers/GtsController';
import { Socket } from 'socket.io';

interface GtsEvents {}

class GtsRoutes {
  private gtsController: GtsController;

  constructor() {
    this.gtsController = new GtsController();
    console.log('Gts routes have been instantiated successfully.');
  }

  public registerEvents(socket: Socket<GtsEvents>) {}
}

export { GtsRoutes, GtsEvents };
