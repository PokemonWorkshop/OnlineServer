import { Player } from '@models/Player';
import KoaServer from '@api/KoaServer';

export default () => {
  KoaServer.registerRoute('/api/player', 'GET', async (ctx) => {
    try {
    } catch (error) {}
  })
    .registerRoute('/api/player/all', 'GET', async (ctx) => {
      try {
        const players = await Player.find().select('-_id -__v').exec();

        ctx.status = 200;
        ctx.body = {
          success: true,
          message: 'Successfully retrieved the list of all players',
          data: players,
        };
      } catch (error) {
        console.error('Error while fetching the available players', error);
        ctx.status = 500;
        ctx.body = {
          success: false,
          message:
            'An error occurred while fetching the available players. Please try again later.',
        };
      }
    })
    .registerRoute('/api/player/:playerId', 'GET', async (ctx) => {
      try {
        const { playerId } = ctx.params;

        const player = await Player.findOne({ playerId }).select('-_id -__v');

        if (player) {
          ctx.status = 200;
          ctx.body = {
            success: true,
            message: `Successfully retrieved the player ${playerId}`,
            data: player,
          };
        } else {
          ctx.status = 404;
          ctx.body = {
            success: false,
            message: `The requested player (${playerId}) does not exist.`,
          };
        }
      } catch (error) {
        console.error('Error while fetching the available player', error);
        ctx.status = 500;
        ctx.body = {
          success: false,
          message: `An error occurred while fetching the available player. Please try again later.`,
        };
      }
    })
    .registerRoute('/api/player/:playerId', 'PUT', async (ctx) => {
      try {
      } catch (error) {}
    })
    .registerRoute('/api/player/:playerId', 'DELETE', async (ctx) => {
      try {
        const { playerId } = ctx.params;

        const player = await Player.findOneAndDelete({ playerId })
          .select('-_id -__v')
          .exec();

        if (player) {
          ctx.status = 200;
          ctx.body = {
            success: true,
            message: `The gift (${playerId}) has been successfully deleted.`,
            data: player,
          };
        } else {
          ctx.status = 404;
          ctx.body = {
            success: false,
            message: `The requested player (${playerId}) does not exist.`,
          };
        }
      } catch (error) {
        console.error('Error while deleting the player', error);
        ctx.status = 500;
        ctx.body = {
          success: false,
          message:
            'An error occurred while deleting the player. Please try again later.',
        };
      }
    });
};
