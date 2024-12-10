import KoaServer from '@api/KoaServer';
import { Gift } from '@models/Gift';

export default () => {
  KoaServer.registerRoute('/api/gift', 'GET', async (ctx) => {
    try {
      ctx.status = 200;
      ctx.body = {
        message: `Available endpoints for managing mystery gifts:
          POST /api/gift/create - Create a new mystery gift
          GET /api/gift/all - Retrieve all mystery gifts
          GET /api/gift/:id - Retrieve a mystery gift by ID
          PATCH /api/gift/:id - Update a mystery gift by ID`,
      };
    } catch (error) {
      console.error('Error while fetching the available endpoints', error);
      ctx.status = 500;
      ctx.body = {
        message:
          'An error occurred while fetching the available endpoints. Please try again later.',
      };
    }
  })
    .registerRoute('/api/gift/create', 'POST', async (ctx) => {
      try {
        const body = ctx.request.body;
        const gift = new Gift(body);

        await gift.save();

        ctx.status = 201;
        ctx.body = {
          success: true,
          message: `Gift (${gift.giftId}) successfully created`,
          data: gift,
        };
      } catch (error) {
        console.error('Error while creating the gift', error);
        ctx.status = 400;
        ctx.body = {
          success: false,
          message: 'An error occurred while creating the gift.',
          details: error,
        };
      }
    })
    .registerRoute('/api/gift/all', 'GET', async (ctx) => {
      try {
        const gifts = await Gift.find().select('-_id -__v').exec();

        ctx.status = 200;
        ctx.body = {
          success: true,
          message: 'Successfully retrieved the list of all mystery gifts.',
          data: gifts,
        };
      } catch (error) {
        console.error('Error while fetching the available gifts', error);
        ctx.body = {
          success: false,
          message:
            'An error occurred while fetching the available gifts. Please try again later.',
        };
      }
    })
    .registerRoute('/api/gift/:giftId', 'GET', async (ctx) => {
      try {
        const { giftId } = ctx.params;

        const gift = await Gift.findOne({ giftId }).select('-_id -__v').exec();

        if (gift) {
          ctx.status = 200;
          ctx.body = {
            success: true,
            message: `Successfully retrieved the mystery gift ${giftId}`,
            data: gift,
          };
        } else {
          ctx.status = 404;
          ctx.body = {
            success: false,
            message: `The requested gift (${giftId}) does not exist.`,
          };
        }
      } catch (error) {
        console.error('Error while fetching the available gift', error);
        ctx.status = 500;
        ctx.body = {
          success: false,
          message: `An error occurred while fetching the available gift. Please try again later.`,
        };
      }
    })
    .registerRoute('/api/gift/:giftId', 'PUT', async (ctx) => {
      try {
        const { giftId } = ctx.params;
      } catch (error) {}
    })
    .registerRoute('/api/gift/:giftId', 'DELETE', async (ctx) => {
      try {
        const { giftId } = ctx.params;

        const gift = await Gift.findOneAndDelete({ giftId })
          .select('-_id -__v')
          .exec();

        if (gift) {
          ctx.status = 200;
          ctx.body = {
            success: true,
            message: `The gift (${giftId}) has been successfully deleted.`,
            data: gift,
          };
        } else {
          ctx.status = 404;
          ctx.body = {
            success: false,
            message: `The requested gift (${giftId}) does not exist.`,
          };
        }
      } catch (error) {
        console.error('Error while deleting the gift', error);
        ctx.status = 500;
        ctx.body = {
          success: false,
          message:
            'An error occurred while deleting the gift. Please try again later.',
        };
      }
    });
};
