import createEventHandler from '@logic/createEventHandler';
import { server } from '@root/src';
import { Gift } from '@root/src/models/gift/gift.model';
import { z } from 'zod';


/**
 * Schema for validating gift claim data using Zod.
 * 
 * This schema ensures that the input object contains either an `id` or a `code`,
 * but not both. If neither is provided or both are provided, validation will fail
 * with appropriate error messages.
 * 
 * @property id - An optional string representing the gift claim ID.
 * @property code - An optional string representing the gift claim code.
 * 
 * Validation Rules:
 * - At least one of `id` or `code` must be provided.
 * - Both `id` and `code` cannot be provided simultaneously.
 * 
 * Example Usage:
 * ```typescript
 * const result = GiftClaimData.safeParse({ id: "123" });
 * if (!result.success) {
 *   console.error(result.error.errors);
 * }
 * ```
 */
const GiftClaimData = z
  .object({
    id: z.string().optional(),
    code: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasId = !!data.id;
    const hasCode = !!data.code;

    if (!hasId && !hasCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must provide either "id" or "code".',
        path: ['id'],
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must provide either "id" or "code".',
        path: ['code'],
      });
    }

    if (hasId && hasCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You can only provide "id" or "code", not both.',
        path: ['id'],
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You can only provide "id" or "code", not both.',
        path: ['code'],
      });
    }
  });

/**
 * Handles the 'giftClaim' event.
 *
 * @param data - The data received from the client.
 * @param ws - The WebSocket connection of the client.
 * @returns An object indicating the success or failure of the gift claim operation.
 *
 * The function performs the following steps:
 * 1. Validates the received data using `GiftClaimData.safeParse`.
 * 2. If validation fails, returns an error message.
 * 3. Retrieves the player associated with the WebSocket connection.
 * 4. If the player is not found, returns an error message.
 * 5. Attempts to claim the gift for the player using `Gift.claimGift`.
 * 6. If the gift claim is successful, returns the result.
 * 7. If an error occurs during the gift claim, logs the error and returns an error message.
 */
const giftClaimHandler = createEventHandler('giftClaim', async (data, ws) => {
  const validatedData = GiftClaimData.safeParse(data);

  if (!validatedData.success) {
    const zodErrors = validatedData.error.errors.map((err) => ({
      path: err.path.join('.'),
      message: err.message,
    }));

    return {
      success: false,
      message: 'Invalid gift claimed data',
      errors: zodErrors,
    };
  }

  const player = server.getClientId(ws);

  if (!player) {
    return { success: false, message: 'Player not found' };
  }

  try {
    const result = await Gift.claimGift(player, validatedData.data);
    return result;
  } catch (error) {
    console.error('Error claim gift:', error);
    return { success: false, message: 'Failed to claiming the gift' };
  }
});

export default giftClaimHandler;
