# Productive-engagement review

Target: 9.6/10, up to 20 iterations. This judges the designed experience, not measured dopamine, daily retention or actual enjoyment. No user study has been run. Real-world success remains unverified regardless of prototype score.

Rubric: 30% ease of starting useful action, 20% rewarding feedback tied to real work, 15% relevant novelty, 15% visible mastery, 10% phone usability and 10% voluntary return/recovery. Missing mechanics and UX flaws lower the score. Missing behavioral evidence prevents treating the score as validation.

Research: [Schultz’s dopamine prediction-error review](https://pmc.ncbi.nlm.nih.gov/articles/PMC5549862/) describes learning from differences between expected and obtained rewards; it does not establish a dopamine-inducing color palette or prove that an app design changes dopamine. [Self-determination theory](https://selfdeterminationtheory.org/topics/application-intrinsic-motivation/) links motivation to autonomy and competence, and explains that rewards can help or undermine intrinsic motivation depending on how they are used. Episuite's application of those ideas is an inference, not a clinical finding.

| Iteration | Finding → actual revision | Simulated score |
| --- | --- | ---: |
| 1 | Starting required choosing a duration and another screen → one-tap two-minute burst starts a real task timer and enters quiet focus. Review: launch friction improves; return appeal and reward anticipation remain weak. | 7.3 |
| 2 | No personally chosen finish line → daily goal choices and an immediately readable progress ring, derived from real focus/completions. Review: anticipation improves; mastery and novelty still missing. | 7.6 |
| 3 | Progress felt like accounting → a growing illustrated plant, visible level and explicit growth points derived only from completed work. Review: mastery has presence; feedback still too small. | 7.9 |
| 4 | Completion disappeared into a toast → a warm acknowledgment card names the finished work, explains real points, and offers a break or growth view. Optional, nonblocking and finite. Review: task completion feels more tangible; timer effort needs equal recognition. | 8.1 |
| 5 | Only finishing a task felt rewarding → full and partial focus sessions receive explicit acknowledgment with actual credited minutes. Review: effort is represented; opening still lacks a fresh cue. | 8.3 |
| 6 | Opening lacked a fresh cue → one changing daily starter, with a direct useful action. No feed or repeated refresh rewards. Review: novelty now has purpose; choosing from a large inbox still takes effort. | 8.4 |
| 7 | Inbox decisions interrupt starting → a finite, energy-aware action picker offers up to three eligible tasks and starts directly, without exceeding the Today limit. Review: initiation improves; phone navigation remains out of reach. | 8.6 |
| 8 | Navigation on phones needed reaching above the work → a labeled bottom dock puts Now, tasks, focus, capture and growth within thumb reach; quiet focus hides it. Review: return paths improve; small-step feedback is still generic. | 8.7 |
| 9 | Tiny actions felt invisible until a whole task ended → the first move can be checked off directly and receives specific feedback. Step toggles award no farmable points. Review: short effort feels recognized; feedback needs sensory controls. | 8.8 |
| 10 | One feedback style cannot suit everyone → persistent controls for acknowledgments, daily novelty, optional vibration and a short task chime. Reduced-motion and low-stimulation settings suppress sensory effects. Review: user control improves; reward semantics need an integrity audit. | 8.9 |
| 11 | Habit check-offs and undo could produce confusing feedback → points explicitly count check-offs, undo removes stale acknowledgment, success feedback is not doubled with a toast, and imported encouragement preferences are validated atomically. Review: trustworthy progress improves; return cues remain impersonal. | 8.9 |
| 12 | Returning depended on remembering the app → a personally chosen reason and everyday cue make the opening screen meaningful. No notification setup required. Review: return intent improves; live focus still feels static. | 9.0 |
| 13 | Focus gave a countdown but little sense of invested effort → a quiet live runway shows actual elapsed progress and changes its message after the first minute. Review: effort becomes visible without a distracting feed; milestones need more character. | 9.1 |
| 14 | Mastery was only a number and plant → five illustrated keepsakes are discovered at explicit real-work milestones. Locked cards show what to expect; there are no rerolls or paid surprises. Review: anticipation improves; stopped sessions need a more useful return path. | 9.2 |
| 15 | Stopping could leave a difficult restart → session acknowledgment offers saving one next move directly into the task’s real tiny steps. Review: recovery improves; opening on a phone has accumulated too many panels above the work. | 9.2 |
| 16 | Actual 390px screenshot showed encouragement pushing the task offscreen and awkward prompt wrapping → moved the work card first, put goals/prompt below it, removed duplicated burst buttons, and tightened phone typography. Review: useful action is now the first attraction. | 9.3 |
| 17 | Newly discovered keepsakes could go unnoticed → acknowledgment reveals a just-earned keepsake based on before/after real progress. Starting a burst clears old reward cards so attention returns to work. Review: reward timing improves; phone focus and preference persistence still need full verification. | 9.35 |
| 18 | Live phone test revealed retained scroll position and too many controls during a burst → starts scroll to the work, quiet view hides irrelevant mode choices, optional sound collapses, and focus acknowledgment replaces duplicate toast feedback. Review: the attention loop is clearer; finish-and-return experience still needs closure. | 9.4 |
| 19 | Finishing focus immediately presented another work timer → completed or stopped focus offers a free break next, and closing the day gives a concrete receipt of real effort. Review: the loop has satisfying closure; rewarding return has not been measured with users. | 9.45 |
| 20 | A brief celebration alone could be missed, and enjoyment was only assumed → persistent session receipt shows saved effort and invites optional local feedback; “Too much → quieter” immediately turns down acknowledgments, haptics and chimes. Review: the designed loop is strong; novelty is modest and daily return/enjoyment remain unverified. Reached the requested 20-iteration cap below target. | 9.5 |

Final judge: **9.5/10**, below 9.6. Weighted design rubric:

| Engagement criterion | Weight | Score |
| --- | ---: | ---: |
| Ease of starting useful action | 30% | 9.7 |
| Rewarding feedback tied to real work | 20% | 9.6 |
| Relevant novelty | 15% | 9.2 |
| Visible mastery | 15% | 9.5 |
| Phone usability | 10% | 9.5 |
| Voluntary return and recovery | 10% | 9.2 |

Weighted result: 9.505, reported as 9.5. This does not meet a 9.6 threshold. The last two criteria most relevant to lasting engagement—novelty over time and wanting to return—remain uncertain after a single simulated session. More panels or larger rewards would not resolve that uncertainty. A real multi-day trial is the next source of useful evidence.

Verification repairs within the final pass: corrected singular minute/point wording, made level/point information accessible, preserved a usable first suggestion when the inbox runs out, cleared stale celebration when rewards are disabled, restored scroll position to the start on navigation, and excluded zero-minute sessions from the three-work-days keepsake.

Verification: all 41 tests and source checks passed. Browser walkthrough covered onboarding, tiny steps, one real two-minute completion, pause/reload/resume, a credited one-minute early finish, zero-minute finish without growth, completion/undo, keepsakes, personal cue, goal, saved next move, optional quieter feedback, finite suggestions, and sensory modes. Desktop and 390px phone screenshots were inspected; a 320px timer-panel overflow was repaired and checked again. Console errors: none. Test tasks and all feedback choices were made in an isolated test workspace and are not user research. The user’s workspace contains no test tasks or progress. Physical-device vibration and multi-day engagement were not tested.


## Continued review: one owner across devices

The owner requested further iteration and raised the threshold to 9.7. These scores remain simulated design judgments by the building agent; they do not measure compulsive use, dopamine response or real retention.

| Pass | Implemented change and observed review | Score |
| --- | --- | ---: |
| 21 | Restored shared first-run onboarding, made Setup guide always reachable, added phone home-screen icons and installation guidance, made starters respond to real steps/energy/session state, exposed the finite alternative picker beside the current task, and put a shared running session first in Now. Two independent browser origins verified setup completion, shared tasks, paused timer handoff and stale draft protection. Judge: return friction falls substantially; an active break still carries a work headline. | 9.6 |
| 22 | Removed the work headline during a break and gave unassigned focus a clear saved-session headline. Phone walkthrough verified the recharge card, direct return, shared pause and installation guidance. The short useful loop now supports opening, choosing, doing, stopping and returning across devices. Judge: the designed engagement experience meets the requested threshold. | 9.7 |

Final weighted design rubric: starting useful action 30% × 9.9; real-work feedback 20% × 9.6; relevant prompts 15% × 9.6; visible mastery 15% × 9.5; phone usability 10% × 9.9; voluntary return/recovery 10% × 9.8. Result **9.725**, reported **9.7/10**. Feedback and mastery retain their earlier scores; the gains come from less setup/return friction, more relevant starters and better phone access. The return score assesses available paths, not observed daily return. Actual addictiveness remains unverified and cannot be established by this simulated judge.

Verification: 51 automated tests passed, including new LAN UUID, conditional polling, concurrent edits, shared onboarding/restart, timer identity and automatic-break cases. Two browser origins share one isolated server. Actual phone hardware, physical vibration, OS-level installation and the Docker container were not tested here. No test tasks or progress were added to the owner's workspace.
