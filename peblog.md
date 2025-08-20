# From chef.convex.dev to Production: 20 Hard-Won Lessons in Prompt Engineering Fullstack Apps

Building Impossible Word from a simple idea to a production game with 1v1 battles, AI integration, and thousands of users taught me everything about prompt engineering at scale. Not just the obvious stuff about talking to ChatGPT, but the deep lessons about building entire applications through strategic prompting across AI agents, code generation tools, and development workflows.

This isn't another "how to write better prompts" tutorial. This is about architecting entire systems through conversation, turning vague ideas into typed production code, and scaling from prototype to real users faster than you thought possible.

The journey started with downloading from chef.convex.dev and ended with a live app at impossible.fun handling real users, real-time battles, and real money decisions about scaling. Here's what I learned about vibe coding with Convex and Cursor.

## The stack that made it possible

**Frontend**: React 19, TypeScript, Vite, Tailwind CSS  
**Backend**: Convex.dev (real-time database + serverless functions)  
**Auth**: Clerk (role-based access, webhook integration)  
**AI**: OpenAI GPT-4o-mini (word generation, intelligent hints)  
**Deployment**: Netlify (with proper redirects for SPA)  
**Development**: Cursor IDE with custom rules and agents

The key insight: each piece of this stack was chosen because it plays nicely with AI code generation. Convex's function-first architecture maps perfectly to prompt-driven development. Clerk's declarative config works beautifully with AI agents. Everything was optimized for prompting, not just performance.

## The 20 lessons that changed everything

### 1. Start with domain models, not features

Chef.convex.dev got me thinking in terms of data first, UI second. Instead of prompting "build a word game," I started with "design a schema for competitive word guessing with real-time collaboration." The AI immediately understood the relationships: users, games, attempts, hints, challenges.

The breakthrough: when you lead with domain modeling, AI gives you better architecture decisions. It thinks in terms of entities and relationships rather than just implementing features.

This approach saved me from three major refactors. When I added challenge mode, the schema already supported multiple players per game. When I added friend collaboration, the invite system was already designed for it.

### 2. Custom Cursor rules are your competitive advantage

Most developers ignore .cursor/rules. That's a mistake. I built custom rules that encoded Convex best practices, my preferred code style, and domain-specific knowledge. The rules became my development DNA.

My three most valuable custom rules:

- Convex function patterns (always include validators, prefer mutations over actions)
- Authentication flows (Clerk integration patterns)
- Error handling strategies (graceful failures, user-friendly messages)

These rules turned Cursor from a generic coding assistant into a domain expert for my specific stack.

### 3. PRDs written for AI consumption, not humans

Traditional product requirements docs are terrible for AI agents. They're too verbose, too ambiguous, too focused on business justification rather than technical specification.

I learned to write PRDs first, before any code. Not because I'm some waterfall planning person, but because writing the PRD forces you to think through the hard problems before you're fighting TypeScript errors.

My PRD workflow:

1. **Brain dump the idea** - get the core concept out
2. **Define the data model** - what entities exist, how they relate
3. **Map user flows** - step by step, no hand-waving
4. **Identify edge cases** - what breaks, what's confusing
5. **Write acceptance criteria** - specific, testable conditions

I rewrote teamvs.md (the challenge mode PRD) three times until it was perfect for AI consumption:

- Specific user stories with clear acceptance criteria
- Technical constraints spelled out explicitly
- Database schema implications included
- API contracts defined upfront
- Edge cases and error states documented

The result: AI agents could implement entire features from the PRD without constant clarification questions. More importantly, I caught design flaws in the PRD phase instead of during implementation.

### 4. Prompt engineering is systems engineering

The biggest mindshift: stop thinking about individual prompts and start thinking about prompt systems. How does the AI that generates your database schema talk to the AI that writes your frontend components? How do you maintain consistency across conversations?

I built a prompt chain:

1. Domain expert AI designs the data model
2. Backend AI implements Convex functions with proper validation
3. Frontend AI builds React components that match the API contracts
4. Testing AI writes integration tests that verify the whole flow

Each AI had access to the outputs of the previous ones. Consistency through handoffs.

### 5. Version your prompts like code

I started keeping a prompt library in impossibleai.md. Not just the final versions, but the evolution. What worked, what failed, what assumptions were wrong.

