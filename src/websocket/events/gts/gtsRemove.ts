import createEventHandler from '@logic/createEventHandler';

const gtsRemoveHandler = createEventHandler('gtsRemove', async (data, ws) => {
  try {
    return {
      success: true,
      message: 'GTS item removed successfully',
    };
  } catch (error) {
    console.error('Error processing trade:', error);
    return {
      success: false,
      message: 'Trade failed due to an unexpected error.',
    };
  }
});

export default gtsRemoveHandler;
