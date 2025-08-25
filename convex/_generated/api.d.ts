/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as auth_helpers from "../auth/helpers.js";
import type * as challengeBattle from "../challengeBattle.js";
import type * as crons from "../crons.js";
import type * as crossword from "../crossword.js";
import type * as game from "../game.js";
import type * as http from "../http.js";
import type * as leaderboard from "../leaderboard.js";
import type * as router from "../router.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  "auth/helpers": typeof auth_helpers;
  challengeBattle: typeof challengeBattle;
  crons: typeof crons;
  crossword: typeof crossword;
  game: typeof game;
  http: typeof http;
  leaderboard: typeof leaderboard;
  router: typeof router;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