The game-changer: treating prompts as code meant I could debug them, refactor them, and build abstractions. When word generation wasn't working, I could trace through the prompt evolution and find exactly where the logic broke down.

### 6. AI thrives on constraints, not freedom

"Build a word game" produces garbage. "Build a word game where users get exactly 3 attempts to guess a 5-8 letter word generated by AI, with timer pressure on the final attempt and optional hints after failed attempts" produces excellent code.

The more constraints you give AI, the better it performs. Constraints eliminate ambiguity and force the AI to make decisions within your domain rather than hallucinating generic solutions.

### 7. Real-time is prompt engineering's killer app

Convex's real-time database made prompt engineering feel magical. I could prompt for a feature, watch the AI generate the code, and immediately see it working live in the browser. The feedback loop went from minutes to seconds.

This changed how I prompted. Instead of describing complex state management, I could prompt for specific mutations and watch the real-time updates happen. The AI got immediate feedback on whether its approach worked.

Real-time also made debugging easier. When something broke, I could see exactly which mutation caused the problem and fix it immediately. No refresh, no reload, just live updates showing exactly what happened.

### 8. Authentication prompting is different from feature prompting

Clerk integration taught me that infrastructure prompting requires different strategies than feature prompting. With features, you can iterate and refine. With auth, you need to get it right the first time.

My auth prompting strategy:

- Start with Clerk's documentation as context
- Define the role model explicitly (admin vs user vs anonymous)
- Map out the protected routes and permissions
- Generate the implementation in one shot

No iteration, no experimentation. Get the security model right from the start.

### 9. Schema evolution through conversation

The database schema in schema.ts went through 12 major revisions. Each time, I didn't rewrite it manually. I had conversations with AI about what needed to change and why.

"I need to add challenge mode. Two players compete with the same words. How should I modify the schema?"

The AI would propose migration strategies, suggest new indexes, and identify breaking changes. Schema evolution became a collaborative design process.

### 10. Error handling reveals prompt quality

Bad prompts produce code that fails silently. Good prompts produce code with explicit error handling and user-friendly failure modes.

I started judging my prompts by the error handling in the generated code. If the AI added proper try-catch blocks, validation, and fallback states, I knew the prompt was well-structured.

### 11. Component composition over monolithic prompting

Early mistake: prompting for entire pages at once. Better approach: prompt for small, composable components and then compose them through additional prompts.

MyScores.tsx, UserProfile.tsx, ConfirmDialog.tsx - each one prompted separately with clear interfaces, then composed into larger features. The AI got better at building cohesive experiences from smaller pieces.

### 12. Test-driven prompting works

Instead of prompting for implementation and hoping it works, I started prompting for tests first, then implementation that passes the tests.

"Write integration tests for challenge mode creation, invitation, and gameplay flow."

Then: "Implement the challenge mode functionality to pass these tests."

The AI produced much more reliable code when it had test cases to satisfy. More importantly, when real users found bugs, I could reproduce them as failing tests and then prompt for fixes that made the tests pass.

### 13. Documentation prompting scales knowledge

The files.md document wasn't just project documentation. It was a knowledge base for AI agents. When I prompted for new features, I included relevant sections from files.md as context.

This let me scale my domain knowledge across conversations. New AI agents could understand the existing architecture without me explaining it every time.

### 14. Deployment is part of the prompt loop

Netlify deployment with \_redirects configuration taught me that deployment concerns should be included in feature prompts. Don't just prompt for the feature - prompt for the feature deployed correctly.

"Build a single-page app with client-side routing that works on Netlify."

The AI includes the necessary redirect rules, build configuration, and deployment considerations from the start.

### 15. AI-generated AI prompts are powerful

The most meta lesson: I started using AI to write better prompts for AI. Feed the AI your current prompt and ask it to improve clarity, add missing constraints, or identify ambiguities.

This created a feedback loop where my prompting got progressively better through AI-assisted refinement.

### 16. Performance prompting requires domain knowledge

OpenAI integration taught me that performance-sensitive code requires domain-specific prompting. Generic "make it fast" prompts don't work.

Instead: "Optimize for OpenAI API rate limits, implement exponential backoff, cache responses when appropriate, and fail gracefully with user-friendly messages."

The AI needs specific performance constraints to generate efficient code.

### 17. State management patterns emerge from good prompts

