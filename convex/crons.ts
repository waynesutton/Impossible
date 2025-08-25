import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Schedule to run every Sunday at 8:00 AM UTC
crons.weekly(
  "generate weekly crossword word pool",
  { dayOfWeek: "sunday", hourUTC: 8, minuteUTC: 0 },
  internal.crossword.generateWeeklyWordPool,
);

export default crons;

