import { schedule } from 'node-cron';
import { removeMultipleFriendReq } from '@ws/services/FriendReqServices';
import { removeExpiredGifts } from '@ws/services/GiftServices';
import { removeMultiplePlayers } from '@ws/services/PlayerServices';

import {
  FRIEND_REQ_EXPIRE_DAYS,
  PLAYER_INACTIVITY_DAYS,
} from '@config/pocketnet.json';

export default class TaskScheduler {
  constructor() {
    this.initialize();
    console.log('Task Scheduler initialized');
  }

  /**
   * Initializes all scheduled tasks.
   */
  initialize(): void {
    this.scheduleTask('0 0 * * *', 'Expired Gift Cleanup', removeExpiredGifts);

    this.scheduleTask(
      '0 0 * * *',
      'Expired Friend Requests Cleanup',
      async () => {
        return await removeMultipleFriendReq(FRIEND_REQ_EXPIRE_DAYS);
      }
    );

    this.scheduleTask('0 0 * * *', 'Inactive Players Cleanup', async () => {
      return await removeMultiplePlayers(PLAYER_INACTIVITY_DAYS);
    });
  }

  /**
   * Schedules a task with the given cron expression, log message, and task function.
   * @param cronExpression - The cron expression defining the schedule.
   * @param taskDescription - A description of the task for logging purposes.
   * @param taskFunction - The function to execute as part of the scheduled task.
   */
  private scheduleTask(
    cronExpression: string,
    taskDescription: string,
    taskFunction: () => Promise<number>
  ): void {
    schedule(cronExpression, async () => {
      try {
        console.debug('TASK', `Running scheduled task: ${taskDescription}...`);
        const deletedCount = await taskFunction();

        console.debug(
          'TASK',
          `${taskDescription} complete: ${deletedCount} items removed`
        );
      } catch (error) {
        console.error(`Error during ${taskDescription}: ${error}`);
      }
    });
  }
}