I never explicitly prompted for state management architecture. But consistent, well-structured prompts naturally led to good state patterns. The AI learned to use React hooks appropriately, manage loading states consistently, and handle errors gracefully.

Good prompting teaches AI good patterns without explicit instruction.

### 18. UI prompting needs design constraints

"Build a beautiful UI" produces generic Bootstrap-style interfaces. "Build a UI using Neobrutalism design principles with sharp edges, bold shadows, high contrast, and black/white color scheme" produces distinctive, cohesive designs.

UI prompting requires aesthetic constraints just like feature prompting requires functional constraints.

### 19. Integration prompting is about contracts

The hardest prompting challenges weren't individual features - they were integrations. How do you prompt for Clerk auth that works with Convex functions? How do you ensure the frontend state matches the real-time backend state?

Success came from prompting for clear contracts between systems, not just individual system implementations.

### 20. Prompt engineering scales with code quality

The better my existing codebase, the better AI-generated additions became. Clean, well-structured code gave AI better patterns to follow. Good TypeScript types prevented entire classes of generated bugs.

This created a virtuous cycle: good prompting led to good code, which led to better AI suggestions, which led to even better code.

## 10 Vibe Coding Best Practices: Chef to Production

Going from downloading a template to shipping a live app taught me that vibe coding isn't just about moving fast. It's about building systems that can handle real users while maintaining the speed and creativity that makes development fun.

### 1. Start with chef.convex.dev, end with custom everything

Chef templates give you working code immediately. Don't just modify them - understand them. I spent two days reading every line of the downloaded code before changing anything. Understanding the patterns made customization much faster.

### 2. Real-time is your superpower, use it everywhere

Convex's real-time updates made features feel magical with minimal effort. The leaderboard updates live as players complete games. Challenge battles show opponent progress in real-time. Friend suggestions appear instantly. When everything updates live, your app feels expensive.

### 3. Schema migrations are conversations with AI

Don't hand-write schema changes. Describe what you want to the AI: "I need to track challenge battles between two players with individual scoring." Let it design the tables, indexes, and relationships. Then review and refine.

### 4. Authentication should be infrastructure, not features

Clerk integration happened once, correctly, with AI help. I described the roles (admin, user, anonymous), mapped the protected routes, and let AI generate the auth patterns. No iteration, no debugging auth flows later.

### 5. Write functions that read like PRDs

Convex functions should map directly to user actions. `createChallenge`, `acceptChallenge`, `submitGuess`, `requestHint`. When function names match user stories, the AI generates better implementations and the code stays maintainable.

### 6. Error handling is user experience

Every Convex function includes proper error handling because I told the AI that errors are UX problems, not technical problems. "User not found" becomes "This challenge link has expired." Technical accuracy matters less than user understanding.

### 7. Component composition scales better than big components

I learned to prompt for small, focused components first. `ConfirmDialog`, `ScoreDisplay`, `TimerCountdown`. Then compose them into features. Small components are easier to debug, easier to reuse, and easier for AI to generate correctly.

### 8. TypeScript types are documentation for AI

Strong types helped AI generate better code. When types clearly defined the data model, AI suggestions were more accurate. `Id<"users">` is much better than `string` for teaching AI about relationships.

### 9. Real users find edge cases you never considered

The moment real users touched the app, edge cases appeared everywhere. Challenge links shared on social media. Players refreshing mid-game. Simultaneous challenge acceptances. Build monitoring and graceful failures from day one.

### 10. Ship fast, iterate with data

Netlify deployment made shipping trivial. Real user behavior taught me more than any planning session. The challenge mode UX went through four iterations based on actual usage patterns, not theoretical user flows.

## The meta-lesson

Building Impossible Word taught me that prompt engineering isn't just about talking to AI. It's about designing systems where humans and AI collaborate effectively at every level - from individual functions to entire application architectures.

The future belongs to developers who can architect through conversation, who can turn ideas into running code through strategic prompting, and who understand that the best AI is the AI you never notice because it seamlessly extends your own thinking.

Chef.convex.dev was just the beginning. The real magic happens when you stop thinking about AI as a tool and start thinking about it as a development partner that scales your ability to build at the speed of thought.

Want to see how these lessons work in practice? The entire Impossible Word codebase demonstrates every principle in action. Real prompts, real results, real users.

---

_Built with Convex, deployed on Netlify, powered by careful prompting at [impossible.fun](https://impossible.fun)_
