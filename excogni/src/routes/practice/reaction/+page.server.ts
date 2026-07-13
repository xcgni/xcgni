import type { PageServerLoad } from './$types';
import { pg } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
  // Whether a hardware calibration is already stored for this user. In-mix, a calibrated user
  // goes straight to trials (calibrate once, then bursts are trials only); an uncalibrated one
  // starts with the quick calibration. The dedicated screen keeps the full intro either way.
  let calibrated = false;
  if (locals.user) {
    const rows = await pg`SELECT 1 FROM user_rt_calibration WHERE user_id = ${locals.user.id}`;
    calibrated = rows.length > 0;
  }
  return { calibrated };
};
